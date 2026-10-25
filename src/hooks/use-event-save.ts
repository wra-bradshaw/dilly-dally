import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { useSerialSaver } from "#/hooks/use-serial-saver";
import { type EventDetailResponse, saveAvailability } from "#/lib/client";
import { patchDetailForSave } from "#/lib/detail-patch";
import { saveErrorMessage } from "#/lib/event-messages";

export interface EventSavePayload {
	identity: string;
	password: string | undefined;
	slots: Set<string>;
}

export interface UseEventSaveOptions {
	eventId: string;
	signedIn: boolean;
	activeName: string;
	password: string;
	setSelected: (value: Set<string>) => void;
	lastSavedRef: { current: Set<string> };
	saveFn?: typeof saveAvailability;
}

export function useEventSave(options: UseEventSaveOptions): {
	saveState: string;
	saveFailed: boolean;
	commit: (next: Set<string>) => void;
	cancel: () => void;
	resetSave: () => void;
	lastSubmittedRef: { current: EventSavePayload | null };
} {
	const {
		activeName,
		eventId,
		lastSavedRef,
		password,
		saveFn = saveAvailability,
		setSelected,
		signedIn,
	} = options;
	const [saveState, setSaveState] = useState("");
	const [saveFailed, setSaveFailed] = useState(false);
	const lastSubmittedRef = useRef<EventSavePayload | null>(null);
	const queryClient = useQueryClient();

	const saver = useSerialSaver<EventSavePayload>({
		onError: (err, value) => {
			if (value === lastSubmittedRef.current) {
				setSelected(new Set(lastSavedRef.current));
			}
			setSaveFailed(true);
			setSaveState(saveErrorMessage(err));
		},
		onSuccess: (value) => {
			lastSavedRef.current = new Set(value.slots);
			if (value === lastSubmittedRef.current) {
				setSelected(new Set(value.slots));
			}
			setSaveFailed(false);
			setSaveState("Saved");
			if (value.identity.trim() !== "") {
				const stamp = new Date().toISOString();
				queryClient.setQueryData(
					["event", eventId],
					(old: EventDetailResponse | undefined) =>
						old
							? patchDetailForSave(old, value.identity, value.slots, stamp)
							: old,
				);
			}
		},
		save: async (value) => {
			await saveFn(eventId, {
				name: value.identity,
				password: value.password,
				slots: [...value.slots],
			});
		},
	});

	const commit = useCallback(
		(next: Set<string>) => {
			setSelected(next);
			if (!signedIn || activeName === "") return;
			setSaveFailed(false);
			setSaveState("Saving…");
			const tagged: EventSavePayload = {
				identity: activeName,
				password: password === "" ? undefined : password,
				slots: next,
			};
			lastSubmittedRef.current = tagged;
			saver.submit(tagged);
		},
		[activeName, password, saver, setSelected, signedIn],
	);

	const cancel = useCallback(() => {
		saver.cancel();
	}, [saver]);

	const resetSave = useCallback(() => {
		saver.cancel();
		lastSubmittedRef.current = null;
		setSaveState("");
		setSaveFailed(false);
	}, [saver]);

	return {
		cancel,
		commit,
		lastSubmittedRef,
		resetSave,
		saveFailed,
		saveState,
	};
}
