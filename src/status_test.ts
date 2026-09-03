import {
	formatDuration,
	formatPlayerSessions,
	statusFields,
	weatherLabel,
	worldTimeLabel,
} from "./status.ts";

function assertEqual<T>(actual: T, expected: T): void {
	if (actual !== expected) {
		throw new Error(`Expected ${String(expected)}, got ${String(actual)}`);
	}
}

function assert(condition: boolean, message: string): void {
	if (!condition) throw new Error(message);
}

Deno.test("formatDuration formats minute, hour, and day durations", () => {
	assertEqual(formatDuration(0), "<1m");
	assertEqual(formatDuration(12 * 60_000), "12m");
	assertEqual(formatDuration(2 * 60 * 60_000 + 15 * 60_000), "2h 15m");
	assertEqual(formatDuration(3 * 24 * 60 * 60_000 + 4 * 60 * 60_000), "3d 4h");
	assertEqual(formatDuration(24 * 60 * 60_000 + 59 * 60_000), "1d");
});

Deno.test("worldTimeLabel uses the expected day phases", () => {
	assertEqual(worldTimeLabel(0), "☀️ Day");
	assertEqual(worldTimeLabel(11_999), "☀️ Day");
	assertEqual(worldTimeLabel(12_000), "🌇 Dusk");
	assertEqual(worldTimeLabel(13_800), "🌙 Night");
	assertEqual(worldTimeLabel(22_300), "🌅 Dawn");
});

Deno.test("weatherLabel prioritizes thunderstorms", () => {
	assertEqual(weatherLabel(false, false), "☀️ Clear");
	assertEqual(weatherLabel(true, false), "🌧️ Rain");
	assertEqual(weatherLabel(false, true), "⛈️ Thunderstorm");
	assertEqual(weatherLabel(true, true), "⛈️ Thunderstorm");
});

Deno.test("formatPlayerSessions includes durations and unknown join times", () => {
	const now = Date.UTC(2025, 0, 1, 12);
	const sessions = [
		{ name: "Zed", joinedAt: null },
		{ name: "Ada", joinedAt: now - (2 * 60 * 60_000 + 15 * 60_000) },
	];

	assertEqual(formatPlayerSessions(sessions, now), "Ada (2h 15m), Zed");
});

Deno.test("formatPlayerSessions truncates within the embed field limit", () => {
	const sessions = Array.from({ length: 150 }, (_, index) => ({
		name: `Player${String(index).padStart(3, "0")}`,
		joinedAt: null,
	}));
	const formatted = formatPlayerSessions(sessions);

	assert(formatted.length <= 1024, "formatted sessions exceed the embed field limit");
	assert(
		/, and \d+ more$/.test(formatted),
		"formatted sessions should include a truncation suffix",
	);
});

Deno.test("statusFields omits optional status fields when absent", () => {
	const fields = statusFields({
		online: 1,
		players: ["Ada"],
		tps: 20,
	});

	assertEqual(
		fields.map((field) => field.name).join(", "),
		"Players Online (1), Server Performance",
	);
});
