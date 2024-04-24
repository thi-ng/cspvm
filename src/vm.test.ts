import { MemoryLogger } from "@thi.ng/logger";
import { beforeEach, expect, test } from "bun:test";
import { Op } from "./api";
import { DEFAULT_LAYOUT, VM } from "./vm";

let vm: VM;
let logger: MemoryLogger;

beforeEach(() => {
	logger = new MemoryLogger("vm", "INFO");
	vm = new VM(new Uint8Array(0x400), {
		logger,
		traps: [
			(vm) => {
				vm.logger.info(
					vm.u8
						.slice(vm.taskBase + vm.layout.baseDS, vm.taskDSP)
						.join(",")
				);
				return true;
			},
			(vm) => {
				vm.logger.info(
					"D",
					vm.u8
						.slice(vm.taskBase + vm.layout.baseDS, vm.taskDSP)
						.join(","),
					"/ R",
					vm.u8
						.slice(vm.taskBase + vm.layout.baseRS, vm.taskRSP)
						.join(",")
				);
				return true;
			},
		],
		maxTasks: 2,
		layout: {
			...DEFAULT_LAYOUT,
			taskBase: 0x200,
			currTaskBase: 0x300,
			currTaskID: 0x302,
			taskList: 0x310,
		},
	});
});

const exec = (prog: number[], numRuns = 1) => {
	logger.clear();
	vm.u8.set(prog, 0);
	vm.addTask(0);
	for (let i = 0; i < numRuns; i++) vm.run();
	return logger.messages();
	// const log = logger.journal.map((x) => x[3]);
	// // console.log(log.join("\n"));
	// return log;
};

test("push", () => {
	const log = exec([
		Op.PUSH,
		4,
		Op.PUSH0,
		Op.PUSH1,
		Op.PUSH,
		2,
		Op.TRAP,
		0,
		Op.HALT,
	]);
	expect(log).toEqual(["4,0,1,2"]);
});

test("push16", () => {
	const log = exec([Op.PUSH16, 10, 20, Op.TRAP, 0, Op.HALT]);
	expect(log).toEqual(["10,20"]);
});

test("drop", () => {
	const log = exec([Op.PUSH16, 10, 20, Op.DROP, Op.TRAP, 0, Op.HALT]);
	expect(log).toEqual(["10"]);
});

test("drop_z", () => {
	const log = exec([
		Op.PUSH16,
		1,
		2,
		Op.PUSH0,
		Op.DROP_Z,
		Op.DROP_Z,
		Op.TRAP,
		0,
		Op.HALT,
	]);
	expect(log).toEqual(["1,2"]);
});

test("drop16", () => {
	const log = exec([
		Op.PUSH1,
		Op.PUSH16,
		10,
		20,
		Op.DROP16,
		Op.TRAP,
		0,
		Op.HALT,
	]);
	expect(log).toEqual(["1"]);
});

test("nip", () => {
	const log = exec([
		Op.PUSH1,
		Op.PUSH16,
		10,
		20,
		Op.NIP,
		Op.TRAP,
		0,
		Op.NIP,
		Op.TRAP,
		0,
		Op.HALT,
	]);
	expect(log).toEqual(["1,20", "20"]);
});

test("dup", () => {
	const log = exec([Op.PUSH1, Op.DUP, Op.TRAP, 0, Op.HALT]);
	expect(log).toEqual(["1,1"]);
});
test("dup16", () => {
	const log = exec([Op.PUSH16, 1, 2, Op.DUP16, Op.TRAP, 0, Op.HALT]);
	expect(log).toEqual(["1,2,1,2"]);
});

test("over", () => {
	const log = exec([
		Op.PUSH1,
		Op.PUSH,
		2,
		Op.PUSH,
		3,
		Op.OVER,
		Op.TRAP,
		0,
		Op.HALT,
	]);
	expect(log).toEqual(["1,2,3,2"]);
});

test("tuck", () => {
	const log = exec([
		Op.PUSH1,
		Op.PUSH,
		2,
		Op.PUSH,
		3,
		Op.TUCK,
		Op.TRAP,
		0,
		Op.HALT,
	]);
	expect(log).toEqual(["1,3,2,3"]);
});

