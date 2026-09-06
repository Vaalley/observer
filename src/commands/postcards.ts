import { ChannelType, MessageFlags, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import type { Command } from "../command.ts";
import { isFirebaseConfigured, savePostcardsChannelId } from "../firebase.ts";

export const postcards: Command = {
	data: new SlashCommandBuilder()
		.setName("postcards")
		.setDescription("Configure postcard delivery")
		.addSubcommand((subcommand) =>
			subcommand
				.setName("setup")
				.setDescription("Choose where postcards are posted")
				.addChannelOption((option) =>
					option
						.setName("channel")
						.setDescription("Channel to post postcards in")
						.addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
						.setRequired(true)
				)
		),
	async execute(interaction) {
		if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
			await interaction.reply({
				content: "You need the Administrator permission to configure postcards.",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		if (!isFirebaseConfigured()) {
			await interaction.reply({
				content: "Firebase isn't configured, so the postcards channel can't be saved.",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const channel = interaction.options.getChannel("channel", true);
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		try {
			await savePostcardsChannelId(channel.id);
			await interaction.editReply(`Postcards will be posted in <#${channel.id}>.`);
		} catch (error) {
			console.error("Postcards setup failed:", error);
			await interaction.editReply("Failed to save the postcards channel.");
		}
	},
};
