import { useCallback, useRef, useState } from "react";

export function useSerialSaver<T>(options: {
	save: (value: T) => Promise<void>;
	onSuccess?: (value: T) => void;
	onError?: (error: unknown, value: T) => void;
}): { inFlight: boolean; submit: (value: T) => void } {
	const { onError, onSuccess, save } = options;
	const saveRef = useRef(save);
	saveRef.current = save;
	const callbacksRef = useRef({ onError, onSuccess });
	callbacksRef.current = { onError, onSuccess };
	const stateRef = useRef<{
		hasPending: boolean;
		inFlight: boolean;
		pending: T | undefined;
	}>({ hasPending: false, inFlight: false, pending: undefined });
	const [inFlight, setInFlight] = useState(false);

	const run = useCallback(async (first: T) => {
		stateRef.current.inFlight = true;
		setInFlight(true);
		let current: T | undefined = first;
		let hasCurrent = true;
		while (hasCurrent) {
			const value = current as T;
			hasCurrent = false;
			current = undefined;
			try {
				await saveRef.current(value);
				callbacksRef.current.onSuccess?.(value);
			} catch (error) {
				callbacksRef.current.onError?.(error, value);
			}
			if (stateRef.current.hasPending) {
				current = stateRef.current.pending;
				hasCurrent = true;
				stateRef.current.pending = undefined;
				stateRef.current.hasPending = false;
			}
		}
		stateRef.current.inFlight = false;
		setInFlight(false);
	}, []);

	const submit = useCallback(
		(value: T) => {
			if (stateRef.current.inFlight) {
				stateRef.current.pending = value;
				stateRef.current.hasPending = true;
				return;
			}
			void run(value);
		},
		[run],
	);

	return { inFlight, submit };
}
