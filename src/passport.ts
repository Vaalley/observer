import { Colors, EmbedBuilder, escapeMarkdown } from "discord.js";
import type { PostcardEvent, StampEvent } from "./conduit/client.ts";
import type {
	LeaderboardMetric,
	PassportDistance,
	PassportResponse,
	TopEntry,
} from "./conduit/client.ts";
import { weatherLabel, worldTimeLabel } from "./status.ts";

export const STAMP_TOTAL = 14;

export const DIMENSION_LABELS: Record<string, string> = {
	"minecraft:overworld": "🌍 Overworld",
	"minecraft:the_nether": "🔥 Nether",
	"minecraft:the_end": "🌌 End",
	"mctraveler:embassies": "🏛️ Embassies",
};

export function formatDistance(blocks: number): string {
	return blocks < 1000 ? `${Math.round(blocks)} m` : `${(blocks / 1000).toFixed(1)} km`;
}

export function passportColor(dimensions: readonly string[]): number {
	if (dimensions.includes("minecraft:the_end")) return Colors.Purple;
	if (dimensions.includes("minecraft:the_nether")) return Colors.Red;
	return Colors.Green;
}

export function formatDistanceBuckets(distance: PassportDistance): string {
	const buckets = [
		["🚶", distance.walk],
		["🐎", distance.ride],
		["🪂", distance.fly],
		["🏊", distance.swim],
	] as const;
	const shown = buckets
		.filter(([, blocks]) => blocks > 0)
		.map(([emoji, blocks]) => `${emoji} ${formatDistance(blocks)}`);
	return shown.length > 0 ? shown.join(" · ") : "Hasn't moved yet";
}

export function dimensionLabel(id: string): string {
	return DIMENSION_LABELS[id] ?? id;
}

export function prettyBiome(id: string): string {
	const name = id.includes(":") ? id.slice(id.indexOf(":") + 1) : id;
	return name.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function biomeColor(biome: string, dimension: string): number {
	if (dimension === "mctraveler:embassies") return Colors.Gold;
	if (dimension === "minecraft:the_nether") return Colors.DarkRed;
	if (dimension === "minecraft:the_end") return Colors.Purple;
	if (/ocean|river/.test(biome)) return Colors.Blue;
	if (/desert|badlands|savanna|beach/.test(biome)) return 0xE3C16F;
	if (/snow|frozen|ice|grove|peaks/.test(biome)) return Colors.White;
	if (/jungle|swamp|mangrove/.test(biome)) return Colors.DarkGreen;
	if (biome.includes("mushroom")) return 0xC97AB2;
	if (biome.includes("cherry")) return 0xF4B6C2;
	return Colors.Green;
}

export function buildPassportEmbed(
	passport: PassportResponse,
	now = Date.now(),
): EmbedBuilder {
	const regions = passport.regions;
	const firstJoin = new Date(passport.firstJoin).toISOString().slice(0, 10);
	return new EmbedBuilder()
		.setTitle(`🛂 Passport — ${escapeMarkdown(passport.name)}`)
		.setColor(passportColor(passport.dimensions))
		.addFields(
			{
				name: "Biomes",
				value: passport.biomeTotal > 0
					? `${passport.biomeCount} / ${passport.biomeTotal}`
					: String(passport.biomeCount),
				inline: true,
			},
			{
				name: "Dimensions",
				value: passport.dimensions.map(dimensionLabel).join(" · ") || "None",
				inline: true,
			},
			{
				name: "Regions",
				value: `${regions.length} visited · ${
					regions.filter((region) => region.embassy).length
				} embassies`,
				inline: true,
			},
			{
				name: "Distance travelled",
				value: `${formatDistanceBuckets(passport.distance)}\nTotal: ${
					formatDistance(passport.distance.total)
				}`,
			},
			{
				name: "Deaths",
				value: String(passport.deaths),
				inline: true,
			},
			{
				name: "Crystal trips",
				value: String(passport.crystalTrips),
				inline: true,
			},
			{
				name: "Postcards sent",
				value: String(passport.postcards),
				inline: true,
			},
		)
		.addFields({
			name: "Stamps",
			value: passport.stamps.length === 0
				? "No stamps yet"
				: `${passport.stamps.map((stamp) => stamp.icon).join(" ")} · +${
					STAMP_TOTAL - passport.stamps.length
				} locked\n${
					[...passport.stamps]
						.sort((a, b) => b.at - a.at)
						.slice(0, 3)
						.map((stamp) => `**${escapeMarkdown(stamp.title)}** — ${stamp.description}`)
						.join("\n")
				}`,
		})
		.setFooter({
			text:
				`Traveler since ${firstJoin} · #${passport.rank.distance} by distance · #${passport.rank.biomes} by biomes`,
		})
		.setTimestamp(now);
}

export function buildPostcardEmbed(
	event: PostcardEvent,
	postcardNumber?: number,
): EmbedBuilder {
	const biome = prettyBiome(event.biome);
	const region = event.region ?? undefined;
	const lines = [
		event.caption ? `> "${escapeMarkdown(event.caption)}"` : undefined,
		`📍 ${dimensionLabel(event.dimension)} · ${biome} · ~${event.x}, ${event.z}`,
		`🕐 ${worldTimeLabel(event.dayTime)} · ${weatherLabel(event.raining, event.thundering)}`,
		region?.embassy ? `🏛️ Embassy of ${region.owner ?? "unknown"}` : undefined,
	].filter((line): line is string => line !== undefined);
	const footer = `Postcard from ${event.player}${
		postcardNumber === undefined ? "" : ` · #${postcardNumber}`
	}`;
	return new EmbedBuilder()
		.setAuthor({ name: `Greetings from ${region?.title ?? biome}` })
		.setColor(biomeColor(event.biome, event.dimension))
		.setDescription(lines.join("\n"))
		.setFooter({ text: footer })
		.setTimestamp(event.at);
}

export function formatStampLine(event: StampEvent): string {
	return `🏅 **${escapeMarkdown(event.player)}** earned **${event.stamp.icon} ${
		escapeMarkdown(event.stamp.title)
	}** — ${event.stamp.description}`;
}

export function formatPostcardLine(event: PostcardEvent): string {
	return `📮 **${escapeMarkdown(event.player)}** sent a postcard from ${
		event.region?.title ?? prettyBiome(event.biome)
	}`;
}

const MEDALS = ["🥇", "🥈", "🥉"] as const;

export function buildLeaderboardEmbed(
	by: LeaderboardMetric,
	entries: readonly TopEntry[],
): EmbedBuilder {
	const description = entries.length === 0 ? "No travelers yet." : entries.map((entry, index) => {
		const prefix = MEDALS[index] ?? `${index + 1}.`;
		const value = by === "distance" ? formatDistance(entry.value) : String(entry.value);
		return `${prefix} ${escapeMarkdown(entry.name)} — ${value}`;
	}).join("\n");
	return new EmbedBuilder()
		.setTitle(`🏆 Top travelers — by ${by}`)
		.setDescription(description)
		.setColor(Colors.Gold)
		.setTimestamp();
}
