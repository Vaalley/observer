import { escapeMarkdown, SlashCommandBuilder } from "discord.js";
import type { Command } from "../command.ts";
import { fetchPassport } from "../conduit/client.ts";
import { buildPassportEmbed } from "../passport.ts";

export const passport: Command = {
	data: new SlashCommandBuilder()
		.setName("passport")
		.setDescription("See a player's travel passport")
		.addStringOption((option) =>
			option
				.setName("player")
				.setDescription("Minecraft username")
				.setRequired(true)
		),
	async execute(interaction) {
		const name = interaction.options.getString("player", true);
		await interaction.deferReply();

		try {
			const result = await fetchPassport(name);
			if (result === null) {
				await interaction.editReply(
					`No passport for **${
						escapeMarkdown(name)
					}** yet — they may not have joined since passports began.`,
				);
				return;
			}
			await interaction.editReply({ embeds: [buildPassportEmbed(result)] });
		} catch (error) {
			console.error("Passport command failed to reach conduit:", error);
			await interaction.editReply("Couldn't reach the Minecraft server. Try again later.");
		}
	},
};
