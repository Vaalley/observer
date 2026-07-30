import { MessageFlags, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import type { Command } from "../command.ts";
import { sendBroadcast } from "../conduit/client.ts";

export const broadcast: Command = {
	data: new SlashCommandBuilder()
		.setName("broadcast")
		.setDescription("Broadcast a message to players in-game")
		.addStringOption((option) =>
			option
				.setName("message")
				.setDescription("The message to broadcast")
				.setRequired(true)
		),
	async execute(interaction) {
		if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
			await interaction.reply({
				content: "You need the Administrator permission to broadcast.",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}
		const message = interaction.options.getString("message", true);
		await sendBroadcast(interaction.user.displayName, message);
		await interaction.reply({
			content: "Broadcast sent!",
			flags: MessageFlags.Ephemeral,
		});
	},
};