test("swap", () => {
	const log = exec([
		Op.PUSH1,
		Op.PUSH,
		2,
		Op.PUSH,
		3,
		Op.SWAP,
		Op.TRAP,
		0,
		Op.HALT,
	]);
	expect(log).toEqual(["1,3,2"]);
});

test("swap16", () => {
	const log = exec([
		Op.PUSH0,
		Op.PUSH1,
		Op.PUSH,
		2,
		Op.PUSH,
		3,
		Op.SWAP16,
		Op.TRAP,
		0,
		Op.HALT,
	]);
	expect(log).toEqual(["2,3,0,1"]);
});

test("rot", () => {
	const log = exec([
		Op.PUSH1,
		Op.PUSH,
		2,
		Op.PUSH,
		3,
		Op.ROT,
		Op.TRAP,
		0,
		Op.HALT,
	]);
	expect(log).toEqual(["2,3,1"]);
});

test("-rot", () => {
	const log = exec([
		Op.PUSH1,
		Op.PUSH,
		2,
		Op.PUSH,
		3,
		Op.INVROT,
		Op.TRAP,
		0,
		Op.HALT,
	]);
	expect(log).toEqual(["3,1,2"]);
});

test("cpdr", () => {
	const log = exec([Op.PUSH1, Op.PUSH, 2, Op.CPDR, Op.TRAP, 1, Op.HALT]);
	expect(log).toEqual(["D 1,2 / R 2"]);
});

test("cprd", () => {
	const log = exec([Op.PUSH1, Op.CPDR, Op.CPRD, Op.TRAP, 1, Op.HALT]);
	expect(log).toEqual(["D 1,1 / R 1"]);
});

test("mvdr", () => {
	const log = exec([Op.PUSH1, Op.PUSH, 2, Op.MVDR, Op.TRAP, 1, Op.HALT]);
	expect(log).toEqual(["D 1 / R 2"]);
});

test("mvrd", () => {
	const log = exec([Op.PUSH1, Op.MVDR, Op.MVRD, Op.TRAP, 1, Op.HALT]);
	expect(log).toEqual(["D 1 / R "]);
});

test.todo("exch16", () => {});

test("inc", () => {
	const log = exec([Op.PUSH0, Op.INC, Op.INC, Op.TRAP, 0, Op.HALT]);
	expect(log).toEqual(["2"]);
});

test("inc mem", () => {
	const log = exec([
		Op.PUSH16,
		0,
		1,
		Op.DUP16,
		Op.INC_MEM,
		Op.LOAD,
		Op.TRAP,
		0,
		Op.HALT,
	]);
	expect(log).toEqual(["1"]);
});

test("dec", () => {
	const log = exec([Op.PUSH0, Op.DEC, Op.DEC, Op.TRAP, 0, Op.HALT]);
	expect(log).toEqual(["254"]);
});

test("dec mem", () => {
	const log = exec([
		Op.PUSH16,
		0,
		1,
		Op.DUP16,
		Op.DEC_MEM,
		Op.LOAD,
		Op.TRAP,
		0,
		Op.HALT,
	]);
	expect(log).toEqual(["255"]);
});

test("add", () => {
	const log = exec([
		Op.PUSH,
		10,
		Op.PUSH1,
		Op.PUSH,
		2,
		Op.ADD,
		Op.ADD,
		Op.TRAP,
		0,
		Op.HALT,
	]);
	expect(log).toEqual(["13"]);
});

test("add16", () => {
	const log = exec([
		Op.PUSH16,
		0xee,
		0xff,
		Op.PUSH16,
		0x33,
		0x44,
		Op.ADD16,
		Op.TRAP,
		0,
		Op.HALT,
	]);
	expect(log).toEqual(["33,68"]);
});

test("add mem", () => {
	vm.u8[0x102] = 23;
	const log = exec([
		Op.PUSH16,
		2,
		1,
		Op.PUSH,
		19,
		Op.ADD_MEM,
		Op.TRAP,
		0,
		Op.HALT,
	]);
	expect(log).toEqual(["42"]);
});

test("sub", () => {
	const log = exec([
		Op.PUSH,
		10,
		Op.PUSH1,
		Op.PUSH,
		2,
		Op.SUB,
		Op.PUSH,
		3,
		Op.PUSH1,
		Op.SUB,
		Op.TRAP,
		0,
		Op.HALT,
	]);
	expect(log).toEqual(["10,255,2"]);
});

