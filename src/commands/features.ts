import { ChannelType, MessageFlags, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import type { Command } from "../command.ts";
import { isFirebaseConfigured } from "../firebase.ts";
import { postOrUpdateFeaturesMessage } from "../features.ts";

export const features: Command = {
	data: new SlashCommandBuilder()
		.setName("features")
		.setDescription("Post or refresh the bot's feature overview in a channel")
		.addChannelOption((option) =>
			option
				.setName("channel")
				.setDescription("Channel to post the feature overview in")
				.addChannelTypes(ChannelType.GuildText)
				.setRequired(true)
		),
	async execute(interaction) {
		if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
			await interaction.reply({
				content: "You need the Administrator permission to post the feature overview.",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		if (!isFirebaseConfigured()) {
			await interaction.reply({
				content: "Firebase isn't configured, so the feature overview can't be tracked for edits.",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const channel = interaction.options.getChannel("channel", true);
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		try {
			const result = await postOrUpdateFeaturesMessage(interaction.client, channel.id);
			await interaction.editReply(
				result === "posted"
					? `Posted the feature overview in <#${channel.id}>.`
					: `Updated the feature overview in <#${channel.id}>.`,
			);
		} catch (error) {
			console.error("Features command failed:", error);
			await interaction.editReply("Failed to post the feature overview.");
		}
	},
};
