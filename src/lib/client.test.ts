import { describe, expect, it, vi } from "vitest";
import {
	createEvent,
	fetchEventDetail,
	fetchOwnAvailability,
	HttpError,
	saveAvailability,
} from "./client";

function jsonResponse(body: unknown, status = 200) {
	return { json: () => Promise.resolve(body), ok: status < 400, status };
}

describe("api client", () => {
	it("creates events", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(jsonResponse({ id: "x", url: "y" }, 201));
		vi.stubGlobal("fetch", fetchMock);
		try {
			const res = await createEvent({
				dates: ["2026-10-05"],
				endTime: "17:00",
				startTime: "09:00",
				timezone: "UTC",
				title: "T",
			});
			expect(res).toEqual({ id: "x", url: "y" });
			expect(fetchMock).toHaveBeenCalledWith(
				"/api/events",
				expect.objectContaining({ method: "POST" }),
			);
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
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ count: 1 }));
		vi.stubGlobal("fetch", fetchMock);
		try {
			await saveAvailability("AbC123_-XyZ9", { name: "Al", slots: [] });
			expect(fetchMock).toHaveBeenCalledWith(
				"/api/events/AbC123_-XyZ9/availability",
				expect.objectContaining({ method: "PUT" }),
			);
			await fetchOwnAvailability("AbC123_-XyZ9", "Al", "pw");
			expect(fetchMock).toHaveBeenLastCalledWith(
				"/api/events/AbC123_-XyZ9/availability?name=Al",
				expect.objectContaining({
					headers: expect.objectContaining({ "x-event-password": "pw" }),
				}),
			);
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it("HttpError carries status and code", () => {
		expect(new HttpError(401, "invalid_password", "nope").message).toBe("nope");
	});
});
