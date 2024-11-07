import { exposeGlobal } from "@thi.ng/expose";
import { ConsoleLogger } from "@thi.ng/logger";
import { TRAPS } from "./traps";
import { VM } from "./vm";
import { Op } from "./api";

const mem = new Uint8Array(0x10000);

// const defTask = (a: number, b: number, c: number) => [
// 	Op.PUSH,
// 	a,
// 	Op.PUSH,
// 	b,
// 	Op.PUSH,
// 	c,
// 	Op.CALL, // madd
// 	0,
// 	0,
// 	Op.DUP,
// 	Op.TRAP, // syscall: output TOS
// 	0,
// 	Op.YIELD,
// 	Op.PUSH,
// 	c,
// 	// Op.TRAP,
// 	// 2,
// 	Op.ADD,
// 	Op.DUP,
// 	Op.PUSH,
// 	100,
// 	Op.LT,
// 	// Op.TRAP,
// 	// 2,
// 	Op.BRANCH_REL,
// 	8,
// 	// truthy branch
// 	Op.PUSH,
// 	0,
// 	Op.PUSH,
// 	2,
// 	Op.TRAP,
// 	1,
// 	// endif
// 	Op.TRAP,
// 	0,
// 	Op.STOP,
// ];

mem.set([
	//0x00 ( a b c -- a + b * c )
	// Op.TRAP,
	// 2,
	Op.MUL,
	Op.ADD,
	Op.RET,

	// 0x03 wait ( x -- )
	Op.DEC,
	Op.TRAP, // start timer
	3,
	Op.TRAP, // get timer
	4,
	Op.OVER, // (x delta )
	Op.CMP,
	Op.BRANCH_Z,
	4,
	Op.YIELD,
	Op.JMP,
	6,
	0,
	Op.DROP,
	Op.RET,
]);

// countdown loop
mem.set(
	[
		// Op.PUSH,
		// 15,
		Op.DUP,
		Op.PUSH0,
		Op.CMP,
		Op.BRANCH_Z,
		12,
		Op.DUP,
		Op.TRAP,
		0,
		Op.PUSH,
		10,
		Op.CALL, // wait
		3,
		0,
		Op.DEC,
		Op.JMP,
		300 & 0xff,
		300 >> 8,
		// endif
		Op.PUSH16,
		0x10,
		0x02,
		Op.TRAP,
		1,
		Op.HALT,
	],
	300
);

const utf8Encode = (x: string) => new TextEncoder().encode(x);

mem.set(utf8Encode("too small!"), 0x200);
mem.set(utf8Encode("done"), 0x210);

// mem.set(defTask(3, 5, 10), 100);
// mem.set(defTask(8, 9, 10), 200);

const vm = new VM(mem, {
	traps: TRAPS,
	logger: new ConsoleLogger("vm", "DEBUG"),
});

// vm.addTask(100);
// vm.addTask(200);
// vm.addTask(7);
// vm.run();

exposeGlobal("vm", vm);
exposeGlobal("op", Op);

setInterval(() => vm.run(), 16);
