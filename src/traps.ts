import type { Predicate } from "@thi.ng/api";
import type { VM } from "./vm";

const timers: Record<number, any> = {};

export const TRAPS: Predicate<VM>[] = [
	// 0 print TOS ( x -- )
	(vm) => {
		vm.logger.info(`task #${vm.taskID}:`, vm.u8[--vm.taskDSP]);
		return true;
	},
	// 1 print string ( addr -- )
	(vm) => {
		let dsp = vm.taskDSP;
		const start = (vm.u8[--dsp] << 8) + vm.u8[--dsp];
		const end = vm.u8.indexOf(0, start);
		vm.logger.info(
			`task #${vm.taskID}:`,
			new TextDecoder().decode(vm.u8.subarray(start, end))
		);
		vm.taskDSP = dsp;
		return true;
	},
	// 2 dump task state
	(vm) => {
		const base = vm.taskBase;
		vm.logger.info(
			`task #${vm.taskID}:`,
			"DS",
			vm.u8.subarray(base + vm.layout.baseDS, vm.taskDSP).join(","),
			"RS",
			vm.u8.subarray(base + vm.layout.baseRS, vm.taskRSP).join(","),
			"IP",
			vm.taskIP
		);
		return true;
	},
	// 3 start timer
	(vm) => {
		timers[vm.taskID] = Date.now();
		return true;
	},
	// 4 get timer ( -- x )
	(vm) => {
		vm.u8[vm.taskDSP++] = ((Date.now() - timers[vm.taskID]) / 100) & 0xff;
		return true;
	},
];
