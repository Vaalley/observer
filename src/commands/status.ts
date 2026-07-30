import { MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../command.ts";
import { fetchStatus } from "../conduit/client.ts";

export const status: Command = {
	data: new SlashCommandBuilder()
		.setName("status")
		.setDescription("Show the MCTraveler server status"),
	async execute(interaction) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		const serverStatus = await fetchStatus();
		const players = serverStatus.players.length > 0
			? serverStatus.players.join(", ")
			: "No players online";
		await interaction.editReply(
			`Players online (${serverStatus.online}): ${players}\nTPS: ${serverStatus.tps.toFixed(1)}`,
		);
	},
};
