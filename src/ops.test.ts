//@ts-ignore
import { test, expect } from "bun:test";

test("push", () => {
	const mem = [0, 0, 0];
	let dsp = 3;
	mem[--dsp] = 10;
	expect(mem).toEqual([0, 0, 10]);
	expect(dsp).toBe(2);
});

test("dup", () => {
	const mem = [0, 0, 10];
	let dsp = 2;
	mem[--dsp] = mem[dsp + 1];
	expect(mem).toEqual([0, 10, 10]);
	expect(dsp).toBe(1);
});

test("over", () => {
	const mem = [0, 20, 10];
	let dsp = 1;
	mem[--dsp] = mem[dsp + 2];
	expect(mem).toEqual([10, 20, 10]);
	expect(dsp).toBe(0);
});

test("swap", () => {
	const mem = [0, 10, 20];
	let dsp = 1;
	const t = mem[dsp];
	mem[dsp] = mem[dsp + 1];
	mem[dsp + 1] = t;
	expect(mem).toEqual([0, 20, 10]);
	expect(dsp).toBe(1);
});

test("rot", () => {
	// ( a b c -- b c a )
	const mem = [0, 10, 20, 30];
	let dsp = 1;
	const t = mem[dsp + 2];
	mem[dsp + 2] = mem[dsp + 1];
	mem[dsp + 1] = mem[dsp];
	mem[dsp] = t;
	expect(mem).toEqual([0, 30, 10, 20]);
	expect(dsp).toBe(1);
});

test("load", () => {
	const mem = [2, 1, 10];
	mem[0x201] = 23;
	let dsp = 0;
	mem[++dsp] = mem[(mem[dsp - 1] << 8) + mem[dsp]];
	expect(mem.slice(0, 3)).toEqual([2, 23, 10]);
	expect(dsp).toBe(1);
});

test("store", () => {
	const mem = [2, 1, 10];
	let dsp = 0;
	mem[(mem[dsp++] << 8) + mem[dsp++]] = mem[dsp++];
	expect(mem[0x201]).toBe(10);
	expect(dsp).toBe(3);
});

test("add", () => {
	const mem = [0, 10, 20];
	let dsp = 1;
	mem[++dsp] = (mem[dsp] + mem[dsp - 1]) & 0xff;
	expect(mem).toEqual([0, 10, 30]);
	expect(dsp).toBe(2);
});

test("sub", () => {
	const mem = [0, 10, 40];
	let dsp = 1;
	mem[++dsp] = (mem[dsp] - mem[dsp - 1]) & 0xff;
	expect(mem).toEqual([0, 10, 30]);
	expect(dsp).toBe(2);
});

test("lt", () => {
	const mem = [0, 20, 10];
	let dsp = 1;
	mem[++dsp] = ~~(mem[dsp] < mem[dsp - 1]);
	expect(mem).toEqual([0, 20, 1]);
	expect(dsp).toBe(2);
});

test("gt", () => {
	const mem = [0, 10, 20];
	let dsp = 1;
	mem[++dsp] = ~~(mem[dsp] > mem[dsp - 1]);
	expect(mem).toEqual([0, 10, 1]);
	expect(dsp).toBe(2);
});
