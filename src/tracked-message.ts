import {
	type Client,
	DiscordAPIError,
	type MessageCreateOptions,
	type MessageEditOptions,
	RESTJSONErrorCodes,
} from "discord.js";
import { getTrackedMessageState, saveTrackedMessageState } from "./firebase.ts";

export type TrackedPostResult = "posted" | "updated";

/** True only for "this message no longer exists" — every other failure must propagate. */
export function isUnknownMessage(error: unknown): boolean {
	return error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.UnknownMessage;
}

/**
 * Post a tracked message, or edit the previously-posted message in place if
 * one is already tracked for that same channel.
 */
export async function postOrUpdateTrackedMessage(
	client: Client,
	channelId: string,
	docId: string,
	payload: MessageCreateOptions & MessageEditOptions,
): Promise<{ result: TrackedPostResult; messageId: string }> {
	const channel = await client.channels.fetch(channelId);
	if (!channel?.isSendable()) {
		throw new Error(`Channel ${channelId} is not sendable`);
	}

	const state = await getTrackedMessageState(docId);
	if (state?.channelId === channelId) {
		try {
			const message = await channel.messages.fetch(state.messageId);
			await message.edit(payload);
			return { result: "updated", messageId: state.messageId };
		} catch (error) {
			if (!isUnknownMessage(error)) throw error;
			// Tracked message was deleted out-of-band — fall through and repost.
		}
	} else if (state) {
		// Moving to a new channel: best-effort clean up the old copy so only one exists.
		try {
			const oldChannel = await client.channels.fetch(state.channelId);
			if (oldChannel?.isTextBased()) {
				await (await oldChannel.messages.fetch(state.messageId)).delete();
			}
		} catch {
			// Old message/channel already gone, or no permission — nothing more to do.
		}
	}

	const message = await channel.send(payload);
	await saveTrackedMessageState(docId, channelId, message.id);
	return { result: "posted", messageId: message.id };
}
