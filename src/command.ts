import type { ChatInputCommandInteraction, SlashCommandOptionsOnlyBuilder } from "discord.js";
import type { SlashCommandBuilder } from "discord.js";

export interface Command {
	data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
	execute(interaction: ChatInputCommandInteraction): Promise<void>;
}
