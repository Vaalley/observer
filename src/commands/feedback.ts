import { SlashCommandBuilder } from "discord.js";
import type { Command } from "../command.ts";
import { promptForFeedback } from "../feedback.ts";

export const feedback: Command = {
	data: new SlashCommandBuilder()
		.setName("feedback")
		.setDescription("Report a bug, request a feature, or send other feedback about MCTraveler"),
	async execute(interaction) {
		await promptForFeedback(interaction);
	},
};
