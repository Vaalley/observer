import { Colors, EmbedBuilder, escapeMarkdown } from "discord.js";
import type {
	LeaderboardMetric,
	PassportDistance,
	PassportResponse,
	TopEntry,
} from "./conduit/client.ts";

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

function dimensionLabel(id: string): string {
	return DIMENSION_LABELS[id] ?? id;
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
				value: String(passport.biomeCount),
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
		)
		.setFooter({
			text:
				`Traveler since ${firstJoin} · #${passport.rank.distance} by distance · #${passport.rank.biomes} by biomes`,
		})
		.setTimestamp(now);
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
