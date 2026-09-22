import { describe, expect, it, vi } from "vitest";
import {
	createEvent,
	fetchEventDetail,
	fetchOwnAvailability,
	HttpError,
	saveAvailability,
} from "./client";

function jsonResponse(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		headers: { "Content-Type": "application/json" },
		status,
	});
}

function requestOf(mock: ReturnType<typeof vi.fn>, index = 0): Request {
	const [req] = mock.mock.calls[index] as unknown as [Request];
	return req;
}

describe("api client", () => {
	it("creates events", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			jsonResponse(
				{
					event: {
						createdAt: "2026-09-22T00:00:00.000Z",
						dates: ["2026-10-05"],
						endTime: "17:00",
						expiresAt: "2026-10-06T00:00:00.000Z",
						id: "x",
						startTime: "09:00",
						timezone: "UTC",
						title: "T",
					},
					id: "x",
					url: "http://localhost/e/x",
				},
				201,
			),
		);
		vi.stubGlobal("fetch", fetchMock);
		try {
			const res = await createEvent({
				dates: ["2026-10-05"],
				endTime: "17:00",
				startTime: "09:00",
				timezone: "UTC",
				title: "T",
			});
			expect(res.id).toBe("x");
			const req = requestOf(fetchMock);
			expect(req.url).toContain("/api/events");
			expect(req.method).toBe("POST");
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it("throws HttpError with code on failure", async () => {
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValue(
					jsonResponse({ error: { code: "gone", message: "Expired" } }, 410),
				),
		);
		try {
			await expect(fetchEventDetail("AbC123_-XyZ9")).rejects.toMatchObject({
				code: "gone",
				status: 410,
			});
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it("saves and loads availability", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			jsonResponse({
				count: 1,
				name: "Al",
				protected: false,
				updatedAt: "2026-09-22T00:00:00.000Z",
			}),
		);
		vi.stubGlobal("fetch", fetchMock);
		try {
			await saveAvailability("AbC123_-XyZ9", { name: "Al", slots: [] });
			const putReq = requestOf(fetchMock);
			expect(putReq.url).toContain("/api/events/AbC123_-XyZ9/availability");
			expect(putReq.method).toBe("PUT");
			fetchMock.mockResolvedValue(jsonResponse({ name: "Al", slots: [] }));
			await fetchOwnAvailability("AbC123_-XyZ9", "Al", "pw");
			const getReq = requestOf(fetchMock, 1);
			expect(getReq.url).toContain(
				"/api/events/AbC123_-XyZ9/availability?name=Al",
			);
			expect(getReq.headers.get("x-event-password")).toBe("pw");
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it("HttpError carries status and code", () => {
		expect(new HttpError(401, "invalid_password", "nope").message).toBe("nope");
	});
});
