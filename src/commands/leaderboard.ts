import { SlashCommandBuilder } from "discord.js";
import type { Command } from "../command.ts";
import { fetchTop, type LeaderboardMetric } from "../conduit/client.ts";
import { buildLeaderboardEmbed } from "../passport.ts";

export const leaderboard: Command = {
	data: new SlashCommandBuilder()
		.setName("leaderboard")
		.setDescription("Show the top travelers")
		.addStringOption((option) =>
			option
				.setName("by")
				.setDescription("Leaderboard metric")
				.setRequired(false)
				.addChoices(
					{ name: "Distance", value: "distance" },
					{ name: "Biomes", value: "biomes" },
					{ name: "Embassies", value: "embassies" },
					{ name: "Stamps", value: "stamps" },
					{ name: "Blocks mined", value: "mined" },
				)
		),
	async execute(interaction) {
		const by = interaction.options.getString("by") as LeaderboardMetric | null ?? "distance";
		await interaction.deferReply();

		try {
			const entries = await fetchTop(by);
			await interaction.editReply({ embeds: [buildLeaderboardEmbed(by, entries)] });
		} catch (error) {
			console.error("Leaderboard command failed to reach conduit:", error);
			await interaction.editReply("Couldn't reach the Minecraft server. Try again later.");
		}
	},
};
