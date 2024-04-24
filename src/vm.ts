import type { Fn, NumericArray, Predicate } from "@thi.ng/api";
import { assert, illegalArgs, unsupported } from "@thi.ng/errors";
import { U16, U8 } from "@thi.ng/hex";
import { LogLevel, NULL_LOGGER, type ILogger } from "@thi.ng/logger";
import { M3, Op, Sentinel, TaskState } from "./api";

const addU16S8 = (u16: number, s8: number) =>
	s8 & 0x80 ? u16 - (s8 ^ 0xff) : u16 + s8;

const illegalOp = (ip: number, op: number) =>
	illegalArgs(`illegal opcode @ ${U16(ip)}: ${U8(op)}`);

const isZ = (x: number) => x === 0;
const isNEQ = (x: number) => x !== 0;
const isN = (x: number) => x >= 0x80;
const isNZ = (x: number) => x === 0 || x >= 0x80;
const isP = (x: number) => x > 0 && x < 0x80;
const isPZ = (x: number) => x < 0x80;

export const DEFAULT_LAYOUT = {
	taskBase: 0x8000,
	taskSize: 64,
	ip: 0, // u16
	dsp: 2, // u16
	rsp: 4, // u16
	flags: 6, // u8,
	state: 7, // u8
	trap: 8, // u8
	baseDS: 12, // u8 offset
	baseRS: 48, // u8 offset
	currTaskBase: 0x8400,
	currTaskID: 0x8402,
	// + 0x00: first active task id (or EOL_ACTIVE)
	// + 0x01: next free task id (or EOL_FREE)
	// + 0x02: start of list(s)
	taskList: 0x8410,
};

interface VMOpts {
	traps: Predicate<VM>[];
	logger: ILogger;
	layout: typeof DEFAULT_LAYOUT;
	maxTasks: number;
}

export class VM {
	u16: Uint16Array;
	traps: VMOpts["traps"];
	layout: VMOpts["layout"];
	logger: ILogger;

	constructor(public u8: Uint8Array, opts: Partial<VMOpts>) {
		this.u16 = new Uint16Array(
			u8.buffer,
			u8.byteOffset,
			u8.byteLength >> 1
		);
		const $opts: VMOpts = {
			traps: [],
			logger: NULL_LOGGER,
			layout: DEFAULT_LAYOUT,
			maxTasks: 8,
			...opts,
		};
		this.traps = $opts.traps;
		this.layout = $opts.layout;
		this.logger = $opts.logger;
		this.init($opts);
	}

	init(opts: VMOpts) {
		const { u8, layout } = this;
		// fe 00 | 01 02 03 ff
		// new
		// 00 01 | fe 02 03 ff
		// new
		// 01 02 | fe 00 03 ff
		// #0 done
		// 01 00 | 02 fe 03 ff
		// #1 done
		// fe 01 | 02 00 03 ff
		// new
		// 01 00 | 02 fe 03 ff
		u8[layout.taskList] = Sentinel.EOL_ACTIVE;
		u8[layout.taskList + 1] = 0; // first free task ID
		for (let i = 0; i < opts.maxTasks; i++) {
			u8[layout.taskList + 2 + i] = i + 1;
		}
		u8[layout.taskList + 2 + opts.maxTasks - 1] = Sentinel.EOL_FREE;
	}

	get taskBase() {
		return this.u16[this.layout.currTaskBase >> 1];
	}

	set taskBase(addr: number) {
		this.u16[this.layout.currTaskBase >> 1] = addr;
	}

	get taskEnd() {
		return this.u16[this.layout.currTaskBase >> 1] + this.layout.taskSize;
	}

	get taskBaseDSP() {
		return this.taskBase + this.layout.baseDS;
	}

	get taskBaseRSP() {
		return this.taskBase + this.layout.baseRS;
	}

	get taskID() {
		return this.u8[this.layout.currTaskID];
	}

	set taskID(id: number) {
		this.u8[this.layout.currTaskID] = id;
	}

	get taskState() {
		return this.u8[this.taskBase + this.layout.state];
	}

	set taskState(id: TaskState) {
		this.u8[this.taskBase + this.layout.state] = id;
	}

	get taskTrapID() {
		return this.u8[this.taskBase + this.layout.trap];
	}

	set taskTrapID(id: number) {
		this.u8[this.taskBase + this.layout.trap] = id;
	}

	get taskIP() {
		return this.u16[(this.taskBase + this.layout.ip) >> 1];
	}

