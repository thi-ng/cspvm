const std = @import("std");
// const thing = @import("thi.ng");
const builtin = @import("builtin");
const vm = @import("vm.zig");
const testing = std.testing;

const Op = vm.Op;

// pub const std_options: std.Options = .{
//     .log_level = .debug,
//     .logFn = std.log.defaultLog,
// };

export fn vm_trap(base: *anyopaque, trapID: u8) bool {
    const task = @as(*vm.VM.Task, @alignCast(@ptrCast(base)));
    _ = task;
    std.log.info("trap task {d} #{d}\n", .{ @offsetOf(vm.VM.Task, "ds"), trapID });
    return false;
}

test "vm" {
    std.testing.log_level = std.log.Level.debug;

    vm.vm.init();

    std.log.info("task size {d}", .{@sizeOf(vm.VM.Task)});

    std.mem.copyForwards(u8, vm.vm.mem[0x1000..], &[_]u8{
        @intFromEnum(Op.push16),
        0x10,
        0x20,
        @intFromEnum(Op.call),
        0x09,
        0x10,
        @intFromEnum(Op.push),
        0x50,
        // pad
        0,
        // subroutine
        @intFromEnum(Op.push),
        0x30,
        @intFromEnum(Op.jump),
        0x10,
        0x10,
        // pad
        0,
        0,
        @intFromEnum(Op.push),
        0x40,
        @intFromEnum(Op.trap),
        0x55,
        0x31,
        1,
    });
    const id = vm.vm.addTask(0x1000);
    const tasks = vm.vm.taskList();
    std.log.info("tasklist: {}", .{tasks});
    vm.vm.run();
    vm.vm.run();
    const task = vm.vm.taskForID(id);
    std.log.info("ds: {d} rs: {d}\n", .{
        task.ds[0..task.dsp],
        task.rs[0..task.rsp],
    });
}
