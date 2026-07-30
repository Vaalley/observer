import { MessageFlags, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import type { Command } from "../command.ts";
import { sendBroadcast } from "../conduit/client.ts";

const MAX_BROADCAST_LENGTH = 256;

function sanitizeBroadcast(text: string): string {
	return text
		.replaceAll(/[\r\n]/g, " ")
		.replaceAll("§", "")
		.slice(0, MAX_BROADCAST_LENGTH)
		.trim();
}

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
		const message = sanitizeBroadcast(interaction.options.getString("message", true));
		if (message.length === 0) {
			await interaction.reply({
				content: "The broadcast message was empty after sanitization.",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		const sender = sanitizeBroadcast(interaction.user.displayName);
		await sendBroadcast(sender, message);
		await interaction.editReply("Broadcast sent!");
	},
};
