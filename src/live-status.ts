import type { Client } from "discord.js";
import {
	getTrackedMessageState,
	isFirebaseConfigured,
	LIVE_STATUS_MESSAGE_DOC_ID,
	type TrackedMessageState,
} from "./firebase.ts";
import { fetchStatus } from "./conduit/client.ts";
import { buildLiveStatusEmbed } from "./status.ts";
import {
	isUnknownMessage,
	postOrUpdateTrackedMessage,
	type TrackedPostResult,
} from "./tracked-message.ts";

const LIVE_STATUS_INTERVAL_MS = 60_000;
const UNREACHABLE_AFTER_FAILURES = 2;

let tracked: TrackedMessageState | undefined;
let consecutiveFailures = 0;

export async function postOrUpdateLiveStatusMessage(
	client: Client,
	channelId: string,
): Promise<TrackedPostResult> {
	let serverStatus;
	try {
		serverStatus = await fetchStatus();
	} catch {
		serverStatus = undefined;
	}

	const { result, messageId } = await postOrUpdateTrackedMessage(
		client,
		channelId,
		LIVE_STATUS_MESSAGE_DOC_ID,
		{ embeds: [buildLiveStatusEmbed(serverStatus)] },
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

		let serverStatus;
		try {
			serverStatus = await fetchStatus();
			consecutiveFailures = 0;
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
			await message.edit({ embeds: [buildLiveStatusEmbed(serverStatus)] });
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
		poll().finally(schedule);
	};

	initialize();
}
