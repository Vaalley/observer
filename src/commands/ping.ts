import { MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../command.ts";

export const ping: Command = {
	data: new SlashCommandBuilder()
		.setName("ping")
		.setDescription("Check that Observer is alive"),
	async execute(interaction) {
		await interaction.reply({
			content: `Pong! Gateway latency: ${interaction.client.ws.ping}ms`,
			flags: MessageFlags.Ephemeral,
		});
	},
};