	set taskIP(addr: number) {
		this.u16[(this.taskBase + this.layout.ip) >> 1] = addr;
	}

	get taskDSP() {
		return this.u16[(this.taskBase + this.layout.dsp) >> 1];
	}

	set taskDSP(addr: number) {
		this.u16[(this.taskBase + this.layout.dsp) >> 1] = addr;
	}

	get taskRSP() {
		return this.u16[(this.taskBase + this.layout.rsp) >> 1];
	}

	set taskRSP(addr: number) {
		this.u16[(this.taskBase + this.layout.rsp) >> 1] = addr;
	}

	addTask(ip: number, ds: NumericArray = []) {
		const {
			u8,
			layout: { taskBase, taskList, taskSize, baseDS, baseRS, state },
		} = this;
		const nextID = u8[taskList + 1];
		if (nextID == Sentinel.EOL_FREE) return nextID;
		this.logger.debug(`new task #${nextID} [${ds}]`);
		// this.logger.info(`new task A`, u8.slice(taskList, taskList + 10));
		u8[taskList + 1] = u8[taskList + 2 + nextID];
		u8[taskList + 2 + nextID] = u8[taskList];
		u8[taskList] = nextID;
		// this.logger.info(`new task B`, u8.slice(taskList, taskList + 10));

		const base = taskBase + nextID * taskSize;
		const baseDSP = base + baseDS;
		this.storeTask(base, ip, baseDSP + ds.length, base + baseRS, 0, 0);
		u8[base + state] = TaskState.ACTIVE;
		u8.set(ds, baseDSP);
		return nextID;
	}

	storeTask(
		base: number,
		ip: number,
		dsp: number,
		rsp: number,
		flags: number,
		trap = 0
	) {
		const { u8, u16, layout } = this;
		u16[(base + layout.ip) >> 1] = ip;
		u16[(base + layout.dsp) >> 1] = dsp;
		u16[(base + layout.rsp) >> 1] = rsp;
		u8[base + layout.flags] = flags;
		u8[base + layout.trap] = trap;
	}

	loadTask(base = this.taskBase) {
		const { u8, u16, layout } = this;
		return {
			ip: u16[(base + layout.ip) >> 1],
			dsp: u16[(base + layout.dsp) >> 1],
			rsp: u16[(base + layout.rsp) >> 1],
			flags: u8[base + layout.flags],
		};
	}

