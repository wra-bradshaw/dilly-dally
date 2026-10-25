import { useCallback, useState } from "react";
import { createEventSession, fetchOwnAvailability } from "#/lib/client";
import { decideSignInError } from "#/lib/event-messages";

export interface UseEventSignInOptions {
	eventId: string;
	name: string;
	setName: (value: string) => void;
	password: string;
	setPassword: (value: string) => void;
	setActiveName: (value: string) => void;
	setStoredName: (value: string) => void;
	setSelected: (value: Set<string>) => void;
	setSignedIn: (value: boolean) => void;
	lastSavedRef: { current: Set<string> };
	createSession?: typeof createEventSession;
	fetchOwn?: typeof fetchOwnAvailability;
	invalidateOwnSession?: () => unknown;
}

export function useEventSignIn(options: UseEventSignInOptions): {
	signing: boolean;
	signError: string;
	setSignError: (value: string) => void;
	signIn: () => Promise<void>;
} {
	const {
		createSession = createEventSession,
		eventId,
		fetchOwn = fetchOwnAvailability,
		invalidateOwnSession,
		lastSavedRef,
		name,
		password,
		setActiveName,
		setName,
		setPassword,
		setSelected,
		setSignedIn,
		setStoredName,
	} = options;
	const [signError, setSignError] = useState("");
	const [signing, setSigning] = useState(false);

	const signIn = useCallback(async () => {
		if (signing) return;
		setSignError("");
		if (!name.trim()) {
			setSignError("Enter your name to continue.");
			return;
		}
		if (password !== "" && password.length < 4) {
			setSignError("Password must be at least 4 characters.");
			return;
		}
		setSigning(true);
		try {
			const session = await createSession(eventId, {
				name: name.trim(),
				password: password === "" ? undefined : password,
			});
			const own = await fetchOwn(eventId, session.name, undefined);
			lastSavedRef.current = new Set(own.slots);
			setSelected(new Set(own.slots));
			setActiveName(own.name);
			setStoredName(own.name);
			setName(own.name);
			setPassword("");
			await invalidateOwnSession?.();
		} catch (err) {
			const decision = decideSignInError(err);
			if (decision.kind === "message") {
				setSignError(decision.text);
				return;
			}
			try {
				const own = await fetchOwn(
					eventId,
					name.trim(),
					password === "" ? undefined : password,
				);
				lastSavedRef.current = new Set(own.slots);
				setSelected(new Set(own.slots));
				setActiveName(own.name);
				setStoredName(own.name);
			} catch (inner) {
				const fallback = decideSignInError(inner);
				if (fallback.kind === "message") {
					setSignError(fallback.text);
					return;
				}
				lastSavedRef.current = new Set();
				setSelected(new Set());
				setActiveName(name.trim());
				setStoredName(name.trim());
			}
		} finally {
			setSigning(false);
		}
		setSignedIn(true);
	}, [
		createSession,
		eventId,
		fetchOwn,
		invalidateOwnSession,
		lastSavedRef,
		name,
		password,
		setActiveName,
		setName,
		setPassword,
		setSelected,
		setSignedIn,
		setStoredName,
		signing,
	]);

	return { setSignError, signError, signIn, signing };
}
