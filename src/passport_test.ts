import { Colors } from "discord.js";
import {
	biomeColor,
	buildLeaderboardEmbed,
	buildPassportEmbed,
	buildPostcardEmbed,
	formatDistance,
	formatDistanceBuckets,
	formatPostcardLine,
	formatStampLine,
	passportColor,
	prettyBiome,
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
	biomeTotal: 0,
	dimensions: ["minecraft:overworld", "minecraft:the_nether"],
	regions: [
		{ id: "one", title: "Home", embassy: true, owner: "Owner", at: 1 },
		{ id: "two", title: "Wild", embassy: false, owner: null, at: 2 },
	],
	distance: { walk: 12_400, ride: 3_100, fly: 800, swim: 120, total: 16_420 },
	deaths: 2,
	crystalTrips: 4,
	postcards: 2,
	stamps: [],
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

Deno.test("biomeColor and prettyBiome classify postcard locations", () => {
	assertEqual(biomeColor("minecraft:plains", "mctraveler:embassies"), Colors.Gold);
	assertEqual(biomeColor("minecraft:plains", "minecraft:the_nether"), Colors.DarkRed);
	assertEqual(biomeColor("minecraft:plains", "minecraft:the_end"), Colors.Purple);
	assertEqual(biomeColor("minecraft:deep_ocean", "minecraft:overworld"), Colors.Blue);
	assertEqual(biomeColor("minecraft:dark_forest", "minecraft:overworld"), Colors.Green);
	assertEqual(prettyBiome("minecraft:dark_forest"), "Dark Forest");
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

Deno.test("buildPassportEmbed shows biome totals, counters, and stamps", () => {
	const embed = buildPassportEmbed({
		...fixture,
		biomeCount: 12,
		biomeTotal: 64,
		stamps: [
			{ id: "one", title: "First", description: "First description", icon: "👣", at: 1 },
			{ id: "two", title: "Second", description: "Second description", icon: "🥾", at: 3 },
			{ id: "three", title: "Third", description: "Third description", icon: "🧭", at: 2 },
		],
	}).toJSON();
	const fields = embed.fields ?? [];
	assert(
		fields.some((field) => field.name === "Biomes" && field.value === "12 / 64"),
		"biome total",
	);
	assert(
		fields.some((field) => field.name === "Crystal trips" && field.value === "4"),
		"crystal trips",
	);
	assert(
		fields.some((field) => field.name === "Postcards sent" && field.value === "2"),
		"postcards",
	);
	assert(
		fields.some((field) =>
			field.name === "Stamps" &&
			field.value.includes("👣 🥾 🧭 · +11 locked") &&
			field.value.indexOf("Second") < field.value.indexOf("Third")
		),
		"stamp field",
	);
	assert(
		(buildPassportEmbed({ ...fixture, stamps: [] }).toJSON().fields ?? [])
			.some((field) => field.name === "Stamps" && field.value === "No stamps yet"),
		"empty stamp field",
	);
	assert(
		(buildPassportEmbed({ ...fixture, biomeCount: 12, biomeTotal: 0 }).toJSON().fields ?? [])
			.some((field) => field.name === "Biomes" && field.value === "12"),
		"biome count without total",
	);
});

Deno.test("buildPostcardEmbed and event lines format postcard events", () => {
	const event = {
		type: "postcard" as const,
		at: Date.UTC(2025, 0, 3),
		player: "Traveler",
		dimension: "mctraveler:embassies",
		biome: "minecraft:dark_forest",
		region: { id: "embassy", title: "The *Embassy*", embassy: true, owner: null },
		x: 120,
		y: 70,
		z: -40,
		dayTime: 6_000,
		raining: true,
		thundering: false,
		caption: "*x*",
	};
	const embed = buildPostcardEmbed(event).toJSON();
	assertEqual(embed.title, "📮 Greetings from The *Embassy*");
	assertEqual(embed.author?.name, "🏛️ Embassies");
	assertEqual(embed.color, Colors.Gold);
	assertEqual(embed.description, '> *"\\*x\\*"*');
	assert(
		(embed.fields ?? []).some((field) =>
			field.name === "📍 Where" && field.value === "Dark Forest\n~120, -40"
		),
		"location field should be shown",
	);
	assert(
		(embed.fields ?? []).some((field) =>
			field.name === "🕐 When" && field.value === "☀️ Day\n🌧️ Rain"
		),
		"time field should be shown",
	);
	assert(
		(embed.fields ?? []).some((field) => field.name === "🏛️ Embassy" && field.value === "unknown"),
		"embassy should be shown",
	);
	assertEqual(embed.timestamp, "2025-01-03T00:00:00.000Z");
	assertEqual(
		formatStampLine({
			type: "stamp",
			at: 1,
			player: "Player*",
			stamp: { id: "one", title: "First*", description: "Walked", icon: "👣" },
		}),
		"🏅 **Player\\*** earned **👣 First\\*** — Walked",
	);
	assertEqual(
		formatPostcardLine(event),
		"📮 **Traveler** sent a postcard from The *Embassy*",
	);
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
	assertEqual(
		buildLeaderboardEmbed("stamps", [{ name: "Stamped", value: 3 }]).toJSON().description,
		"🥇 Stamped — 3",
	);
});
