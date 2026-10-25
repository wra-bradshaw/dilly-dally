import { useState } from "react";
import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { AvailabilityGrid } from "../components/availability-grid";
import { buildColumns } from "../components/grid-model";
import { HttpError } from "../lib/http-error";
import { useHydrateOnce } from "./use-hydrate-once";
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
	return buildColumns(["2026-09-28T09:00", "2026-09-28T09:30"], {
		eventTimezone: "UTC",
		mode: "dates",
		viewTimezone: "UTC",
	});
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
			{status === "restoring" ? (
				<p aria-live="polite">Restoring…</p>
			) : (
				<p aria-live="polite" className="sr-only">
					{""}
				</p>
			)}
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
	await expect.element(cell).toHaveAttribute("aria-disabled", "true");
	expect(cell.element().hasAttribute("disabled")).toBe(false);
	(cell.element() as HTMLButtonElement).focus();
	await expect.element(cell).toHaveFocus();
	const restoringReason = (
		cell.element().getAttribute("aria-describedby") ?? ""
	)
		.split(" ")
		.map(
			(id) =>
				screen.container.querySelector(`#${CSS.escape(id)}`)?.textContent ?? "",
		)
		.join(" ");
	expect(restoringReason).toContain("temporarily unavailable");
	resolveFetch({ name: "Ada", slots: ["2026-09-28T09:00"] });
	await expect.element(cell).toHaveAttribute("aria-pressed", "true");
	expect(fetchAvailability).toHaveBeenCalledWith(eventId, "Ada", undefined);
});

test("restore live region is pre-mounted outside the sign-in branch", async () => {
	localStorage.clear();
	const fetchAvailability = vi.fn();
	const screen = await render(
		<Harness fetchAvailability={fetchAvailability} />,
	);
	await expect
		.element(screen.getByText("Enter your password to continue."))
		.toBeVisible();
	const regions = screen.container.querySelectorAll('p[aria-live="polite"]');
	expect(regions).toHaveLength(1);
	expect(regions[0]?.className).toContain("sr-only");
	expect(fetchAvailability).not.toHaveBeenCalled();
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
	await expect.element(cell).toHaveAttribute("aria-disabled", "true");
	expect(cell.element().hasAttribute("disabled")).toBe(false);
	(cell.element() as HTMLButtonElement).focus();
	await expect.element(cell).toHaveFocus();
	const retryReason = (cell.element().getAttribute("aria-describedby") ?? "")
		.split(" ")
		.map(
			(id) =>
				screen.container.querySelector(`#${CSS.escape(id)}`)?.textContent ?? "",
		)
		.join(" ");
	expect(retryReason).toContain("temporarily unavailable");
	await screen.getByRole("button", { name: "Retry" }).click();
	await expect.element(cell).toHaveAttribute("aria-pressed", "true");
	expect(fetchAvailability).toHaveBeenCalledTimes(2);
});

