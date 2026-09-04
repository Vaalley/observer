import { Colors } from "discord.js";
import {
	buildLeaderboardEmbed,
	buildPassportEmbed,
	formatDistance,
	formatDistanceBuckets,
	passportColor,
} from "./passport.ts";

function assertEqual<T>(actual: T, expected: T): void {
	if (actual !== expected) {
		throw new Error(`Expected ${String(expected)}, got ${String(actual)}`);
	}
}

function assert(condition: boolean, message: string): void {
	if (!condition) throw new Error(message);
}

const fixture = {
	name: "Traveler*",
	firstJoin: Date.UTC(2025, 0, 2),
	biomes: ["minecraft:plains"],
	biomeCount: 1,
	dimensions: ["minecraft:overworld", "minecraft:the_nether"],
	regions: [
		{ id: "one", title: "Home", embassy: true, owner: "Owner", at: 1 },
		{ id: "two", title: "Wild", embassy: false, owner: null, at: 2 },
	],
	distance: { walk: 12_400, ride: 3_100, fly: 800, swim: 120, total: 16_420 },
	deaths: 2,
	rank: { distance: 3, biomes: 4, embassies: 2 },
};

Deno.test("formatDistance formats meters and kilometers", () => {
	assertEqual(formatDistance(0), "0 m");
	assertEqual(formatDistance(999), "999 m");
	assertEqual(formatDistance(1000), "1.0 km");
	assertEqual(formatDistance(12_440), "12.4 km");
});

Deno.test("formatDistanceBuckets omits zero buckets", () => {
	assertEqual(
		formatDistanceBuckets({ walk: 0, ride: 3_100, fly: 0, swim: 120, total: 3_220 }),
		"🐎 3.1 km · 🏊 120 m",
	);
	assertEqual(
		formatDistanceBuckets({ walk: 0, ride: 0, fly: 0, swim: 0, total: 0 }),
		"Hasn't moved yet",
	);
});

Deno.test("passportColor prioritizes the rarest dimension", () => {
	assertEqual(passportColor(["minecraft:overworld"]), Colors.Green);
	assertEqual(passportColor(["minecraft:the_nether"]), Colors.Red);
	assertEqual(passportColor(["minecraft:the_nether", "minecraft:the_end"]), Colors.Purple);
});

Deno.test("buildPassportEmbed summarizes regions and rank", () => {
	const embed = buildPassportEmbed(fixture, Date.UTC(2025, 0, 3)).toJSON();
	assertEqual(embed.title, "🛂 Passport — Traveler\\*");
	assertEqual(embed.color, Colors.Red);
	assert(embed.fields !== undefined, "passport embed should have fields");
	assert(
		embed.fields?.some((field) =>
			field.name === "Regions" && field.value === "2 visited · 1 embassies"
		) === true,
		"passport embed should show region and embassy counts",
	);
	assert(
		embed.footer?.text?.includes("#3 by distance") === true,
		"footer should show distance rank",
	);
	assertEqual(embed.timestamp, "2025-01-03T00:00:00.000Z");
});

Deno.test("buildLeaderboardEmbed uses medals, numbering, and empty state", () => {
	const embed = buildLeaderboardEmbed("distance", [
		{ name: "One*", value: 12_400 },
		{ name: "Two", value: 2_000 },
		{ name: "Three", value: 1_000 },
		{ name: "Four", value: 999 },
	]).toJSON();
	assertEqual(
		embed.description,
		"🥇 One\\* — 12.4 km\n🥈 Two — 2.0 km\n🥉 Three — 1.0 km\n4. Four — 999 m",
	);
	assertEqual(
		buildLeaderboardEmbed("biomes", []).toJSON().description,
		"No travelers yet.",
	);
});
