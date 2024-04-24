const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const thing = b.dependency("thi.ng", .{
        .target = target,
        .optimize = optimize,
    }).module("thi.ng");

    const lib = @import("node_modules/@thi.ng/wasm-api/zig/build.zig").wasmLib(b, .{
        .root = "src.zig/vm.zig",
        .modules = &.{
            // .{ .name = "wasm-api-dom", .path = "@thi.ng/wasm-api-dom/zig/lib.zig" },
            // .{ .name = "wasm-api-schedule", .path = "@thi.ng/wasm-api-schedule/zig/lib.zig" },
        },
        .optimize = optimize,
    });

    lib.stack_size = 0x00;

    lib.root_module.addImport("thi.ng", b.dependency("thi.ng", .{
        .target = b.resolveTargetQuery(.{ .cpu_arch = .wasm32, .os_tag = .freestanding }),
        .optimize = optimize,
    }).module("thi.ng"));

    b.installArtifact(lib);

    const main_tests = b.addTest(.{
        .root_source_file = b.path("src.zig/vm.test.zig"),
    });

    main_tests.root_module.addImport("thi.ng", thing);

    const run_main_tests = b.addRunArtifact(main_tests);

    const test_step = b.step("test", "Run library tests");
    test_step.dependOn(&run_main_tests.step);
}
