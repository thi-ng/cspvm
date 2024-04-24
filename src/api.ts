export enum TaskState {
	ACTIVE,
	TRAP,
	HALT,
	ERROR,
}

// prettier-ignore
enum OpGroup {
	HALT   = 0,
	TASK   = 1,
	DEVICE = 2,
	TRAP   = 3,
	CALL   = 4,
	JMP    = 5,
	BRANCH = 6,
	CARRY  = 7,
	CMP    = 8,
	LOAD   = 9,
	STORE  = 10,
	INC    = 11,
	ADD    = 12,
	MUL    = 13,
	SHIFT  = 14,
	AND    = 15,
	OR     = 16,
	XOR    = 17,
	PUSH   = 18,
	RPUSH  = 19,
	DROP   = 20,
	RDROP  = 21,
	DUP    = 22,
	SWAP   = 23,
	EXCH   = 24,
}

export const M1 = 0b001;
export const M2 = 0b010;
export const M3 = 0b100;

const FLAG_Z = M3;
const FLAG_P = M2;
const FLAG_N = M1;
const FLAG_PZ = FLAG_P | FLAG_Z;
const FLAG_NZ = FLAG_N | FLAG_Z;
const FLAG_NEQ = FLAG_P | FLAG_N;

// prettier-ignore
export enum Op {
	HALT            = (OpGroup.HALT << 3),
	YIELD           = (OpGroup.HALT << 3) | M2,
	RET             = (OpGroup.HALT << 3) | M1,

	TASK_CREATE     = (OpGroup.TASK << 3),

	DR              = (OpGroup.DEVICE << 3) | M2,
	DW              = (OpGroup.DEVICE << 3) | M1,

	TRAP            = (OpGroup.TRAP << 3),

	CALL            = (OpGroup.CALL << 3),
	CALL_P          = (OpGroup.CALL << 3) | FLAG_P,
	CALL_Z          = (OpGroup.CALL << 3) | FLAG_Z,
	CALL_PZ         = (OpGroup.CALL << 3) | FLAG_PZ,
	CALL_N          = (OpGroup.CALL << 3) | FLAG_N,
	CALL_NZ         = (OpGroup.CALL << 3) | FLAG_NZ,
	CALL_NEQ        = (OpGroup.CALL << 3) | FLAG_NEQ,

	JMP             = (OpGroup.JMP << 3),
	JMP_P           = (OpGroup.JMP << 3) | FLAG_P,
	JMP_Z           = (OpGroup.JMP << 3) | FLAG_Z,
	JMP_PZ          = (OpGroup.JMP << 3) | FLAG_PZ,
	JMP_N           = (OpGroup.JMP << 3) | FLAG_N,
	JMP_NZ          = (OpGroup.JMP << 3) | FLAG_NZ,
	JMP_NEQ         = (OpGroup.JMP << 3) | FLAG_NEQ,

	BRANCH          = (OpGroup.BRANCH << 3),
	BRANCH_P        = (OpGroup.BRANCH << 3) | FLAG_P,
	BRANCH_Z        = (OpGroup.BRANCH << 3) | FLAG_Z,
	BRANCH_PZ       = (OpGroup.BRANCH << 3) | FLAG_PZ,
	BRANCH_N        = (OpGroup.BRANCH << 3) | FLAG_N,
	BRANCH_NZ       = (OpGroup.BRANCH << 3) | FLAG_NZ,
	BRANCH_NEQ      = (OpGroup.BRANCH << 3) | FLAG_NEQ,

	CMP             = (OpGroup.CMP << 3),
	CMP16           = (OpGroup.CMP << 3) | M1,
	CMP_MEM         = (OpGroup.CMP << 3) | M2,

	LOAD            = (OpGroup.LOAD << 3),
	LOAD_K          = (OpGroup.LOAD << 3) | M2,
	LOAD_OFFSET     = (OpGroup.LOAD << 3) | M3,
	LOAD_OFFSET_K   = (OpGroup.LOAD << 3) | M2 | M3,
	LOAD16          = (OpGroup.LOAD << 3) | M1,
	LOAD16_K        = (OpGroup.LOAD << 3) | M1 | M2,
	LOAD16_OFFSET   = (OpGroup.LOAD << 3) | M1 | M3,
	LOAD16_OFFSET_K = (OpGroup.LOAD << 3) | M1 | M2 | M3,

