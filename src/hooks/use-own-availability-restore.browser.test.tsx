import { useState } from "react";
import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { AvailabilityGrid } from "../components/availability-grid";
import { buildColumns } from "../components/grid-model";
import { HttpError } from "../lib/client";
import { useLocalStorage } from "./use-local-storage";
import { useOwnAvailabilityRestore } from "./use-own-availability-restore";

const eventId = "AbC123_-XyZ9";
const nameKey = `dd:${eventId}:name`;

type FetchAvailability = (
	eventId: string,
	name: string,
	password: string | undefined,
) => Promise<{ name: string; slots: string[] }>;

function columns() {
	return buildColumns(["2026-09-28T09:00", "2026-09-28T09:15"], "UTC", "UTC");
}

function Harness({
	fetchAvailability,
}: {
	fetchAvailability: FetchAvailability;
}) {
	const [storedName, setStoredName] = useLocalStorage(nameKey, "");
	const [name, setName] = useState(storedName);
	const [password, setPassword] = useState("");
	const [signedIn, setSignedIn] = useState(storedName.trim() !== "");
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const { status } = useOwnAvailabilityRestore({
		eventId,
		fetchAvailability,
		onCleared: () => setSelected(new Set()),
		onNeedsPassword: (restoredName) => {
			setName(restoredName);
			setSignedIn(false);
		},
		onRestored: (own) => {
			setSelected(new Set(own.slots));
			setStoredName(own.name);
			setSignedIn(true);
		},
		storedName,
	});
	return (
		<div>
			{signedIn ? (
				<div>
					<button
						onClick={() => {
							setSignedIn(false);
							setPassword("");
							setSelected(new Set());
							setStoredName("");
							setName("");
						}}
						type="button"
					>
						Switch user
					</button>
				</div>
			) : (
				<div>
					<p>Enter your password to continue.</p>
					<label htmlFor="who-name">Your name</label>
					<input
						id="who-name"
						onChange={(e) => setName(e.target.value)}
						value={name}
					/>
					<label htmlFor="who-pass">Password</label>
					<input
						id="who-pass"
						onChange={(e) => setPassword(e.target.value)}
						type="password"
						value={password}
					/>
				</div>
			)}
			{status === "restoring" && <p>Restoring…</p>}
			<AvailabilityGrid
				columns={columns()}
				disabled={status === "restoring"}
				onCommit={setSelected}
				selected={selected}
			/>
		</div>
	);
}

test("preset name restores cells after reload with a Restoring state", async () => {
	localStorage.clear();
	localStorage.setItem(nameKey, "Ada");
	let resolveFetch!: (value: { name: string; slots: string[] }) => void;
	const fetchAvailability = vi.fn(
		() =>
			new Promise<{ name: string; slots: string[] }>((resolve) => {
				resolveFetch = resolve;
			}),
	);
	const screen = await render(
		<Harness fetchAvailability={fetchAvailability} />,
	);
	await expect.element(screen.getByText("Restoring…")).toBeVisible();
	const cell = screen.getByRole("button", { name: "Mon, 9/28 9:00 AM" });
	await expect.element(cell).toBeDisabled();
	resolveFetch({ name: "Ada", slots: ["2026-09-28T09:00"] });
	await expect.element(cell).toHaveAttribute("aria-pressed", "true");
	expect(fetchAvailability).toHaveBeenCalledWith(eventId, "Ada", undefined);
});

test("protected name prompts for password without persisting it", async () => {
	localStorage.clear();
	localStorage.setItem(nameKey, "Ada");
	const fetchAvailability = vi
		.fn()
		.mockRejectedValue(
			new HttpError(401, "invalid_password", "Wrong password"),
		);
	const screen = await render(
		<Harness fetchAvailability={fetchAvailability} />,
	);
	await expect
		.element(screen.getByText("Enter your password to continue."))
		.toBeVisible();
	await expect.element(screen.getByLabelText("Your name")).toHaveValue("Ada");
	expect(localStorage.getItem(`dd:${eventId}:password`)).toBeNull();
	for (let i = 0; i < localStorage.length; i += 1) {
		const storedKey = localStorage.key(i) ?? "";
		expect(localStorage.getItem(storedKey)).not.toContain("s3cret-pw");
	}
});

test("switch user clears selection and the stored name", async () => {
	localStorage.clear();
	localStorage.setItem(nameKey, "Ada");
	const fetchAvailability = vi.fn().mockResolvedValue({
		name: "Ada",
		slots: ["2026-09-28T09:00"],
	});
	const screen = await render(
		<Harness fetchAvailability={fetchAvailability} />,
	);
	const cell = screen.getByRole("button", { name: "Mon, 9/28 9:00 AM" });
	await expect.element(cell).toHaveAttribute("aria-pressed", "true");
	await screen.getByRole("button", { name: "Switch user" }).click();
	await expect.element(cell).toHaveAttribute("aria-pressed", "false");
	expect(localStorage.getItem(nameKey)).toBe("");
});

function RetryHarness({
	fetchAvailability,
}: {
	fetchAvailability: FetchAvailability;
}) {
	const [storedName] = useLocalStorage(nameKey, "");
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const { retry, status } = useOwnAvailabilityRestore({
		eventId,
		fetchAvailability,
		onCleared: () => setSelected(new Set()),
		onRestored: (own) => setSelected(new Set(own.slots)),
		storedName,
	});
	return (
		<div>
			{status === "failed" && (
				<p>
					Could not restore your availability.{" "}
					<button onClick={retry} type="button">
						Retry
					</button>
				</p>
			)}
			<AvailabilityGrid
				columns={columns()}
				disabled={status === "restoring" || status === "failed"}
				onCommit={setSelected}
				selected={selected}
			/>
		</div>
	);
}

test("failed restore shows retry and recovers on retry", async () => {
	localStorage.clear();
	localStorage.setItem(nameKey, "Ada");
	const fetchAvailability = vi
		.fn()
		.mockRejectedValueOnce(new TypeError("offline"))
		.mockResolvedValueOnce({ name: "Ada", slots: ["2026-09-28T09:00"] });
	const screen = await render(
		<RetryHarness fetchAvailability={fetchAvailability} />,
	);
	await expect
		.element(screen.getByText(/Could not restore your availability/))
		.toBeVisible();
	const cell = screen.getByRole("button", { name: "Mon, 9/28 9:00 AM" });
	await expect.element(cell).toBeDisabled();
	await screen.getByRole("button", { name: "Retry" }).click();
	await expect.element(cell).toHaveAttribute("aria-pressed", "true");
	expect(fetchAvailability).toHaveBeenCalledTimes(2);
});