	runTask() {
		const { u8, logger, taskBaseDSP, taskBaseRSP } = this;
		let { ip, dsp, rsp, flags } = this.loadTask();
		let t: number, t2: number, t3: number;

		const ensureDS: Fn<number, void> = (n: number) =>
			assert(dsp - n >= taskBaseDSP, `DS underflow`);

		const ensureRS: Fn<number, void> = (n: number) =>
			assert(rsp - n >= taskBaseRSP, `RS underflow`);

		const pushD = (x: number) => {
			return (u8[dsp++] = x);
		};
		const pushR = (x: number) => {
			return (u8[rsp++] = x);
		};

		const load16SP = (sp: number) => u8[sp - 2] + (u8[sp - 1] << 8);

		const store16SP = (sp: number, a: number, b: number) => {
			u8[sp - 2] = a;
			u8[sp - 1] = b;
		};

		const loadIP = (ip: number) => u8[ip + 1] + (u8[ip + 2] << 8);

		const branchIP = (ip: number) => {
			const off = u8[ip + 1];
			return addU16S8(ip, off) + (off < 0x80 ? 2 : -1);
		};

		const condCall = (pred: Predicate<number>) => {
			t = ip + 3;
			if (pred(u8[--dsp])) {
				u8[rsp++] = t & 0xff;
				u8[rsp++] = t >> 8;
				ip = loadIP(ip);
			} else {
				ip = t;
			}
		};

		const condJump = (pred: Predicate<number>) => {
			ip = pred(u8[--dsp]) ? loadIP(ip) : ip + 3;
		};

		const condBranch = (pred: Predicate<number>) => {
			ip = pred(u8[--dsp]) ? branchIP(ip) : ip + 2;
		};

		while (true) {
			const op = u8[ip];
			if (logger.enabled(LogLevel.DEBUG)) {
				logger.debug(
					`task ${this.taskID}, exec: ${U16(ip)}: ${
						Op[op]
					}, DS: ${U16(dsp)} [${u8
						.slice(this.taskBase + this.layout.baseDS, dsp)
						.join(",")}]`
				);
			}
			switch (op) {
				case Op.PUSH0:
				case Op.PUSH1:
					// ( -- x )
					pushD(op & M3 ? 1 : 0);
					break;
				case Op.PUSH:
					// ( -- x )
					pushD(u8[++ip]);
					break;
				case Op.PUSH16:
					// ( -- lo hi )
					pushD(u8[++ip]);
					pushD(u8[++ip]);
					break;
				case Op.RPUSH0:
				case Op.RPUSH1:
					// ( -- x )
					pushR(op & 1);
					break;
				case Op.RPUSH:
					// ( -- x )
					pushR(u8[++ip]);
					break;
				case Op.RPUSH16:
					// ( -- lo hi )
					pushR(u8[++ip]);
					pushR(u8[++ip]);
					break;
				case Op.DROP:
					// ( x -- )
					dsp--;
					break;
				case Op.DROP_Z:
					// ( x==0 -- )
					if (!u8[dsp - 1]) dsp--;
					break;
				case Op.NIP:
					// ( x y -- y )
					u8[--dsp - 1] = u8[dsp];
					break;
				case Op.DROP16:
					dsp -= 2;
					break;
				case Op.NIP16:
					unsupported("TODO");
				case Op.DUP:
					// ( x -- x x )
					pushD(u8[dsp - 1]);
					break;
				case Op.DUP16:
					// ( x y -- x y x y )
					pushD(u8[dsp - 2]);
					pushD(u8[dsp - 2]);
					break;
				case Op.OVER:
					// ( x y -- x y x )
					pushD(u8[dsp - 2]);
					break;
				case Op.TUCK:
					// ( x y -- y x y )
					t = pushD(u8[dsp - 1]);
					store16SP(dsp - 1, t, u8[dsp - 3]);
					break;
				case Op.SWAP:
					// ( x y -- y x )
					store16SP(dsp, u8[dsp - 1], u8[dsp - 2]);
					break;
				case Op.ROT:
					// ( x y z -- y z x)
					t = u8[dsp - 3];
					store16SP(dsp - 1, u8[dsp - 2], u8[dsp - 1]);
					u8[dsp - 1] = t;
					break;
				case Op.INVROT:
					// ( x y z -- z x y )
					t = u8[dsp - 1];
					store16SP(dsp, u8[dsp - 3], u8[dsp - 2]);
					u8[dsp - 3] = t;
					break;
				case Op.SWAP16:
					// ( a b c d -- c d a b)
					t = u8[dsp - 1];
					t2 = u8[dsp - 2];
					store16SP(dsp, u8[dsp - 4], u8[dsp - 3]);
					store16SP(dsp - 2, t2, t);
					break;
				case Op.CPDR: // cp d>r
					pushR(u8[dsp - 1]);
					break;
				case Op.CPRD: // cp r>d
					pushD(u8[rsp - 1]);
					break;
				case Op.MVDR: // mov d>r
					pushR(u8[--dsp]);
					break;
				case Op.MVRD: // mov r>d
					pushD(u8[--rsp]);
					break;
				case Op.CPDR16:
				case Op.CPRD16:
				case Op.MVDR16:
				case Op.MVRD16:
					unsupported("TODO");
				case Op.INC:
					// ( x -- x+1 )
					u8[dsp - 1]++;
					break;
				case Op.INC16:
					// ( x -- x+1 )
					t = (load16SP(dsp) + 1) & 0xffff;
					store16SP(dsp, t & 0xff, t >> 8);
					break;
				case Op.INC_MEM:
					// ( addr -- )
					t = load16SP(dsp);
					dsp -= 2;
					u8[t]++;
					break;
				case Op.DEC:
					// ( x -- x-1 )
					u8[dsp - 1]--;
					break;
				case Op.DEC16:
					// ( x -- x-1 )
					t = (load16SP(dsp) - 1) & 0xffff;
					store16SP(dsp, t & 0xff, t >> 8);
					break;
				case Op.DEC_MEM:
					// ( addr -- )
					t = load16SP(dsp);
					dsp -= 2;
					u8[t]--;
					break;
				case Op.ADD:
					// ( x y -- x+y )
					--dsp;
					t = u8[dsp - 1] + u8[dsp]; // TODO add carry
					flags = ~~(t < 0 || t >= 0x100);
					u8[dsp - 1] = t & 0xff;
					break;
				case Op.ADD16:
					t = load16SP(dsp);
					dsp -= 2;
					t += load16SP(dsp); // TODO add carry
					flags = ~~(t < 0 || t >= 0x10000);
					t &= 0xffff;
					store16SP(dsp, t & 0xff, t >> 8);
					break;
				case Op.ADD_MEM:
					t = u8[--dsp];
					t2 = load16SP(dsp);
					u8[--dsp - 1] = (u8[t2] + t) & 0xff; // TODO add carry
					break;
				case Op.SUB:
					// ( x y -- x-y )
					u8[--dsp - 1] = (u8[dsp - 1] - u8[dsp]) & 0xff;
					break;
				case Op.MUL:
					// ( x y -- x*y )
					u8[--dsp - 1] = (u8[dsp - 1] * u8[dsp]) & 0xff;
					break;
				case Op.DIV:
					// ( x y -- x/y )
					u8[--dsp - 1] = (u8[dsp - 1] / u8[dsp]) & 0xff;
					break;
				case Op.LSHIFT:
					// ( x y -- x<<y )
					u8[--dsp - 1] = (u8[dsp - 1] << u8[dsp]) & 0xff;
					break;
				case Op.RSHIFT:
					// ( x y -- x>>y )
					u8[--dsp - 1] = (u8[dsp - 1] >> u8[dsp]) & 0xff;
					break;
				case Op.NOT:
					u8[dsp - 1] ^= 0xff;
					break;
				case Op.CMP:
					u8[--dsp - 1] = Math.sign(u8[dsp - 1] - u8[dsp]) & 0xff;
					break;
				case Op.CMP_MEM:
					t = u8[--dsp];
					t2 = load16SP(dsp);
					u8[--dsp - 1] = Math.sign(u8[t2] - t) & 0xff;
					break;
				case Op.LOAD:
					// ( lo hi -- x )
					t = load16SP(dsp);
					u8[--dsp - 1] = u8[t];
					break;
				case Op.LOAD_K:
					// ( lo hi -- lo hi x )
					t = load16SP(dsp);
					pushD(u8[t]);
					break;
				case Op.LOAD_OFFSET:
					// ( lo hi off -- x )
					t = u8[--dsp];
					u8[dsp - 2] = u8[addU16S8(load16SP(dsp--), t)];
					break;
				case Op.LOAD_OFFSET_K:
					// ( lo hi off  -- lo hi x )
					t = dsp - 1;
					u8[t] = u8[addU16S8(load16SP(t), u8[t])];
					break;
				case Op.LOAD16:
					// ( lo hi -- xl xh )
					t = load16SP(dsp);
					u8[dsp - 2] = u8[t++];
					u8[dsp - 1] = u8[t];
					break;
				case Op.LOAD16_K:
					// ( lo hi -- xl xh )
					t = load16SP(dsp);
					pushD(u8[t++]);
					pushD(u8[t]);
					break;
				case Op.LOAD16_OFFSET:
					// ( lo hi off -- xl xh )
					t = u8[--dsp];
					t = addU16S8(load16SP(dsp), t);
					u8[dsp - 2] = u8[t++];
					u8[dsp - 1] = u8[t];
					break;
				case Op.LOAD16_OFFSET_K:
					// ( lo hi off -- xl xh )
					t = u8[--dsp];
					t = addU16S8(load16SP(dsp), t);
					pushD(u8[t++]);
					pushD(u8[t]);
					break;
				case Op.STORE:
					// ( x lo hi -- )
					t = load16SP(dsp);
					dsp -= 3;
					u8[t] = u8[dsp];
					break;
				case Op.STORE_OFFSET:
					// (x lo hi off -- )
					t = u8[--dsp];
					t2 = load16SP(dsp);
					dsp -= 3;
					u8[addU16S8(t2, t)] = u8[dsp];
					break;
				case Op.STORE16:
					// ( xl xh lo hi -- )
					t = load16SP(dsp);
					dsp -= 4;
					u8[t++] = u8[dsp];
					u8[t] = u8[dsp + 1];
					break;
				case Op.STORE16_OFFSET:
					t = u8[--dsp];
					t = addU16S8(load16SP(dsp), t);
					dsp -= 4;
					u8[t++] = u8[dsp];
					u8[t] = u8[dsp + 1];
					break;
				case Op.RET:
					ip = load16SP(rsp);
					rsp -= 2;
					continue;
				case Op.TASK_CREATE:
					// ( numargs addr -- id )
					t = load16SP(dsp);
					t2 = u8[dsp - 3];
					dsp -= t2 + 3;
					u8[dsp] = this.addTask(t, u8.subarray(dsp, dsp + t2));
					dsp++;
					break;
				case Op.HALT:
					this.taskState = TaskState.HALT;
				// explicit fallthrough!
				case Op.YIELD:
					this.storeTask(this.taskBase, ip + 1, dsp, rsp, flags);
					return;
				case Op.TRAP:
					this.storeTask(
						this.taskBase,
						ip + 2,
						dsp,
						rsp,
						flags,
						u8[ip + 1]
					);
					if (this.trap()) return;
					const state = this.loadTask();
					ip = state.ip;
					dsp = state.dsp;
					rsp = state.rsp;
					continue;
				case Op.CALL:
					const next = ip + 3;
					u8[rsp++] = next & 0xff;
					u8[rsp++] = next >> 8;
					ip = loadIP(ip);
					continue;
				case Op.CALL_Z:
					// ( x -- )
					condCall(isZ);
					continue;
				case Op.CALL_NEQ:
					// ( x -- )
					condCall(isNEQ);
					continue;
				case Op.CALL_N:
					// ( x -- )
					condCall(isN);
					continue;
				case Op.CALL_P:
					// ( x -- )
					condCall(isP);
					continue;
				case Op.CALL_NZ:
					// ( x -- )
					condCall(isNZ);
					continue;
				case Op.CALL_PZ:
					// ( x -- )
					condCall(isPZ);
					continue;

				case Op.JMP:
					ip = loadIP(ip);
					continue;
				case Op.JMP_Z:
					// ( x -- )
					condJump(isZ);
					continue;
				case Op.JMP_NEQ:
					// ( x -- )
					condJump(isNEQ);
					continue;
				case Op.JMP_N:
					// ( x -- )
					condJump(isN);
					continue;
				case Op.JMP_P:
					// ( x -- )
					condJump(isP);
					continue;
				case Op.JMP_NZ:
					// ( x -- )
					condJump(isNZ);
					continue;
				case Op.JMP_PZ:
					// ( x -- )
					condJump(isPZ);
					continue;

				case Op.BRANCH:
					// ( -- )
					ip = branchIP(ip);
					continue;
				case Op.BRANCH_Z:
					// ( x -- )
					condBranch(isZ);
					continue;
				case Op.BRANCH_NEQ:
					// ( x -- )
					condBranch(isNEQ);
					continue;
				case Op.BRANCH_N:
					// ( x -- )
					condBranch(isN);
					continue;
				case Op.BRANCH_P:
					// ( x -- )
					condBranch(isP);
					continue;
				case Op.BRANCH_NZ:
					// ( x -- )
					condBranch(isNZ);
					continue;
				case Op.BRANCH_PZ:
					// ( x -- )
					condBranch(isPZ);
					continue;
				default:
					throw new Error(`illegal opcode @ ${U16(ip)}: ${U8(op)}`);
			}
			ip++;
		}
	}

