import { type Client, DiscordAPIError, RESTJSONErrorCodes } from "discord.js";
import { getFeaturesMessageState, saveFeaturesMessageState } from "./firebase.ts";

export const FEATURES_MESSAGE_CONTENT = `# What Observer Can Do

Observer is the Discord bot for the MCTraveler discord server. Here's everything it currently offers:

**Two-way live chat bridge**
Messages sent in the #broadcast channel are relayed into the game, and player chat is mirrored back here.

**Server status — \`/status\`**
See who's online, a color-coded performance indicator.

**Feedback — \`/feedback\`**
Report a bug, request a feature, or share other feedback. Fill out a short form and it's filed straight to the developers, no need to leave Discord.

**Surveys — \`/survey\`** *(admin only)*
Admins can send a quick survey to players to gather feedback about the server.

**This message — \`/features\`** *(admin only)*
Admins can post or refresh this overview in any channel whenever the bot gains new capabilities.`;

export type FeaturesPostResult = "posted" | "updated";

/** True only for "this message no longer exists" — every other failure must propagate. */
function isUnknownMessage(error: unknown): boolean {
	return error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.UnknownMessage;
}

/**
 * Post the feature overview to `channelId`, or edit the previously-posted
 * message in place if one is already tracked for that same channel. Falls
 * back to posting fresh only when the tracked message was actually deleted;
 * any other edit failure (permissions, network) propagates instead of
 * silently duplicating the message.
 */
export async function postOrUpdateFeaturesMessage(
	client: Client,
	channelId: string,
): Promise<FeaturesPostResult> {
	const channel = await client.channels.fetch(channelId);
	if (!channel?.isSendable()) {
		throw new Error(`Channel ${channelId} is not sendable`);
	}

	const state = await getFeaturesMessageState();
	if (state?.channelId === channelId) {
		try {
			const message = await channel.messages.fetch(state.messageId);
			await message.edit(FEATURES_MESSAGE_CONTENT);
			return "updated";
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

	const message = await channel.send(FEATURES_MESSAGE_CONTENT);
	await saveFeaturesMessageState(channelId, message.id);
	return "posted";
}
