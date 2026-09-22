import { useEffect, useRef, useState } from "react";
import { fetchOwnAvailability, HttpError } from "#/lib/client";

export type OwnAvailabilityRestoreStatus =
	| "idle"
	| "restoring"
	| "needs-password"
	| "ready";

export interface OwnAvailabilityRestoreResult {
	name: string;
	slots: string[];
}

export function useOwnAvailabilityRestore(options: {
	eventId: string;
	storedName: string;
	fetchAvailability?: typeof fetchOwnAvailability;
	onRestored: (own: OwnAvailabilityRestoreResult) => void;
	onNeedsPassword?: (name: string) => void;
	onCleared?: () => void;
}): OwnAvailabilityRestoreStatus {
	const {
		eventId,
		fetchAvailability = fetchOwnAvailability,
		onCleared,
		onNeedsPassword,
		onRestored,
		storedName,
	} = options;
	const [status, setStatus] = useState<OwnAvailabilityRestoreStatus>(() =>
		storedName.trim() === "" ? "idle" : "restoring",
	);
	const callbacksRef = useRef({ onCleared, onNeedsPassword, onRestored });
	useEffect(() => {
		callbacksRef.current = { onCleared, onNeedsPassword, onRestored };
	});
	useEffect(() => {
		if (status !== "restoring") return;
		const name = storedName.trim();
		if (name === "") {
			setStatus("idle");
			return;
		}
		let cancelled = false;
		fetchAvailability(eventId, name, undefined).then(
			(own) => {
				if (cancelled) return;
				callbacksRef.current.onRestored({ name: own.name, slots: own.slots });
				setStatus("ready");
			},
			(err: unknown) => {
				if (cancelled) return;
				if (err instanceof HttpError && err.code === "invalid_password") {
					callbacksRef.current.onNeedsPassword?.(name);
					setStatus("needs-password");
				} else if (err instanceof HttpError && err.status === 404) {
					callbacksRef.current.onCleared?.();
					setStatus("ready");
				} else {
					setStatus("ready");
				}
			},
		);
		return () => {
			cancelled = true;
		};
	}, [status, eventId, storedName, fetchAvailability]);
	return status;
}
