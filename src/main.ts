import { Client, Events, GatewayIntentBits, MessageFlags } from "discord.js";
import { config } from "./config.ts";
import { commands } from "./commands/mod.ts";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, (ready) => {
	console.info(`Logged in as ${ready.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
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
