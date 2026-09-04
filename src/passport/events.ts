import { AttachmentBuilder } from "discord.js";
import type { Client } from "discord.js";
import { Buffer } from "node:buffer";
import { config } from "../config.ts";
import { fetchEvents, type PassportEvent, type PostcardEvent } from "../conduit/client.ts";
import { getPostcardsChannelId, isFirebaseConfigured } from "../firebase.ts";
import { buildPostcardEmbed, formatPostcardLine, formatStampLine } from "../passport.ts";
import { renderPostcardPng } from "./render.ts";

const POLL_INTERVAL_MS = 10_000;
const CHANNEL_CACHE_MS = 60_000;

async function sendChatLine(client: Client, content: string): Promise<void> {
	if (!config.chatChannelId) return;
	const channel = await client.channels.fetch(config.chatChannelId);
	if (!channel?.isSendable()) {
		throw new Error(`Chat channel ${config.chatChannelId} is not sendable`);
	}
	await channel.send(content);
}

async function postPostcard(
	client: Client,
	channelId: string,
	event: PostcardEvent,
): Promise<void> {
	const channel = await client.channels.fetch(channelId);
	if (!channel?.isSendable()) {
		throw new Error(`Postcards channel ${channelId} is not sendable`);
	}
	const embed = buildPostcardEmbed(event);
	const png = await renderPostcardPng(event);
	const message = png
		? await channel.send({
			embeds: [embed.setImage("attachment://postcard.png")],
			files: [new AttachmentBuilder(Buffer.from(png), { name: "postcard.png" })],
		})
		: await channel.send({ embeds: [embed] });
	try {
		await message.react("📮");
		await message.react("❤️");
	} catch (error) {
		console.error("Failed to react to postcard:", error);
	}
}

async function handleEvent(client: Client, channelId: string | undefined, event: PassportEvent) {
	if (event.type === "stamp") {
		try {
			await sendChatLine(client, formatStampLine(event));
		} catch (error) {
			console.error("Failed to post stamp event:", error);
		}
		return;
	}

	if (channelId) {
		try {
			await postPostcard(client, channelId, event);
		} catch (error) {
			console.error("Failed to post postcard event:", error);
		}
	}

	try {
		await sendChatLine(client, formatPostcardLine(event));
	} catch (error) {
		console.error("Failed to post postcard summary:", error);
	}
}

export function startPassportEvents(client: Client): void {
	let cursor = Date.now();
	let channelId: string | undefined;
	let channelFetchedAt = 0;
	let notConfiguredLogged = false;

	const readChannelId = async (): Promise<string | undefined> => {
		if (Date.now() - channelFetchedAt < CHANNEL_CACHE_MS) return channelId;
		channelFetchedAt = Date.now();
		if (!isFirebaseConfigured()) {
			if (!notConfiguredLogged) {
				console.info("postcards channel not configured; dropping postcards");
				notConfiguredLogged = true;
			}
			channelId = undefined;
			return channelId;
		}
		try {
			channelId = await getPostcardsChannelId();
			if (!channelId && !notConfiguredLogged) {
				console.info("postcards channel not configured; dropping postcards");
				notConfiguredLogged = true;
			}
			return channelId;
		} catch (error) {
			console.error("Failed to load postcards channel:", error);
			return undefined;
		}
	};

	const poll = async () => {
		try {
			const response = await fetchEvents(cursor);
			cursor = response.now;
			const postcardsChannelId = await readChannelId();
			for (const event of response.events) {
				await handleEvent(client, postcardsChannelId, event);
			}
		} catch (error) {
			console.error("Passport events poll failed:", error);
		}
	};

	const schedule = () => {
		setTimeout(() => {
			poll().finally(schedule);
		}, POLL_INTERVAL_MS);
	};

	poll().finally(schedule);
}
