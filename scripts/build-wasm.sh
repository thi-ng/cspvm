#!/bin/sh
wat2wasm -v -o src/wasm/vm.wasm src.wasm/vm.wat
wasm-opt -O3 -o src/wasm/vm-opt.wasm src/wasm/vm.wasm

wasm2wat -f --generate-names -o src/wasm/vm-rev.wat src/wasm/vm.wasm
wasm2wat -f --generate-names -o src/wasm/vm-opt.wat src/wasm/vm-opt.wasm

wasm-stats src/wasm/vm.wasm -o dev/vm.dist
wasm-stats src/wasm/vm-opt.wasm -o dev/vm-opt.dist

ls -l src/wasm