	STORE           = (OpGroup.STORE << 3),
	STORE_OFFSET    = (OpGroup.STORE << 3) | M3,
	STORE16         = (OpGroup.STORE << 3) | M1,
	STORE16_OFFSET  = (OpGroup.STORE << 3) | M1 | M3,

	INC             = (OpGroup.INC << 3),
	INC16           = (OpGroup.INC << 3) | M1,
	INC_MEM         = (OpGroup.INC << 3) | M2,
	DEC             = (OpGroup.INC << 3) | M3,
	DEC16           = (OpGroup.INC << 3) | M1 | M3,
	DEC_MEM         = (OpGroup.INC << 3) | M2 | M3,

	ADD             = (OpGroup.ADD << 3),
	ADD16           = (OpGroup.ADD << 3) | M1,
	ADD_MEM         = (OpGroup.ADD << 3) | M2,
	SUB             = (OpGroup.ADD << 3) | M3,
	SUB16           = (OpGroup.ADD << 3) | M1 | M3,

	MUL             = (OpGroup.MUL << 3),
	MUL16           = (OpGroup.MUL << 3) | M1,
	DIV             = (OpGroup.MUL << 3) | M3,
	DIV16           = (OpGroup.MUL << 3) | M1 | M3,

	LSHIFT          = (OpGroup.SHIFT << 3),
	RSHIFT          = (OpGroup.SHIFT << 3) | M3,
	AND             = (OpGroup.AND << 3),
	OR              = (OpGroup.OR << 3),
	XOR             = (OpGroup.XOR << 3),
	NOT             = (OpGroup.XOR << 3) | M3,

	PUSH            = (OpGroup.PUSH << 3),
	PUSH16          = (OpGroup.PUSH << 3) | M1,
	PUSH0           = (OpGroup.PUSH << 3) | M2,
	PUSH1           = (OpGroup.PUSH << 3) | M2 | M3,
	RPUSH           = (OpGroup.RPUSH << 3),
	RPUSH16         = (OpGroup.RPUSH << 3) | M1,
	RPUSH0          = (OpGroup.RPUSH << 3) | M2,
	RPUSH1          = (OpGroup.RPUSH << 3) | M2 | M3,

	DROP            = (OpGroup.DROP << 3),
	DROP_Z          = (OpGroup.DROP << 3) | M3,
	DROP16          = (OpGroup.DROP << 3) | M1,
	RDROP           = (OpGroup.RDROP << 3),
	RDROP16         = (OpGroup.RDROP << 3) | M1,
	NIP             = (OpGroup.DROP << 3) | M2,
	NIP16           = (OpGroup.DROP << 3) | M1 | M2,

	DUP             = (OpGroup.DUP << 3),
	DUP16           = (OpGroup.DUP << 3) | M1,
	OVER            = (OpGroup.DUP << 3) | M3,
	OVER16          = (OpGroup.DUP << 3) | M1 | M3,
	TUCK            = (OpGroup.DUP << 3) | M2,
	TUCK16          = (OpGroup.DUP << 3) | M1 | M2,

	SWAP            = (OpGroup.SWAP << 3),
	SWAP16          = (OpGroup.SWAP << 3) | M1,
	ROT             = (OpGroup.SWAP << 3) | M3,
	ROT16           = (OpGroup.SWAP << 3) | M1 | M3,
	INVROT          = (OpGroup.SWAP << 3) | M2,
	INVROT16        = (OpGroup.SWAP << 3) | M1 | M2,

	CPDR            = (OpGroup.EXCH << 3),
	CPRD            = (OpGroup.EXCH << 3) | M2,
	MVDR            = (OpGroup.EXCH << 3) | M3,
	MVRD            = (OpGroup.EXCH << 3) | M2 | M3,
	CPDR16          = (OpGroup.EXCH << 3) | M1,
	CPRD16          = (OpGroup.EXCH << 3) | M1 | M2,
	MVDR16          = (OpGroup.EXCH << 3) | M1 | M3,
	MVRD16          = (OpGroup.EXCH << 3) | M1 | M2 | M3,
}

export enum Sentinel {
	EOL_ACTIVE = 0xfe,
	EOL_FREE = 0xff,
}
