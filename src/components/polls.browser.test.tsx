import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import type { Poll } from "#/lib/client";
import { PollsSection } from "./polls";

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

function wrapper(children: React.ReactNode) {
	const client = new QueryClient();
	return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

test("single poll shows question, counts and voter names", async () => {
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
	await expect.element(screen.getByText("Ada")).toBeVisible();
	await expect.element(screen.getByText("Pizza · 1")).toBeVisible();
});

test("multiple polls show both questions", async () => {
	const screen = await render(
		wrapper(
			<PollsSection
				activeName="Ada"
				eventId="e1"
				password=""
				polls={twoPolls()}
				signedIn
			/>,
		),
	);
	await expect
		.element(screen.getByRole("heading", { name: "Where?" }))
		.toBeVisible();
	await expect
		.element(screen.getByRole("heading", { name: "When?" }))
		.toBeVisible();
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
});
