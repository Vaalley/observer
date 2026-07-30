import type { Client, Message } from "discord.js";
import { config } from "./config.ts";
import { fetchChat, sendBroadcast } from "./conduit/client.ts";

const CHAT_POLL_INTERVAL_MS = 1500;
const MAX_BROADCAST_LENGTH = 256;

function sanitize(text: string): string {
	return text
		.replaceAll(/[\r\n]/g, " ")
		.replaceAll("§", "")
		.slice(0, MAX_BROADCAST_LENGTH)
		.trim();
}

export function startChatBridge(client: Client) {
	const channelId = config.chatChannelId;
	if (!channelId) {
		console.info("DISCORD_CHAT_CHANNEL_ID not set; chat bridge disabled");
		return;
	}

	let lastPoll = Date.now();

	const poll = async () => {
		try {
			const messages = await fetchChat(lastPoll);
			const channel = await client.channels.fetch(channelId);
			if (!channel?.isSendable()) {
				console.warn(`Chat bridge channel ${channelId} is not sendable`);
				return;
			}

			for (const message of messages) {
				await channel.send(`${message.sender}: ${message.content}`);
			}

			if (messages.length > 0) {
				lastPoll = Math.max(...messages.map((message) => message.timestamp));
			}
		} catch (error) {
			console.error("Chat bridge poll failed:", error);
		}
	};

	const schedule = () => {
		setTimeout(() => {
			poll().finally(schedule);
		}, CHAT_POLL_INTERVAL_MS);
	};

	poll().finally(schedule);
}

export async function handleChatBridgeMessage(message: Message): Promise<boolean> {
	if (!config.chatChannelId || message.channelId !== config.chatChannelId) return false;
	if (message.author.bot) return false;
	if (message.author.id === message.client.user?.id) return false;

	const content = sanitize(message.content).trim();
	if (content.length === 0) return false;

	const sender = sanitize(message.author.displayName ?? message.author.username);
	try {
		await sendBroadcast(sender, content);
	} catch (error) {
		console.error("Chat bridge to game failed:", error);
	}
	return true;
}
