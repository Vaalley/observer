import { Client, Events, GatewayIntentBits, MessageFlags, Partials } from "discord.js";
import { config } from "./config.ts";
import { commands } from "./commands/mod.ts";
import { handleChatBridgeMessage, startChatBridge } from "./chat-bridge.ts";
import { handleSurveyButton, handleSurveyMessage } from "./survey.ts";

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.DirectMessages,
		GatewayIntentBits.MessageContent,
	],
	partials: [Partials.Channel, Partials.Message],
});

client.once(Events.ClientReady, (ready) => {
	console.info(`Logged in as ${ready.user.tag}`);
	startChatBridge(client);
});

client.on(Events.MessageCreate, async (message) => {
	try {
		if (await handleChatBridgeMessage(message)) return;
		await handleSurveyMessage(message);
	} catch (error) {
		console.error("Message handler failed:", error);
	}
});

client.on(Events.InteractionCreate, async (interaction) => {
	if (interaction.isButton()) {
		try {
			const handled = await handleSurveyButton(interaction);
			if (!handled) return;
		} catch (error) {
			console.error("Survey button handler failed:", error);
			try {
				if (interaction.replied) {
					await interaction.followUp({
						content: "Something went wrong.",
						flags: MessageFlags.Ephemeral,
					});
				} else if (!interaction.deferred && !interaction.replied) {
					await interaction.reply({
						content: "Something went wrong.",
						flags: MessageFlags.Ephemeral,
					});
				} else {
					await interaction.editReply("Something went wrong.");
				}
			} catch (replyError) {
				console.error("Failed to send survey button error reply:", replyError);
			}
		}
		return;
	}

	if (!interaction.isChatInputCommand()) return;

	const command = commands[interaction.commandName];
	if (!command) {
		console.warn(`Unknown command: ${interaction.commandName}`);
		return;
	}

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(`Command ${interaction.commandName} failed:`, error);
		try {
			if (interaction.replied) {
				await interaction.followUp({
					content: "Something went wrong.",
					flags: MessageFlags.Ephemeral,
				});
			} else if (interaction.deferred) {
				await interaction.editReply("Something went wrong.");
			} else {
				await interaction.reply({
					content: "Something went wrong.",
					flags: MessageFlags.Ephemeral,
				});
			}
		} catch (replyError) {
			console.error("Failed to send error reply:", replyError);
		}
	}
});

await client.login(config.token);
