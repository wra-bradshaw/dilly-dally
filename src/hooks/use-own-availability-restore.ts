import { useEffect, useRef, useState } from "react";
import { fetchOwnAvailability } from "#/lib/client";
import { HttpError } from "#/lib/http-error";

export type OwnAvailabilityRestoreStatus =
	| "idle"
	| "restoring"
	| "needs-password"
	| "ready"
	| "gone"
	| "failed";

export interface OwnAvailabilityRestoreResult {
	name: string;
	slots: string[];
}

export function useOwnAvailabilityRestore(options: {
	eventId: string;
	storedName: string;
	eventSettled?: boolean;
	fetchAvailability?: typeof fetchOwnAvailability;
	onRestored: (own: OwnAvailabilityRestoreResult) => void;
	onNeedsPassword?: (name: string) => void;
	onCleared?: () => void;
	onGone?: () => void;
}): { retry: () => void; status: OwnAvailabilityRestoreStatus } {
	const {
		eventId,
		eventSettled = true,
		fetchAvailability = fetchOwnAvailability,
		onCleared,
		onGone,
		onNeedsPassword,
		onRestored,
		storedName,
	} = options;
	const [status, setStatus] = useState<OwnAvailabilityRestoreStatus>(() =>
		storedName.trim() === "" ? "idle" : "restoring",
	);
	const callbacksRef = useRef({
		onCleared,
		onGone,
		onNeedsPassword,
		onRestored,
	});
	useEffect(() => {
		callbacksRef.current = { onCleared, onGone, onNeedsPassword, onRestored };
	});
	useEffect(() => {
		if (status !== "restoring") return;
		if (!eventSettled) return;
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
				} else if (
					err instanceof HttpError &&
					err.code === "availability_not_found"
				) {
					callbacksRef.current.onCleared?.();
					setStatus("ready");
				} else if (
					err instanceof HttpError &&
					(err.code === "gone" ||
						err.status === 410 ||
						err.status === 403 ||
						(err.status === 404 && err.code !== "availability_not_found"))
				) {
					callbacksRef.current.onGone?.();
					setStatus("gone");
				} else {
					setStatus("failed");
				}
			},
		);
		return () => {
			cancelled = true;
		};
	}, [status, eventId, storedName, fetchAvailability, eventSettled]);
	return {
		retry: () => {
			if (status === "gone") return;
			setStatus("restoring");
		},
		status,
	};
}
