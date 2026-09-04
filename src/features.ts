import type { Client } from "discord.js";
import { FEATURES_MESSAGE_DOC_ID } from "./firebase.ts";
import { postOrUpdateTrackedMessage, type TrackedPostResult } from "./tracked-message.ts";

export const FEATURES_MESSAGE_CONTENT = `# What Observer Can Do

Observer is the Discord bot for the MCTraveler discord server. Here's everything it currently offers:

**Two-way live chat bridge**
Messages sent in the #broadcast channel are relayed into the game, and player chat is mirrored back here.

**Server status -> \`/status\`**
See who's online, a color-coded performance indicator.

**Live status message -> \`/livestatus\`** *(admin only)*
Admins can pin an auto-updating status embed in a channel; it refreshes every minute with who's online, session lengths, uptime, world time/weather, server performance, and today's peak.

**Passport -> \`/passport\`**
See a player's travel record: biomes, dimensions, regions and embassies visited, distance walked/ridden/flown/swum.

**Leaderboard -> \`/leaderboard\`**
See the top travelers by distance, biomes or embassies.

**Feedback -> \`/feedback\`**
Report a bug, request a feature, or share other feedback. Fill out a short form and it's filed straight to the developers, no need to leave Discord.

**Surveys -> \`/survey\`** *(admin only)*
Admins can send a quick survey to players to gather feedback about the server.

**This message -> \`/features\`** *(admin only)*
Admins can post or refresh this overview in any channel whenever the bot gains new capabilities.`;

export async function postOrUpdateFeaturesMessage(
	client: Client,
	channelId: string,
): Promise<TrackedPostResult> {
	const { result } = await postOrUpdateTrackedMessage(
		client,
		channelId,
		FEATURES_MESSAGE_DOC_ID,
		{ content: FEATURES_MESSAGE_CONTENT },
	);
	return result;
}
