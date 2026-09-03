import type { Client } from "discord.js";
import {
	getLiveStatusPeak,
	getTrackedMessageState,
	isFirebaseConfigured,
	LIVE_STATUS_MESSAGE_DOC_ID,
	saveLiveStatusPeak,
	type TrackedMessageState,
} from "./firebase.ts";
import { fetchStatus, type StatusResponse } from "./conduit/client.ts";
import { buildLiveStatusEmbed } from "./status.ts";
import {
	isUnknownMessage,
	postOrUpdateTrackedMessage,
	type TrackedPostResult,
} from "./tracked-message.ts";

const LIVE_STATUS_INTERVAL_MS = 60_000;
const UNREACHABLE_AFTER_FAILURES = 2;

let tracked: TrackedMessageState | undefined;
let peak: { date: string; count: number } | undefined;
let consecutiveFailures = 0;

function recordPeak(online: number): number {
	const today = new Date().toISOString().slice(0, 10);
	const count = peak?.date === today ? Math.max(peak.count, online) : online;
	if (peak?.date === today && peak.count === count) return count;

	peak = { date: today, count };
	void saveLiveStatusPeak(today, count).catch((error) => {
		console.error("Failed to save live status peak:", error);
	});
	return count;
}

export async function postOrUpdateLiveStatusMessage(
	client: Client,
	channelId: string,
): Promise<TrackedPostResult> {
	let serverStatus: StatusResponse | undefined;
	try {
		serverStatus = await fetchStatus();
	} catch {
		serverStatus = undefined;
	}
	const peakToday = serverStatus ? recordPeak(serverStatus.online) : peak?.count;

	const { result, messageId } = await postOrUpdateTrackedMessage(
		client,
		channelId,
		LIVE_STATUS_MESSAGE_DOC_ID,
		{ embeds: [buildLiveStatusEmbed(serverStatus, peakToday)] },
	);
	tracked = { channelId, messageId };
	return result;
}

export function startLiveStatus(client: Client): void {
	if (!isFirebaseConfigured()) {
		console.info("Firebase service account not set; live status disabled");
		return;
	}

	const poll = async () => {
		if (!tracked) return;

		let serverStatus: StatusResponse | undefined;
		let peakToday = peak?.count;
		try {
			serverStatus = await fetchStatus();
			consecutiveFailures = 0;
			peakToday = recordPeak(serverStatus.online);
		} catch (error) {
			consecutiveFailures++;
			if (consecutiveFailures < UNREACHABLE_AFTER_FAILURES) return;
			serverStatus = undefined;
			console.warn("Live status poll failed to reach conduit:", error);
		}

		const state = tracked;
		if (!state) return;

		try {
			const channel = await client.channels.fetch(state.channelId);
			if (!channel?.isTextBased()) {
				throw new Error(`Channel ${state.channelId} is not text-based`);
			}
			const message = await channel.messages.fetch(state.messageId);
			await message.edit({ embeds: [buildLiveStatusEmbed(serverStatus, peakToday)] });
		} catch (error) {
			if (isUnknownMessage(error)) {
				tracked = undefined;
				console.warn("Live status message was deleted; run /livestatus again");
				return;
			}
			console.error("Live status poll failed to update message:", error);
		}
	};

	const schedule = () => {
		setTimeout(() => {
			poll().finally(schedule);
		}, LIVE_STATUS_INTERVAL_MS);
	};

	const initialize = async () => {
		try {
			const state = await getTrackedMessageState(LIVE_STATUS_MESSAGE_DOC_ID);
			if (!tracked) tracked = state;
		} catch (error) {
			console.error("Failed to load live status message state:", error);
		}
		try {
			const storedPeak = await getLiveStatusPeak();
			if (!peak) peak = storedPeak;
		} catch (error) {
			console.error("Failed to load live status peak:", error);
		}
		poll().finally(schedule);
	};

	initialize();
}