function GoneHarness({
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
	const gone = status === "gone";
	return (
		<div>
			{gone && <p>This event has expired. Reload the page.</p>}
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
				disabled={status === "restoring" || status === "failed" || gone}
				onCommit={setSelected}
				selected={selected}
			/>
		</div>
	);
}

test("expired event shows gone banner with disabled grid and no retry", async () => {
	localStorage.clear();
	localStorage.setItem(nameKey, "Ada");
	const fetchAvailability = vi
		.fn()
		.mockRejectedValue(new HttpError(410, "gone", "Event has expired"));
	const screen = await render(
		<GoneHarness fetchAvailability={fetchAvailability} />,
	);
	await expect
		.element(screen.getByText("This event has expired. Reload the page."))
		.toBeVisible();
	const cell = screen.getByRole("button", { name: "Mon, 9/28 9:00 AM" });
	await expect.element(cell).toHaveAttribute("aria-disabled", "true");
	expect(cell.element().hasAttribute("disabled")).toBe(false);
	(cell.element() as HTMLButtonElement).focus();
	await expect.element(cell).toHaveFocus();
	const goneReason = (cell.element().getAttribute("aria-describedby") ?? "")
		.split(" ")
		.map(
			(id) =>
				screen.container.querySelector(`#${CSS.escape(id)}`)?.textContent ?? "",
		)
		.join(" ");
	expect(goneReason).toContain("temporarily unavailable");
	expect(screen.getByRole("button", { name: "Retry" }).all()).toHaveLength(0);
	expect(fetchAvailability).toHaveBeenCalledTimes(1);
});

function ClearingHarness({
	fetchAvailability,
}: {
	fetchAvailability: FetchAvailability;
}) {
	const [storedName, setStoredName] = useState("Ada");
	const [settled] = useState(false);
	const { status } = useOwnAvailabilityRestore({
		eventId,
		eventSettled: settled,
		fetchAvailability,
		onRestored: () => {},
		storedName,
	});
	return (
		<div>
			<p data-testid="restore-status">{status}</p>
			<button
				data-testid="clear-name"
				onClick={() => setStoredName("")}
				type="button"
			>
				clear
			</button>
		</div>
	);
}

test("clearing the stored name while unsettled resolves to idle", async () => {
	localStorage.clear();
	const fetchAvailability = vi.fn();
	const screen = await render(
		<ClearingHarness fetchAvailability={fetchAvailability} />,
	);
	await expect
		.element(screen.getByTestId("restore-status"))
		.toHaveTextContent("restoring");
	expect(fetchAvailability).not.toHaveBeenCalled();
	await screen.getByTestId("clear-name").click();
	await expect
		.element(screen.getByTestId("restore-status"))
		.toHaveTextContent("idle");
	expect(fetchAvailability).not.toHaveBeenCalled();
});

function LateSessionHarness({
	fetchAvailability,
}: {
	fetchAvailability: FetchAvailability;
}) {
	const [storedName] = useLocalStorage(nameKey, "");
	const [session, setSession] = useState<null | {
		name: string;
		slots: string[];
	}>(null);
	const [sessionSettled, setSessionSettled] = useState(false);
	const [detailPending] = useState(false);
	const [hadStoredNameAtMount] = useState(() => storedName.trim() !== "");
	const [signedIn, setSignedIn] = useState(storedName.trim() !== "");
	const [activeName, setActiveName] = useState(storedName.trim());
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const restoreName = session ? "" : storedName;
	const { status } = useOwnAvailabilityRestore({
		eventId,
		eventSettled: !detailPending && sessionSettled,
		fetchAvailability,
		onRestored: (own) => {
			setSelected(new Set(own.slots));
			setActiveName(own.name);
			setSignedIn(true);
		},
		storedName: restoreName,
	});
	const hydrateSource =
		hadStoredNameAtMount &&
		signedIn &&
		session !== null &&
		storedName.trim().toLowerCase() === session.name.trim().toLowerCase()
			? session
			: null;
	useHydrateOnce(hydrateSource, (arrived) => {
		setSelected(new Set(arrived.slots));
		setActiveName(arrived.name);
		setSignedIn(true);
	});
	return (
		<div>
			<p data-testid="restore-status">{status}</p>
			<p data-testid="active-name">
				{activeName === "" ? "(empty)" : activeName}
			</p>
			<button
				data-testid="session-arrives"
				onClick={() => {
					setSession({ name: "Ada", slots: ["2026-09-28T09:00"] });
					setSessionSettled(true);
				}}
				type="button"
			>
				session arrives
			</button>
			<AvailabilityGrid
				columns={columns()}
				disabled={status === "restoring"}
				onCommit={setSelected}
				selected={selected}
			/>
		</div>
	);
}

test("late session arrival hydrates selection and settles to idle without fetching", async () => {
	localStorage.clear();
	localStorage.setItem(nameKey, "Ada");
	const fetchAvailability = vi.fn().mockResolvedValue({
		name: "Ada",
		slots: ["2026-09-28T09:00"],
	});
	const screen = await render(
		<LateSessionHarness fetchAvailability={fetchAvailability} />,
	);
	await expect
		.element(screen.getByTestId("restore-status"))
		.toHaveTextContent("restoring");
	expect(fetchAvailability).not.toHaveBeenCalled();
	await screen.getByTestId("session-arrives").click();
	const cell = screen.getByRole("button", { name: "Mon, 9/28 9:00 AM" });
	await expect.element(cell).toHaveAttribute("aria-pressed", "true");
	await expect
		.element(screen.getByTestId("restore-status"))
		.toHaveTextContent("idle");
	await expect
		.element(screen.getByTestId("active-name"))
		.toHaveTextContent("Ada");
	expect(fetchAvailability).not.toHaveBeenCalled();
});

function SwitchDuringRestoreHarness({
	fetchAvailability,
}: {
	fetchAvailability: FetchAvailability;
}) {
	const [storedName, setStoredName] = useState("Ada");
	const [signedIn, setSignedIn] = useState(true);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [restoredCount, setRestoredCount] = useState(0);
	const { status } = useOwnAvailabilityRestore({
		eventId,
		eventSettled: true,
		fetchAvailability,
		onRestored: (own) => {
			setRestoredCount((c) => c + 1);
			setSelected(new Set(own.slots));
			setStoredName(own.name);
			setSignedIn(true);
		},
		storedName,
	});
	return (
		<div>
			<p data-testid="restore-status">{status}</p>
			<p data-testid="stored-name">
				{storedName === "" ? "(empty)" : storedName}
			</p>
			<p data-testid="signed-in">{signedIn ? "yes" : "no"}</p>
			<p data-testid="restored-count">{restoredCount}</p>
			<p data-testid="selected-count">{selected.size}</p>
			<button
				data-testid="switch-user"
				onClick={() => {
					setStoredName("");
					setSignedIn(false);
					setSelected(new Set());
				}}
				type="button"
			>
				switch
			</button>
		</div>
	);
}

test("switching user during restore aborts the fetch result", async () => {
	let resolveFetch!: (value: { name: string; slots: string[] }) => void;
	const fetchAvailability = vi.fn(
		() =>
			new Promise<{ name: string; slots: string[] }>((resolve) => {
				resolveFetch = resolve;
			}),
	);
	const screen = await render(
		<SwitchDuringRestoreHarness fetchAvailability={fetchAvailability} />,
	);
	await expect
		.element(screen.getByTestId("restore-status"))
		.toHaveTextContent("restoring");
	expect(fetchAvailability).toHaveBeenCalledTimes(1);
	await screen.getByTestId("switch-user").click();
	await expect
		.element(screen.getByTestId("restore-status"))
		.toHaveTextContent("idle");
	resolveFetch({ name: "Ada", slots: ["2026-09-28T09:00"] });
	await new Promise((r) => setTimeout(r, 200));
	await expect
		.element(screen.getByTestId("restored-count"))
		.toHaveTextContent("0");
	await expect
		.element(screen.getByTestId("stored-name"))
		.toHaveTextContent("(empty)");
	await expect.element(screen.getByTestId("signed-in")).toHaveTextContent("no");
	await expect
		.element(screen.getByTestId("selected-count"))
		.toHaveTextContent("0");
	expect(fetchAvailability).toHaveBeenCalledTimes(1);
});
