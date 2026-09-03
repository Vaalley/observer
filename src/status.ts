import { Colors, EmbedBuilder, escapeMarkdown } from "discord.js";
import type { APIEmbedField } from "discord.js";
import type { PlayerSession, StatusResponse } from "./conduit/client.ts";

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

export function formatDuration(ms: number): string {
	const minutes = Math.floor(Math.max(0, ms) / 60_000);
	if (minutes < 1) return "<1m";

	const days = Math.floor(minutes / 1_440);
	if (days > 0) {
		const hours = Math.floor((minutes % 1_440) / 60);
		return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
	}

	const hours = Math.floor(minutes / 60);
	const remainingMinutes = minutes % 60;
	if (hours > 0) return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
	return `${minutes}m`;
}

export function worldTimeLabel(dayTime: number): string {
	if (dayTime < 12_000) return "☀️ Day";
	if (dayTime < 13_800) return "🌇 Dusk";
	if (dayTime < 22_300) return "🌙 Night";
	return "🌅 Dawn";
}

export function weatherLabel(raining: boolean, thundering: boolean): string {
	if (thundering) return "⛈️ Thunderstorm";
	if (raining) return "🌧️ Rain";
	return "☀️ Clear";
}

/**
 * Alphabetizes and truncates so the joined string (with any ", and N more" suffix) never
 * exceeds an embed field's 1024 chars.
 */
function joinWithinLimit(entries: readonly string[]): string {
	if (entries.length === 0) return "No players online";
	const full = entries.join(", ");
	if (full.length <= MAX_FIELD_CHARS) return full;

	let text = "";
	let shown = 0;
	for (const name of entries) {
		const candidate = shown === 0 ? name : `${text}, ${name}`;
		const remaining = entries.length - shown - 1;
		const suffix = remaining > 0 ? `, and ${remaining} more` : "";
		if (candidate.length + suffix.length > MAX_FIELD_CHARS) break;
		text = candidate;
		shown++;
	}

	if (shown === 0) return `${entries.length} players online (too many to list)`;
	const remaining = entries.length - shown;
	return remaining > 0 ? `${text}, and ${remaining} more` : text;
}

export function formatPlayerList(players: readonly string[]): string {
	const sorted = [...players].sort((a, b) => a.localeCompare(b)).map((name) =>
		escapeMarkdown(name)
	);
	return joinWithinLimit(sorted);
}

export function formatPlayerSessions(
	sessions: readonly PlayerSession[],
	now = Date.now(),
): string {
	const sorted = [...sessions]
		.sort((a, b) => a.name.localeCompare(b.name))
		.map(({ name, joinedAt }) => {
			const escapedName = escapeMarkdown(name);
			return joinedAt === null ? escapedName : `${escapedName} (${formatDuration(now - joinedAt)})`;
		});
	return joinWithinLimit(sorted);
}

export function statusFields(serverStatus: StatusResponse, now = Date.now()): APIEmbedField[] {
	const players = serverStatus.sessions
		? formatPlayerSessions(serverStatus.sessions, now)
		: formatPlayerList(serverStatus.players);
	const health = tpsHealth(serverStatus.tps);
	const fields: APIEmbedField[] = [
		{
			name: `Players Online (${serverStatus.online})`,
			value: players,
		},
		{
			name: "Server Performance",
			value: `${health.emoji} ${serverStatus.tps.toFixed(1)}/20 TPS — ${health.label}`,
		},
	];

	if (serverStatus.dayTime !== undefined) {
		const raining = serverStatus.raining ?? false;
		const thundering = serverStatus.thundering ?? false;
		fields.push({
			name: "World",
			value: `${worldTimeLabel(serverStatus.dayTime)} · ${weatherLabel(raining, thundering)}`,
			inline: true,
		});
	}

	if (serverStatus.startedAt !== undefined) {
		fields.push({
			name: "Uptime",
			value: `${formatDuration(now - serverStatus.startedAt)} (since <t:${
				Math.floor(serverStatus.startedAt / 1000)
			}:R>)`,
			inline: true,
		});
	}

	if (serverStatus.minecraftVersion || serverStatus.modVersion) {
		const versions = [
			serverStatus.minecraftVersion ? `Minecraft ${serverStatus.minecraftVersion}` : undefined,
			serverStatus.modVersion ? `Conduit ${serverStatus.modVersion}` : undefined,
		].filter((version): version is string => version !== undefined);
		fields.push({
			name: "Version",
			value: versions.join(" · "),
			inline: true,
		});
	}

	return fields;
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
		.addFields(statusFields(serverStatus))
		.setTimestamp()
		.setFooter({ text: `Requested by ${requestedBy}` });
}

/** The embed the live-status message shows; `serverStatus` undefined means conduit was unreachable. */
export function buildLiveStatusEmbed(
	serverStatus: StatusResponse | undefined,
	peakToday?: number,
): EmbedBuilder {
	const embed = new EmbedBuilder()
		.setTitle("MCTraveler Live Status")
		.setTimestamp()
		.setFooter({ text: "Updates every minute" });

	if (!serverStatus) {
		return embed
			.setColor(Colors.Red)
			.setDescription("🔴 Couldn't reach the Minecraft server. It may be restarting or offline.");
	}

	const health = tpsHealth(serverStatus.tps);
	const fields = statusFields(serverStatus);
	const peak = peakToday !== undefined && peakToday > 0 ? ` · peak today: ${peakToday}` : "";

	if (serverStatus.online === 0) {
		return embed
			.setColor(Colors.Yellow)
			.setDescription(`🟡 Nobody online right now${peak}`)
			.addFields(fields.slice(1));
	}

	const playerWord = serverStatus.online === 1 ? "player" : "players";
	return embed
		.setColor(health.color)
		.setDescription(`🟢 ${serverStatus.online} ${playerWord} online${peak}`)
		.addFields(fields);
}
