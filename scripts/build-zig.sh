#!/bin/sh

zig build -Doptimize=ReleaseFast
cp zig-out/bin/main.wasm src/wasm/vm-zig.wasm

# disassemble
wasm2wat -f --generate-names -o src/wasm/vm-zig.wat zig-out/bin/main.wasm

# optimize & disassemble
wasm-opt -O3 -o src/wasm/vm-zig-opt.wasm zig-out/bin/main.wasm
wasm2wat -f --generate-names -o src/wasm/vm-zig-opt.wat src/wasm/vm-zig-opt.wasm

wasm-stats src/wasm/vm-zig.wasm -o dev/vm-zig.dist
wasm-stats src/wasm/vm-zig-opt.wasm -o dev/vm-zig-opt.dist

ls -l src/wasm/vm-zig*