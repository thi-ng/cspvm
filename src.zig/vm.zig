const std = @import("std");
const thing = @import("thi.ng");
const builtin = @import("builtin");
const testing = std.testing;

extern fn vm_trap(base: *anyopaque, trapID: u8) bool;

pub const Op = enum(u8) {
    halt = 0x00,
    ret = 0x01,
    yield = 0x02,
    //
    task = 0x08,
    trap = 0x09,
    //
    jump = 0x10,
    call = 0x18,
    push = 0x20,
    push16 = 0x21,
    add = 0x30,
    add16 = 0x31,

    illegal = 0xff,
};

const TaskState = enum(u8) {
    active,
    io,
    trap,
    halt,
};

const ChannelState = enum(u2) {
    open,
    closing,
    closed,
};

const ChannelBufferState = enum(u2) {
    wait,
    ready,
};

const VMOpts = struct {
    bank_size: u32,
    task_base: u32,
    num_tasks: u8,
    task_list_base: u16,
    size_ds: u8,
    size_rs: u8,
    channel_list_base: u16,
    channel_base: u16,
    num_channels: u8,
};

pub fn defVM(comptime opts: VMOpts) type {
    const TaskList = thing.FixedBufferDualList(opts.num_tasks, u8);
    const ChannelList = thing.FixedBufferDualList(opts.num_channels, u8);

    const impl = extern struct {
        mem: [opts.task_base + opts.bank_size * opts.num_tasks]u8 = undefined,

        const Self = @This();

        pub const Task = extern struct {
            ip: u16,
            up: u16 = 0,
            dsp: u8 = 0,
            rsp: u8 = 0,
            state: TaskState = .active,
            flags: u8 = 0,
            trapID: u8 = 0,
            __pad0: [7]u8 = undefined,
            ds: [opts.size_ds]u8 = undefined,
            rs: [opts.size_rs]u8 = undefined,

            pub fn init(self: *Task, ip: u16) void {
                self.* = .{ .ip = ip };
            }

            fn store(self: *Task, ip: u16, dsp: u8, rsp: u8) void {
                self.ip = ip;
                self.dsp = dsp;
                self.rsp = rsp;
            }

            fn trap(self: *Task) bool {
                if (vm_trap(self, self.trapID)) {
                    self.state = .trap;
                    return true;
                } else {
                    self.state = .active;
                    return false;
                }
            }

            fn trace(self: *const Task, ip: u16, op: Op, dsp: u8, rsp: u8) void {
                if (builtin.target.cpu.arch == .wasm32) {
                    @import("wasm-api").printFmt("ip: {x} op: {x} ds: {d} rs: {d}\n", .{
                        ip,
                        @intFromEnum(op),
                        self.ds[0..dsp],
                        self.rs[0..rsp],
                    });
                } else {
                    std.log.debug("ip: {x} op: {} ds: {d} rs: {d}", .{
                        ip,
                        op,
                        self.ds[0..dsp],
                        self.rs[0..rsp],
                    });
                }
            }
        };

        pub const Channel = extern struct {
            buf: u16,
            flags: extern struct {
                state: ChannelState = .open,
                kind: ChannelBufferState = .wait,
            },
        };

        pub fn init(self: *Self) void {
            self.taskList().init();
        }

        pub inline fn channelList(self: *Self) *ChannelList {
            return @ptrCast(&self.mem[opts.channel_list_base]);
        }

        pub inline fn channelForID(self: *Self, id: u8) *Channel {
            return @alignCast(@ptrCast(&self.mem[opts.channel_base + id * @sizeOf(Channel)]));
        }

        pub fn addChannel(self: *Self) u8 {
            const channels = self.channelList();
            if (channels.alloc()) |id| {
                // const channel = self.channelForID(id);
                // channel.init(ip);
                return id;
            }
            return ChannelList.SENTINEL;
        }

        pub inline fn taskList(self: *Self) *TaskList {
            return @ptrCast(&self.mem[opts.task_list_base]);
        }

        pub inline fn taskForID(self: *Self, id: u8) *Task {
            return @alignCast(@ptrCast(&self.mem[opts.task_base + @as(u16, id) * @sizeOf(Task)]));
        }

        pub fn addTask(self: *Self, ip: u16) u8 {
            const tasks = self.taskList();
            if (tasks.alloc()) |id| {
                const task = self.taskForID(id);
                task.init(ip);
                return id;
            }
            return TaskList.SENTINEL;
        }

        pub fn runTask(self: *Self, task: *Task) void {
            var ip = task.ip;
            var dsp = task.dsp;
            var rsp = task.rsp;
            loop: while (true) {
                const op: Op = @enumFromInt(self.mem[ip]);
                task.trace(ip, op, dsp, rsp);
                ip += 1;
                switch (op) {
                    .halt => {
                        task.state = .halt;
                        break :loop;
                    },
                    .ret => {
                        rsp -= 2;
                        ip = ptr16(&task.rs[rsp]).*;
                    },
                    .yield => {
                        break :loop;
                    },
                    .trap => {
                        task.store(ip + 1, dsp, rsp);
                        task.trapID = self.mem[ip];
                        if (task.trap()) return;
                        ip = task.ip;
                        dsp = task.dsp;
                        rsp = task.rsp;
                    },
                    .jump => {
                        ip = ptr16(&self.mem[ip]).*;
                    },
                    .call => {
                        ptr16(&task.rs[rsp]).* = ip + 2;
                        rsp += 2;
                        ip = ptr16(&self.mem[ip]).*;
                    },
                    .push => {
                        task.ds[dsp] = self.mem[ip];
                        dsp += 1;
                        ip += 1;
                    },
                    .push16 => {
                        ptr16(&task.ds[dsp]).* = ptr16(&self.mem[ip]).*;
                        dsp += 2;
                        ip += 2;
                    },
                    .add => {
                        dsp -= 1;
                        task.ds[dsp - 1] +%= task.ds[dsp];
                    },
                    .add16 => {
                        dsp -= 2;
                        ptr16(&task.ds[dsp - 2]).* +%= ptr16(&task.ds[dsp]).*;
                    },
                    else => unreachable,
                }
            }
            task.store(ip, dsp, rsp);
        }

        pub fn run(self: *Self) void {
            const tasks = self.taskList();
            var iter = tasks.iterator();
            while (iter.next()) |id| {
                std.log.debug("task: {d}", .{id});
                const task = self.taskForID(id);
                if (task.state == .trap) {
                    _ = task.trap();
                }
                if (task.state == .active) {
                    self.runTask(task);
                }
                if (task.state == .halt) {
                    std.log.debug("task {d} halted", .{id});
                    _ = tasks.free(id);
                }
            }
        }
    };

    // std.debug.assert(@sizeOf(impl.Task) & 0xff == 0);

    return impl;
}

inline fn ptr16(ptr: *u8) *align(1) u16 {
    return @ptrCast(ptr);
}

pub const VM = defVM(.{
    .bank_size = 0x1_0000,
    .task_list_base = 0x100,
    .task_base = 0x200,
    .num_tasks = 16 - 2,
    .num_channels = 32 - 2,
    .size_ds = 0x70,
    .size_rs = 0x70,
    .channel_list_base = 0x110,
    .channel_base = 0x1000,
});

pub export var vm = VM{};

// var scratch: [256]u8 = undefined;
// pub var WASM_ALLOCATOR: std.mem.Allocator = undefined;

// export fn start() void {
// var fba = std.heap.FixedBufferAllocator.init(&scratch);
// WASM_ALLOCATOR = fba.allocator();
// }

export fn addTask(ip: u16) u8 {
    return vm.addTask(ip);
}

export fn run(id: u8) bool {
    vm.runTask(vm.taskForID(id));
    return true;
}
