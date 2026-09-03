import { ChannelType, MessageFlags, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import type { Command } from "../command.ts";
import { isFirebaseConfigured } from "../firebase.ts";
import { postOrUpdateLiveStatusMessage } from "../live-status.ts";

export const livestatus: Command = {
	data: new SlashCommandBuilder()
		.setName("livestatus")
		.setDescription("Post or refresh the auto-updating server status message in a channel")
		.addChannelOption((option) =>
			option
				.setName("channel")
				.setDescription("Channel to post the live status message in")
				.addChannelTypes(ChannelType.GuildText)
				.setRequired(true)
		),
	async execute(interaction) {
		if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
			await interaction.reply({
				content: "You need the Administrator permission to post the live status message.",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		if (!isFirebaseConfigured()) {
			await interaction.reply({
				content:
					"Firebase isn't configured, so the live status message can't be tracked for edits.",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const channel = interaction.options.getChannel("channel", true);
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		try {
			const result = await postOrUpdateLiveStatusMessage(interaction.client, channel.id);
			await interaction.editReply(
				result === "posted"
					? `Posted the live status message in <#${channel.id}>. It updates every minute.`
					: `Updated the live status message in <#${channel.id}>. It updates every minute.`,
			);
		} catch (error) {
			console.error("Live status command failed:", error);
			await interaction.editReply("Failed to post the live status message.");
		}
	},
};
