import { MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../command.ts";
import { fetchStatus } from "../conduit/client.ts";
import { buildStatusEmbed, buildUnreachableStatusEmbed } from "../status.ts";

export const status: Command = {
	data: new SlashCommandBuilder()
		.setName("status")
		.setDescription("Show the MCTraveler server status"),
	async execute(interaction) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		let serverStatus;
		try {
			serverStatus = await fetchStatus();
		} catch (error) {
			console.error("Status command failed to reach conduit:", error);
			await interaction.editReply({ embeds: [buildUnreachableStatusEmbed()] });
			return;
		}

		const embed = buildStatusEmbed(
			serverStatus,
			interaction.client.ws.ping,
			interaction.user.displayName,
		);
		await interaction.editReply({ embeds: [embed] });
	},
};
