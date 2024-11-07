# @thi.ng/cspvm

Experimental, polyglot, work-in-progeess stack VM implementations around native
[cooperative
multitasking](https://en.wikipedia.org/wiki/Cooperative_multitasking) and [CSP
channels](https://en.wikipedia.org/wiki/Communicating_sequential_processes) to
communicate and syncrhonize between tasks.

[Op code table](./dev/opcodes.pdf)

Multiple (very incomplete) versions/experiments are in:

## Zig

[Source](./src.zig) - most recent developments...

```bash
# currently requires Zig v0.12.x

# run tests/example
zig build test

# [default] (info): task size 240
# [default] (info): tasklist: dual-list.FixedBufferDualList(14,u8){ .active = 0, .available = 1, .slots = { 255, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 255 } }
# [default] (debug): task: 0
# [default] (debug): ip: 1000 op: vm.Op.push16 ds: {  } rs: {  }
# [default] (debug): ip: 1003 op: vm.Op.call ds: { 16, 32 } rs: {  }
# [default] (debug): ip: 1009 op: vm.Op.push ds: { 16, 32 } rs: { 6, 16 }
# [default] (debug): ip: 100b op: vm.Op.jump ds: { 16, 32, 48 } rs: { 6, 16 }
# [default] (debug): ip: 1010 op: vm.Op.push ds: { 16, 32, 48 } rs: { 6, 16 }
# [default] (debug): ip: 1012 op: vm.Op.trap ds: { 16, 32, 48, 64 } rs: { 6, 16 }
# [default] (info): trap task 16 #85
# 
# [default] (debug): ip: 1014 op: vm.Op.add16 ds: { 16, 32, 48, 64 } rs: { 6, 16 }
# [default] (debug): ip: 1015 op: vm.Op.ret ds: { 64, 96 } rs: { 6, 16 }
# [default] (debug): ip: 1006 op: vm.Op.push ds: { 64, 96 } rs: {  }
# [default] (debug): ip: 1008 op: vm.Op.halt ds: { 64, 96, 80 } rs: {  }
# [default] (debug): task 0 halted
# [default] (info): ds: { 64, 96, 80 } rs: {  }

# build optimized WASM binary & WAT disassembly
scripts/build-zig.sh
```

## WebAssembly

[Source](./src.wasm/vm.wat) - VM implementation in handwritten WASM

```bash
scripts/build-wasm.sh
```

## TypeScript

[Source](./src) - Initial implementation & tests

```bash
yarn install

yarn test
```

## License

&copy; 2022 - 2024 Karsten Schmidt // Apache Software License 2.0
