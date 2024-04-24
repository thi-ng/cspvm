(module
	;; panic args: ip, dsp, rsp
	(import "vm" "panic" (func $panic (param i32) (param i32) (param i32)))
	(import "vm" "trap" (func $trap (param i32) (param i32) (result i32)))
	;; debug only
	(import "vm" "log" (func $log (param i32)))
	(import "vm" "log" (func $log2 (param i32) (param i32)))
	(import "vm" "log" (func $log3 (param i32) (param i32) (param i32)))
	(import "vm" "log" (func $log4 (param i32) (param i32) (param i32) (param i32)))
	(import "vm" "logPrefix" (func $logPrefix (param i32) (param i32)))

	(memory (export "memory") 1)

	(global $STATUS_ACTIVE i32 (i32.const 0))
	(global $STATUS_TRAP i32 (i32.const 1))
	(global $STATUS_HALT i32 (i32.const 2))
	(global $STATUS_ERROR i32 (i32.const 3))

	(global $CHANNEL_OPEN i32 (i32.const 3))
	(global $CHANNEL_CLOSING i32 (i32.const 3))
	(global $CHANNEL_CLOSED i32 (i32.const 3))

	(global $taskBase i32 (i32.const 0x200))
	(global $maxTasks i32 (i32.const 8))

	(global $taskList i32 (i32.const 0x100))
	(global $taskSize i32 (i32.const 0x100))

	;; task struct field offsets
	(global $offsetIP i32 (i32.const 0))
	(global $offsetDSP i32 (i32.const 2))
	(global $offsetRSP i32 (i32.const 4))
	(global $offsetUP i32 (i32.const 6))
	(global $offsetFlags i32 (i32.const 8))
	(global $offsetStatus i32 (i32.const 9))
	(global $offsetTrap i32 (i32.const 10))

	;; copies `num` bytes from `src` to `dest`
	(func $memcpy (param $dest i32) (param $src i32) (param $num i32)
		;; copy as 32bit words as long as poss
		(loop $copy4
			(if (i32.lt_u (local.get $num) (i32.const 4)) (then (return)))
			(i32.store align=1 (local.get $dest) (i32.load align=1 (local.get $src)))
			(local.set $src (i32.add (local.get $src) (i32.const 4)))
			(local.set $dest (i32.add (local.get $dest) (i32.const 4)))
			(local.set $num (i32.sub (local.get $num) (i32.const 4)))
			(br $copy4)
		)
		;; copy remainder as single bytes
		(loop $copy
			(if (i32.eq (local.get $num) (i32.const 0)) (then (return)))
			(i32.store8 (local.get $dest) (i32.load8_u (local.get $src)))
			(local.set $src (i32.add (local.get $src) (i32.const 1)))
			(local.set $dest (i32.add (local.get $dest) (i32.const 1)))
			(local.set $num (i32.sub (local.get $num) (i32.const 1)))
			(br $copy)
		)
	)

	;; initializes the 2-headed linked list of task slots
	;; https://mastodon.thi.ng/@toxi/111449052682849612
	(func $initTaskList (export "initTaskList")
		(local $start i32)
		(local $i i32)
		(local.set $start (i32.add (global.get $taskList) (i32.const 1)))
		(i32.store8 (global.get $taskList) (i32.const 0xff))
		(i32.store8 (local.get $start) (i32.const 0))
		;; create linked free list (initially all task slots available)
		(local.set $i (i32.const 1))
		(loop $init
			(i32.store8
				(i32.add (local.get $start) (local.get $i))
				(local.get $i))
			(i32.lt_u
				(local.tee $i (i32.add (local.get $i) (i32.const 1)))
				(global.get $maxTasks))
			(br_if $init)
			;; write EOL marker in last slot
			(i32.store8
				(i32.add (local.get $start) (local.get $i))
				(i32.const 0xff))
		)
	)

	(func $getTaskBase (param $id i32) (result i32)
		(i32.add
			(global.get $taskBase)
			(i32.mul (local.get $id) (global.get $taskSize)))
	)

	(func $getTaskStatus (export "getTaskStatus") (param $base i32) (result i32)
		(i32.load8_u (i32.add (local.get $base) (global.get $offsetStatus)))
	)

	(func $setTaskStatus (export "setTaskStatus") (param $base i32) (param $status i32)
		(i32.store8
			(i32.add (local.get $base) (global.get $offsetStatus))
			(local.get $status))
	)

	(func $getTaskTrap (export "getTaskTrap") (param $base i32) (result i32)
		(i32.load8_u (i32.add (local.get $base) (global.get $offsetTrap)))
	)

	(func $setTaskTrap (param $base i32) (param $trap i32)
		(i32.store8
			(i32.add (local.get $base) (global.get $offsetTrap))
			(local.get $trap))
	)

	(func $storeTask (param $base i32) (param $ip i32) (param $dsp i32) (param $rsp i32)
		(i32.store16 (i32.add (local.get $base) (global.get $offsetIP)) (local.get $ip))
		(i32.store16 (i32.add (local.get $base) (global.get $offsetDSP)) (local.get $dsp))
		(i32.store16 (i32.add (local.get $base) (global.get $offsetRSP)) (local.get $rsp))
	)

	(func $addTask (export "addTask") (param $ip i32) (param $argv i32) (param $argc i32) (result i32)
		(local $nextID i32)
		(local $slot i32)
		(local $base i32)
		(local $dsp i32)
		(local.tee $nextID (i32.load8_u offset=1 (global.get $taskList)))
		(if (i32.eq (i32.const 0xff)) (then (return (i32.const 0xff))))
		;; update active & free task lists
		(local.set $slot (i32.add (global.get $taskList) (local.get $nextID)))
		(i32.store8 offset=1 (global.get $taskList) (i32.load8_u offset=2 (local.get $slot)))
		(i32.store8 offset=2 (local.get $slot) (i32.load8_u (global.get $taskList)))
		(i32.store8 (global.get $taskList) (local.get $nextID))
		;; init task
		(local.set $base (call $getTaskBase (local.get $nextID)))
		(local.set $dsp (i32.add (local.get $base) (i32.const 0x10))) ;; TODO offset
		(call $storeTask
			(local.get $base)
			(local.get $ip)
			(i32.add (local.get $dsp) (local.get $argc))
			(i32.add (local.get $base) (i32.const 0x90))  ;; TODO offset
		)
		;; set task state = active
		(i32.store8 (i32.add (local.get $base) (global.get $offsetStatus)) (global.get $STATUS_ACTIVE))
		;; copy args
		(call $memcpy (local.get $dsp) (local.get $argv) (local.get $argc))
		(local.get $nextID)
	)

	(func $freeTask (export "freeTask") (param $id i32) (result i32)
		(local $nextID i32)
		(local $head i32)
		(local $curr i32)
		(local $prev i32)
		(local.set $prev (global.get $taskList))
		(local.set $nextID (i32.load8_u (global.get $taskList)))
		(local.set $head (i32.add (global.get $taskList) (i32.const 2)))
		(block $findOuter
			(loop $find
				;; reached end of list?
				(i32.eq (local.get $nextID) (i32.const 0xff))
				(if (then (return (i32.const 0))))
				;; found desired ID?
				(i32.eq (local.get $nextID) (local.get $id))
				(br_if $findOuter)
				(local.set $curr (i32.add (local.get $head) (local.get $nextID)))
				;; move to next item
				(local.set $prev (local.get $curr))
				(local.set $nextID (i32.load8_u (local.get $curr)))
				(br $find)
			)
		)
		;; unlink task ID from active list & prepend to list of free IDs
		(local.set $nextID (i32.load8_u (local.get $curr)))
		(i32.store8 (local.get $prev) (local.get $nextID))
		(i32.store8 (local.get $curr) (i32.load8_u offset=1 (global.get $taskList)))
		(i32.store8 offset=1 (global.get $taskList) (local.get $id))
		(i32.const 1)
	)

	(func $runTask (param $base i32) (result i32)
		;; (local $base i32)
		(local $ip i32)
		(local $dsp i32)
		(local $rsp i32)
		(local $op i32)
		(local $tmp i32)
		(local $argc i32)
		;; restore task state: IP & stack pointers
		(local.set $ip (i32.load16_u (i32.add (local.get $base) (global.get $offsetIP))))
		(local.set $dsp (i32.load16_u (i32.add (local.get $base) (global.get $offsetDSP))))
		(local.set $rsp (i32.load16_u (i32.add (local.get $base) (global.get $offsetRSP))))

		(block $outer
			(loop $exec
				;; load opcode
				(local.set $op (i32.load8_u (local.get $ip)))
				;; debug trace
				(call $log3 (local.get $ip) (local.get $op) (local.get $dsp))
				;; IP++
				(local.set $ip (i32.add (local.get $ip) (i32.const 1)))

				(block $MUL
				(block $ADD
				(block $PUSH
				(block $CALL
				(block $TRAP
				(block $DEVICE_WRITE
				(block $DEVICE_READ
				(block $TASK
				(block $YIELD
				(block $RET
				(block $HALT
					(block $invalid
						(br_table
							$HALT    ;; 0x00
							$RET     ;; 0x01
							$YIELD   ;; 0x02
							$invalid
							$invalid
							$invalid
							$invalid
							$invalid
							$TASK    ;; 0x08
							$invalid
							$invalid
							$invalid
							$invalid
							$invalid
							$invalid
							$invalid
							$DEVICE_READ  ;; 0x10
							$DEVICE_WRITE
							$invalid
							$invalid
							$invalid
							$invalid
							$invalid
							$invalid
							$TRAP    ;; 0x18
							$invalid
							$invalid
							$invalid
							$invalid
							$invalid
							$invalid
							$invalid
							$CALL    ;; 0x20
							$invalid
							$invalid
							$invalid
							$invalid
							$invalid
							$invalid
							$invalid
							$PUSH    ;; 0x28
							$ADD     ;; 0x29
							$MUL     ;; 0x2a
							;; default branch
							$invalid
							(local.get $op)))
							;; invalid opcode
							(call $panic
								(local.get $ip) (local.get $dsp) (local.get $rsp))
							(unreachable))
				;; HALT ( -- )
				;; update task status & exit loop
				(call $setTaskStatus (local.get $base) (global.get $STATUS_HALT))
				(br $outer))

				;; RET ( -- )
				(local.set $rsp (i32.sub (local.get $rsp) (i32.const 2)))
				(local.set $ip (i32.load16_u (local.get $rsp)))
				(br $exec))

				;; YIELD ( -- )
				;; exit loop only (stores task state outside)
				(br $outer))

				;; TASK ( ... argc ip -- taskid )
				(local.set $tmp (i32.sub (local.get $dsp) (i32.const 3)))
				(local.set $argc (i32.load8_u (local.get $tmp)))
				(local.set $dsp (i32.sub (local.get $tmp) (local.get $argc)))
				(i32.store
					(local.get $dsp)
					(call $addTask
						(i32.load16_u offset=1 (local.get $tmp))
						(local.get $dsp)
						(local.get $argc)))
				(local.set $dsp (i32.add (local.get $dsp) (i32.const 1)))
				(br $exec))

				;; CHANNEL CREATE
				;; CHANNEL READ
				;; CHANNEL WRITE
				;; CHANNEL CLOSE

				;; DEVICE READ ( dev port -- x )
				(call $log (i32.const 0xffff))
				(br $exec))

				;; DEVICE WRITE ( x dev port -- )
				(call $log (i32.const 0xfffe))
				(br $exec))

				;; TRAP ( id -- ? )
				(local.set $tmp (i32.load8_u (local.get $ip)))
				(call $storeTask
					(local.get $base)
					(i32.add (local.get $ip) (i32.const 1))
					(local.get $dsp)
					(local.get $rsp))
				(call $setTaskTrap (local.get $base) (local.get $tmp))
				;; call trap handler, exit if trap is persistent (result !=0)
				(if (call $trapTask (local.get $base) (local.get $tmp))
					(then (return (local.get $ip))))
				;; restore task (might have been modified by trap handler) and continue...
				(local.set $ip (i32.load16_u (i32.add (local.get $base) (global.get $offsetIP))))
				(local.set $dsp (i32.load16_u (i32.add (local.get $base) (global.get $offsetDSP))))
				(local.set $rsp (i32.load16_u (i32.add (local.get $base) (global.get $offsetRSP))))
				(br $exec))

				;; CALL
				(i32.store16 align=1 (local.get $rsp) (i32.add (local.get $ip) (i32.const 2)))
				(local.set $rsp (i32.add (local.get $rsp) (i32.const 2)))
				(local.set $ip (i32.load16_u align=1 (local.get $ip)))
				(br $exec))

				;; PUSH ( -- x )
				(i32.store8 (local.get $dsp) (i32.load8_u (local.get $ip)))
				(local.set $dsp (i32.add (local.get $dsp) (i32.const 1)))
				(local.set $ip (i32.add (local.get $ip) (i32.const 1)))
				(br $exec))

				;; ADD ( a b -- a+b )
				(local.set $dsp (i32.sub (local.get $dsp) (i32.const 1)))
				(local.set $tmp (i32.sub (local.get $dsp) (i32.const 1)))
				(i32.store8 (local.get $tmp)
					(i32.add
						(i32.load8_u (local.get $tmp))
						(i32.load8_u offset=1 (local.get $tmp))))
				(br $exec))

				;; MUL
				(local.set $dsp (i32.sub (local.get $dsp) (i32.const 1)))
				(local.set $tmp (i32.sub (local.get $dsp) (i32.const 1)))
				(i32.store8 (local.get $tmp)
					(i32.mul
						(i32.load8_u (local.get $tmp))
						(i32.load8_u offset=1 (local.get $tmp))))
				(br $exec)

			) ;; loop end
		) ;; outer end

		;; backup task state
		(call $storeTask
			(local.get $base)
			(local.get $ip)
			(local.get $dsp)
			(local.get $rsp))
		;; return IP
		(local.get $ip)
	)

	;; call host trap handler and set task status based on result
	;; (if handler returns !=0, keep task trapped, else reset to active)
	(func $trapTask (param $base i32) (param $trapID i32) (result i32)
		(if (result i32) (call $trap (local.get $base) (local.get $trapID))
			(then
				(call $setTaskStatus (local.get $base) (global.get $STATUS_TRAP))
				(i32.const 1))
			(else
				(call $setTaskStatus (local.get $base) (global.get $STATUS_ACTIVE))
				(i32.const 0))
		)
	)

	(func $run (export "run")
		(local $id i32)
		(local $nextID i32)
		(local $base i32)
		;; read first active task ID
		(local.set $id (i32.load8_u (global.get $taskList)))
		(loop $iter
			;; debug task ID
			;; (call $logPrefix (i32.const 0x8000) (local.get $id))
			;; exit when EOL reached
			(if (i32.eq (local.get $id) (i32.const 0xff)) (then (return)))

			(local.set $base (call $getTaskBase (local.get $id)))
			;; TODO chec if task is trapped (or waiting for channel)
			(if (i32.eq (call $getTaskStatus (local.get $base)) (global.get $STATUS_TRAP))
				(then (drop (call $trapTask (local.get $base) (call $getTaskTrap (local.get $base))))))
			;; run task if active
			(if (i32.eq (call $getTaskStatus (local.get $base)) (global.get $STATUS_ACTIVE))
				(then (drop (call $runTask (local.get $base)))))
			;; read next active task ID
			(local.set $nextID
				(i32.load8_u offset=2
					(i32.add (global.get $taskList) (local.get $id))))
			;; remove task if running caused it to halt
			(if (i32.eq (call $getTaskStatus (local.get $base)) (global.get $STATUS_HALT))
				(then (drop (call $freeTask (local.get $id)))))
			;; process next...
			(local.set $id (local.get $nextID))
			(br $iter)
		)
	)

	(data (i32.const 0x8000) "task:\00")
)