test("mul", () => {
	const log = exec([
		Op.PUSH,
		10,
		Op.PUSH,
		2,
		Op.PUSH,
		3,
		Op.MUL,
		Op.TRAP,
		0,
		Op.HALT,
	]);
	expect(log).toEqual(["10,6"]);
});

test("div", () => {
	const log = exec([Op.PUSH16, 10, 4, Op.DIV, Op.TRAP, 0, Op.HALT]);
	expect(log).toEqual(["2"]);
});

test("lshift", () => {
	const log = exec([Op.PUSH16, 10, 4, Op.LSHIFT, Op.TRAP, 0, Op.HALT]);
	expect(log).toEqual(["160"]);
});

test("rshift", () => {
	const log = exec([Op.PUSH16, 168, 4, Op.RSHIFT, Op.TRAP, 0, Op.HALT]);
	expect(log).toEqual(["10"]);
});

test("not", () => {
	const log = exec([Op.PUSH, 0xaa, Op.NOT, Op.TRAP, 0, Op.HALT]);
	expect(log).toEqual(["85"]);
});

test("cmp", () => {
	const log = exec([
		Op.PUSH1,
		Op.PUSH,
		2,
		Op.CMP,
		Op.PUSH,
		2,
		Op.PUSH,
		2,
		Op.CMP,
		Op.PUSH,
		2,
		Op.PUSH1,
		Op.CMP,
		Op.TRAP,
		0,
		Op.HALT,
	]);
	expect(log).toEqual(["255,0,1"]);
});

test("cmp mem", () => {
	vm.u8.set([1, 2, 3], 0x102);
	const log = exec([
		Op.JMP,
		10,
		0,
		// sub
		Op.INVROT,
		Op.INC16,
		Op.DUP16,
		Op.PUSH,
		2,
		Op.CMP_MEM,
		Op.RET,
		// main
		Op.PUSH16,
		2,
		1,
		Op.CALL,
		5,
		0,
		Op.CALL,
		3,
		0,
		Op.CALL,
		3,
		0,
		Op.INVROT,
		Op.DROP16,
		Op.TRAP,
		0,
		Op.HALT,
	]);
	expect(log).toEqual(["255,0,1"]);
});

test("load", () => {
	vm.u8[0x102] = 42;
	const log = exec([Op.PUSH16, 2, 1, Op.LOAD, Op.TRAP, 0, Op.HALT]);
	expect(log).toEqual(["42"]);
});

test("load K", () => {
	vm.u8[0x102] = 42;
	const log = exec([Op.PUSH16, 2, 1, Op.LOAD_K, Op.TRAP, 0, Op.HALT]);
	expect(log).toEqual(["2,1,42"]);
});

test("load offset", () => {
	vm.u8[0x122] = 42;
	const log = exec([
		Op.PUSH16,
		2,
		1,
		Op.PUSH,
		0x20,
		Op.LOAD_OFFSET,
		Op.TRAP,
		0,
		Op.HALT,
	]);
	expect(log).toEqual(["42"]);
});

test("load offset K", () => {
	vm.u8[0x122] = 42;
	const log = exec([
		Op.PUSH16,
		2,
		1,
		Op.PUSH,
		0x20,
		Op.LOAD_OFFSET_K,
		Op.TRAP,
		0,
		Op.HALT,
	]);
	expect(log).toEqual(["2,1,42"]);
});

test("load16", () => {
	vm.u8[0x102] = 23;
	vm.u8[0x103] = 42;
	const log = exec([Op.PUSH16, 2, 1, Op.LOAD16, Op.TRAP, 0, Op.HALT]);
	expect(log).toEqual(["23,42"]);
});

test("load16 K", () => {
	vm.u8[0x102] = 23;
	vm.u8[0x103] = 42;
	const log = exec([Op.PUSH16, 2, 1, Op.LOAD16_K, Op.TRAP, 0, Op.HALT]);
	expect(log).toEqual(["2,1,23,42"]);
});

