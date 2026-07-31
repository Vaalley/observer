import { Colors, EmbedBuilder } from "discord.js";
import type { StatusResponse } from "./conduit/client.ts";

/** Minecraft's tick rate targets 20 TPS; below that the server is behind on game logic. */
const HEALTHY_TPS = 19;
const LAGGY_TPS = 15;

const MAX_FIELD_CHARS = 1024;

interface TpsHealth {
	emoji: string;
	label: string;
	color: number;
}

/** Buckets a TPS reading into a human label and embed color. */
export function tpsHealth(tps: number): TpsHealth {
	if (tps >= HEALTHY_TPS) return { emoji: "🟢", label: "Healthy", color: Colors.Green };
	if (tps >= LAGGY_TPS) return { emoji: "🟡", label: "Laggy", color: Colors.Yellow };
	return { emoji: "🔴", label: "Struggling", color: Colors.Red };
}

/**
 * Alphabetizes and truncates so the joined string (with any ", and N more" suffix) never
 * exceeds an embed field's 1024 chars.
 */
export function formatPlayerList(players: readonly string[]): string {
	if (players.length === 0) return "No players online";
	const sorted = [...players].sort((a, b) => a.localeCompare(b));

	const full = sorted.join(", ");
	if (full.length <= MAX_FIELD_CHARS) return full;

	let text = "";
	let shown = 0;
	for (const name of sorted) {
		const candidate = shown === 0 ? name : `${text}, ${name}`;
		const remaining = sorted.length - shown - 1;
		const suffix = remaining > 0 ? `, and ${remaining} more` : "";
		if (candidate.length + suffix.length > MAX_FIELD_CHARS) break;
		text = candidate;
		shown++;
	}

	if (shown === 0) return `${sorted.length} players online (too many to list)`;
	const remaining = sorted.length - shown;
	return remaining > 0 ? `${text}, and ${remaining} more` : text;
}

/** The embed shown when conduit could not be reached at all (offline, restarting, misconfigured). */
export function buildUnreachableStatusEmbed(): EmbedBuilder {
	return new EmbedBuilder()
		.setTitle("MCTraveler Status")
		.setColor(Colors.Red)
		.setDescription("🔴 Couldn't reach the Minecraft server. It may be restarting or offline.")
		.setTimestamp();
}

/** The embed shown for a successful `/status` fetch. */
export function buildStatusEmbed(
	serverStatus: StatusResponse,
	requestedBy: string,
): EmbedBuilder {
	const health = tpsHealth(serverStatus.tps);
	return new EmbedBuilder()
		.setTitle("MCTraveler Status")
		.setColor(health.color)
		.addFields(
			{
				name: `Players Online (${serverStatus.online})`,
				value: formatPlayerList(serverStatus.players),
			},
			{
				name: "Server Performance",
				value: `${health.emoji} ${serverStatus.tps.toFixed(1)}/20 TPS — ${health.label}`,
			},
		)
		.setTimestamp()
		.setFooter({ text: `Requested by ${requestedBy}` });
}
