import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { type Poll, votePoll } from "#/lib/client";
import { PollsSection } from "./polls";

vi.mock("#/lib/client", async (importOriginal) => {
	const mod = await importOriginal<typeof import("#/lib/client")>();
	return { ...mod, votePoll: vi.fn().mockResolvedValue({ pollId: "p1" }) };
});

function singlePoll(): Poll[] {
	return [
		{
			allowMultiple: false,
			id: "p1",
			options: [
				{ count: 1, id: "o1", label: "Pizza", names: ["Ada"] },
				{ count: 0, id: "o2", label: "Sushi", names: [] },
			],
			question: "Where?",
			totalVoters: 1,
		},
	];
}

function twoPolls(): Poll[] {
	return [
		...singlePoll(),
		{
			allowMultiple: true,
			id: "p2",
			options: [
				{ count: 0, id: "o3", label: "Mon", names: [] },
				{ count: 0, id: "o4", label: "Tue", names: [] },
			],
			question: "When?",
			totalVoters: 0,
		},
	];
}

function wrapper(children: ReactNode) {
	const client = new QueryClient();
	return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

test("single poll shows question, counts, percentages and voter names", async () => {
	const screen = await render(
		wrapper(
			<PollsSection
				activeName="Ada"
				eventId="e1"
				password=""
				polls={singlePoll()}
				signedIn
			/>,
		),
	);
	await expect
		.element(screen.getByRole("heading", { name: "Where?" }))
		.toBeVisible();
	await expect.element(screen.getByText("Pizza")).toBeVisible();
	await expect.element(screen.getByText("1 · 100%")).toBeVisible();
	await expect.element(screen.getByText("0 · 0%")).toBeVisible();
	await expect.element(screen.getByText("Ada")).toBeVisible();
	await expect.element(screen.getByText("No votes yet")).toBeVisible();
});

test("clicking a multi-choice option row votes for that option", async () => {
	const screen = await render(
		wrapper(
			<PollsSection
				activeName="Bo"
				eventId="e1"
				password=""
				polls={twoPolls()}
				signedIn
			/>,
		),
	);
	await screen.getByText("Mon").click();
	await vi.waitFor(() => {
		expect(vi.mocked(votePoll)).toHaveBeenCalledWith("e1", "p2", {
			name: "Bo",
			optionIds: ["o3"],
			password: undefined,
		});
	});
});

test("unsigned users see sign-in prompt and disabled options", async () => {
	const screen = await render(
		wrapper(
			<PollsSection
				activeName=""
				eventId="e1"
				password=""
				polls={singlePoll()}
				signedIn={false}
			/>,
		),
	);
	await expect.element(screen.getByText("Sign in to vote.")).toBeVisible();
	await expect
		.element(screen.getByText("Sign in to add a poll."))
		.toBeVisible();
	await expect
		.element(screen.getByRole("radio", { name: /Pizza/ }))
		.toBeDisabled();
});

test("clicking anywhere on an option row votes for that option", async () => {
	const screen = await render(
		wrapper(
			<PollsSection
				activeName="Bo"
				eventId="e1"
				password=""
				polls={singlePoll()}
				signedIn
			/>,
		),
	);
	await screen.getByText("No votes yet").click();
	await vi.waitFor(() => {
		expect(vi.mocked(votePoll)).toHaveBeenCalledWith("e1", "p1", {
			name: "Bo",
			optionIds: ["o2"],
			password: undefined,
		});
	});
});