test("load16 offset", () => {
	vm.u8[0x122] = 23;
	vm.u8[0x123] = 42;
	const log = exec([
		Op.PUSH16,
		2,
		1,
		Op.PUSH,
		0x20,
		Op.LOAD16_OFFSET,
		Op.TRAP,
		0,
		Op.HALT,
	]);
	expect(log).toEqual(["23,42"]);
});

test("load16 offset K", () => {
	vm.u8[0x122] = 23;
	vm.u8[0x123] = 42;
	const log = exec([
		Op.PUSH16,
		2,
		1,
		Op.PUSH,
		0x20,
		Op.LOAD16_OFFSET_K,
		Op.TRAP,
		0,
		Op.HALT,
	]);
	expect(log).toEqual(["2,1,23,42"]);
});

test("store", () => {
	const log = exec([
		Op.PUSH,
		10,
		Op.PUSH,
		42,
		Op.PUSH16,
		2,
		1,
		Op.STORE,
		Op.TRAP,
		0,
		Op.HALT,
	]);
	expect(log).toEqual(["10"]);
	expect(vm.u8[0x102]).toBe(42);
});

test("store offset", () => {
	const log = exec([
		Op.PUSH,
		10,
		Op.PUSH,
		42,
		Op.PUSH16,
		2,
		1,
		Op.PUSH,
		0x20,
		Op.STORE_OFFSET,
		Op.TRAP,
		0,
		Op.HALT,
	]);
	expect(log).toEqual(["10"]);
	expect(vm.u8[0x122]).toBe(42);
});

test("store16", () => {
	const log = exec([
		Op.PUSH,
		10,
		Op.PUSH16,
		23,
		42,
		Op.PUSH16,
		2,
		1,
		Op.STORE16,
		Op.TRAP,
		0,
		Op.HALT,
	]);
	expect(log).toEqual(["10"]);
	expect(vm.u8[0x102]).toBe(23);
	expect(vm.u8[0x103]).toBe(42);
});

test("store16 offset", () => {
	const log = exec([
		Op.PUSH,
		10,
		Op.PUSH16,
		23,
		42,
		Op.PUSH16,
		2,
		1,
		Op.PUSH,
		0x20,
		Op.STORE16_OFFSET,
		Op.TRAP,
		0,
		Op.HALT,
	]);
	expect(log).toEqual(["10"]);
	expect(vm.u8[0x122]).toBe(23);
	expect(vm.u8[0x123]).toBe(42);
});

test("yield", () => {
	const log = exec(
		[
			Op.PUSH,
			10,
			Op.YIELD,
			Op.PUSH,
			20,
			Op.TRAP,
			0,
			Op.YIELD,
			Op.ADD,
			Op.TRAP,
			0,
			Op.HALT,
		],
		3
	);
	expect(log).toEqual(["10,20", "30"]);
});

test("call", () => {
	const log = exec([
		Op.PUSH,
		10,
		Op.CALL,
		10,
		0,
		Op.PUSH,
		20,
		Op.TRAP,
		1,
		Op.HALT,
		// subroutine
		Op.DUP,
		Op.RET,
	]);
	expect(log).toEqual(["D 10,10,20 / R "]);
});

test("call_z", () => {
	const log = exec([
		Op.PUSH1,
		Op.PUSH0,
		Op.CALL_Z,
		11,
		0,
		Op.CALL_Z,
		11,
		0,
		Op.TRAP,
		1,
		Op.HALT,
		// subroutine
		Op.PUSH1,
		Op.RET,
	]);
	expect(log).toEqual(["D 1 / R "]);
});

test("jump", () => {
	const log = exec(
		[
			Op.PUSH,
			10,
			Op.JMP,
			7,
			0,
			Op.PUSH,
			20,
			Op.PUSH,
			30,
			Op.TRAP,
			0,
			Op.HALT,
		],
		3
	);
	expect(log).toEqual(["10,30"]);
});

test("jump_z", () => {
	const log = exec(
		[
			Op.PUSH,
			0,
			Op.JMP_Z,
			7,
			0,
			Op.PUSH,
			1,
			//
			Op.PUSH1,
			Op.JMP_Z,
			13,
			0,
			Op.PUSH,
			2,
			//
			Op.TRAP,
			0,
			Op.HALT,
		],
		3
	);
	expect(log).toEqual(["2"]);
});