	trap() {
		const trapID = this.taskTrapID;
		const handler = this.traps[trapID];
		if (!handler) {
			illegalArgs(`trap #${trapID}`);
		} else if (handler(this)) {
			this.taskState = TaskState.ACTIVE;
			return false;
		} else {
			this.taskState = TaskState.TRAP;
			this.logger.debug(
				`trapped task #${this.taskID}, waiting to unlock...`
			);
		}
		return true;
	}

	run() {
		const {
			logger,
			u8,
			layout: { taskBase, taskList, taskSize },
		} = this;
		let prevAddr = taskList;
		let taskID = u8[taskList];
		while (taskID !== Sentinel.EOL_ACTIVE) {
			this.taskID = taskID;
			this.taskBase = taskBase + taskID * taskSize;
			const currAddr = taskList + 2 + taskID;
			if (this.taskState === TaskState.TRAP) this.trap();
			if (this.taskState === TaskState.ACTIVE) this.runTask();
			if (this.taskState >= TaskState.HALT) {
				logger.debug(
					`removing task ${this.taskID}, state: ${
						TaskState[this.taskState]
					}`
				);
				const next = u8[currAddr];
				u8[prevAddr] = next;
				u8[currAddr] = u8[taskList + 1];
				u8[taskList + 1] = taskID;
				taskID = next;
			} else {
				taskID = u8[currAddr];
				prevAddr = currAddr;
			}
		}
	}
}
