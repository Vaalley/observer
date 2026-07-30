import { MessageFlags, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import type { Command } from "../command.ts";
import { resolveMentionedUsers, sendSurveyInvites } from "../survey.ts";

export const survey: Command = {
	data: new SlashCommandBuilder()
		.setName("survey")
		.setDescription("Send an MCTraveler survey to the mentioned users, roles, or @everyone")
		.addStringOption((option) =>
			option
				.setName("mentions")
				.setDescription(
					"Users, roles, or @everyone to survey (e.g. @everyone @role @user)",
				)
				.setRequired(true)
		),
	async execute(interaction) {
		if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
			await interaction.reply({
				content: "You need the Administrator permission to run a survey.",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const mentionsText = interaction.options.getString("mentions", true);
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		try {
			const users = await resolveMentionedUsers(interaction, mentionsText);
			if (users.length === 0) {
				await interaction.editReply("No matching users found.");
				return;
			}

			const { sent, failed } = await sendSurveyInvites(users);
			await interaction.editReply(
				`Survey sent to ${sent} user(s)${failed > 0 ? `, ${failed} failed` : ""}.`,
			);
		} catch (error) {
			console.error("Survey command failed:", error);
			await interaction.editReply("Failed to send survey invites.");
		}
	},
};