test("jump_n", () => {
	const log = exec(
		[
			Op.PUSH,
			0xff,
			Op.JMP_N,
			7,
			0,
			Op.PUSH,
			1,
			//
			Op.PUSH1,
			Op.JMP_N,
			13,
			0,
			Op.PUSH,
			2,
			//
			Op.TRAP,
			0,
			Op.HALT,
		],
		3
	);
	expect(log).toEqual(["2"]);
});

test("branch", () => {
	const log = exec([
		Op.JMP,
		8,
		0,
		Op.PUSH,
		2,
		Op.TRAP,
		0,
		Op.HALT,
		//
		Op.BRANCH,
		-5,
	]);
	expect(log).toEqual(["2"]);
});

test("branch_z", () => {
	const log = exec([
		Op.PUSH0,
		Op.BRANCH_Z,
		1,
		Op.PUSH1,
		//
		Op.PUSH1,
		Op.BRANCH_Z,
		2,
		Op.PUSH,
		2,
		Op.TRAP,
		0,
		Op.HALT,
	]);
	expect(log).toEqual(["2"]);
});

test("branch_neq", () => {
	const log = exec([
		Op.PUSH,
		0xff,
		Op.BRANCH_NEQ,
		1,
		Op.PUSH1,
		//
		Op.PUSH1,
		Op.BRANCH_NEQ,
		2,
		Op.PUSH,
		2,
		//
		Op.PUSH0,
		Op.BRANCH_NEQ,
		2,
		Op.PUSH,
		3,
		Op.TRAP,
		0,
		Op.HALT,
	]);
	expect(log).toEqual(["3"]);
});

test("branch_n", () => {
	const log = exec([
		Op.PUSH,
		0xff,
		Op.BRANCH_N,
		1,
		Op.PUSH1,
		//
		Op.PUSH0,
		Op.BRANCH_N,
		2,
		Op.PUSH,
		2,
		//
		Op.PUSH1,
		Op.BRANCH_N,
		2,
		Op.PUSH,
		3,
		Op.TRAP,
		0,
		Op.HALT,
	]);
	expect(log).toEqual(["2,3"]);
});

test("branch_p", () => {
	const log = exec([
		Op.PUSH1,
		Op.BRANCH_P, // gt
		1,
		Op.PUSH1,
		//
		Op.PUSH0,
		Op.BRANCH_P, // gt
		2,
		Op.PUSH,
		2,
		//
		Op.PUSH,
		0xff,
		Op.BRANCH_P,
		2,
		Op.PUSH,
		3,
		Op.TRAP,
		0,
		Op.HALT,
	]);
	expect(log).toEqual(["2,3"]);
});

test("branch_nz", () => {
	let log = exec([
		Op.PUSH0,
		Op.BRANCH_NZ,
		1,
		Op.PUSH1,
		//
		Op.PUSH,
		0xff,
		Op.BRANCH_NZ,
		2,
		Op.PUSH,
		2,
		//
		Op.PUSH1,
		Op.BRANCH_NZ,
		2,
		Op.PUSH,
		3,
		Op.TRAP,
		0,
		Op.HALT,
	]);
	expect(log).toEqual(["3"]);
});

test("branch_pz", () => {
	let log = exec([
		Op.PUSH0,
		Op.BRANCH_PZ,
		1,
		Op.PUSH1,
		//
		Op.PUSH1,
		Op.BRANCH_PZ,
		2,
		Op.PUSH,
		2,
		//
		Op.PUSH,
		0xff,
		Op.BRANCH_PZ,
		2,
		Op.PUSH,
		3,
		Op.TRAP,
		0,
		Op.HALT,
	]);
	expect(log).toEqual(["3"]);
});

test("create task", () => {
	const log = exec(
		[
			Op.PUSH,
			10,
			Op.PUSH1,
			Op.PUSH16,
			15,
			0,
			Op.TASK_CREATE,
			Op.YIELD,
			Op.PUSH16,
			0,
			1,
			Op.LOAD,
			Op.TRAP,
			0,
			Op.HALT,
			// sub task @ 15
			Op.TRAP,
			1,
			Op.PUSH16,
			0,
			1,
			Op.STORE,
			Op.HALT,
		],
		2
	);
	expect(log).toEqual(["D 10 / R ", "1,10"]);
});
