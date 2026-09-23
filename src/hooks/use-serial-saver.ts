import { useCallback, useRef, useState } from "react";

export function useSerialSaver<T>(options: {
	save: (value: T) => Promise<void>;
	onSuccess?: (value: T) => void;
	onError?: (error: unknown, value: T) => void;
}): { cancel: () => void; inFlight: boolean; submit: (value: T) => void } {
	const { onError, onSuccess, save } = options;
	const saveRef = useRef(save);
	saveRef.current = save;
	const callbacksRef = useRef({ onError, onSuccess });
	callbacksRef.current = { onError, onSuccess };
	const stateRef = useRef<{
		epoch: number;
		hasPending: boolean;
		inFlight: boolean;
		pending: T | undefined;
	}>({ epoch: 0, hasPending: false, inFlight: false, pending: undefined });
	const [inFlight, setInFlight] = useState(false);

	const run = useCallback(async (first: T, epoch: number) => {
		let runEpoch = epoch;
		stateRef.current.inFlight = true;
		setInFlight(true);
		try {
			let current: T | undefined = first;
			let hasCurrent = true;
			while (hasCurrent) {
				const value = current as T;
				hasCurrent = false;
				current = undefined;
				let failed = false;
				let caught: unknown;
				try {
					await saveRef.current(value);
				} catch (error) {
					failed = true;
					caught = error;
				}
				if (stateRef.current.epoch !== runEpoch) {
					if (stateRef.current.hasPending) {
						runEpoch = stateRef.current.epoch;
						current = stateRef.current.pending;
						hasCurrent = true;
						stateRef.current.pending = undefined;
						stateRef.current.hasPending = false;
						continue;
					}
					stateRef.current.inFlight = false;
					setInFlight(false);
					return;
				}
				if (stateRef.current.hasPending) {
					current = stateRef.current.pending;
					hasCurrent = true;
					stateRef.current.pending = undefined;
					stateRef.current.hasPending = false;
				}
				if (failed) {
					try {
						callbacksRef.current.onError?.(caught, value);
					} catch (callbackError) {
						console.error(callbackError);
					}
				} else {
					try {
						callbacksRef.current.onSuccess?.(value);
					} catch (callbackError) {
						console.error(callbackError);
					}
				}
			}
		} finally {
			if (stateRef.current.epoch === runEpoch) {
				stateRef.current.inFlight = false;
				setInFlight(false);
			}
		}
	}, []);

	const submit = useCallback(
		(value: T) => {
			if (stateRef.current.inFlight) {
				stateRef.current.pending = value;
				stateRef.current.hasPending = true;
				return;
			}
			void run(value, stateRef.current.epoch);
		},
		[run],
	);

	const cancel = useCallback(() => {
		stateRef.current.epoch += 1;
		stateRef.current.pending = undefined;
		stateRef.current.hasPending = false;
	}, []);

	return { cancel, inFlight, submit };
}
