# @thi.ng/cspvm

Experimental, polyglot, work-in-progeess stack VM implementations around native
[cooperative
multitasking](https://en.wikipedia.org/wiki/Cooperative_multitasking) and [CSP
channels](https://en.wikipedia.org/wiki/Communicating_sequential_processes) to
communicate and syncrhonize between tasks.

[Op codes](./dev/opcodes.pdf)

Multiple (very incomplete) versions/experiments are in:

## Zig

[Source](./src.zig) - most recent developments...

```bash
# currently requires Zig v0.12.x

# run tests/example
zig build test

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
