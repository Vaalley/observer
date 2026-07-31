import {
	type ChatInputCommandInteraction,
	MessageFlags,
	ModalBuilder,
	type ModalSubmitInteraction,
	TextInputStyle,
} from "discord.js";
import { createFeedbackIssue, type FeedbackType } from "./github.ts";

export const FEEDBACK_MODAL_ID = "feedback:submit";

const TYPE_SELECT_ID = "type";
const DETAILS_INPUT_ID = "details";
const COOLDOWN_MS = 60_000;

const FEEDBACK_TYPE_OPTIONS: ReadonlyArray<
	{ label: string; value: FeedbackType; description: string }
> = [
	{ label: "Report a bug", value: "bug", description: "Something isn't working as expected" },
	{ label: "Request a feature", value: "enhancement", description: "Suggest something new" },
	{ label: "Other feedback", value: "other", description: "General thoughts or questions" },
];

export function buildFeedbackModal(): ModalBuilder {
	return new ModalBuilder()
		.setCustomId(FEEDBACK_MODAL_ID)
		.setTitle("Send feedback")
		.addLabelComponents(
			(label) =>
				label
					.setLabel("What kind of feedback is this?")
					.setStringSelectMenuComponent((select) =>
						select.setCustomId(TYPE_SELECT_ID).addOptions(...FEEDBACK_TYPE_OPTIONS)
					),
			(label) =>
				label
					.setLabel("Details")
					.setTextInputComponent((input) =>
						input
							.setCustomId(DETAILS_INPUT_ID)
							.setStyle(TextInputStyle.Paragraph)
							.setPlaceholder("Describe the bug, feature, or feedback in detail...")
							.setMinLength(10)
							.setMaxLength(4000)
							.setRequired(true)
					),
		);
}

export async function promptForFeedback(interaction: ChatInputCommandInteraction): Promise<void> {
	await interaction.showModal(buildFeedbackModal());
}

// Per-user submit cooldown so one person can't hammer the GitHub API with issues.
const lastSubmitAt = new Map<string, number>();

function sanitizeIdentityPart(text: string): string {
	return text.replaceAll(/[`\r\n]/g, "").trim();
}

function displayName(interaction: ModalSubmitInteraction): string {
	const name = sanitizeIdentityPart(interaction.user.globalName ?? interaction.user.username);
	const username = sanitizeIdentityPart(interaction.user.username);
	return `${name} (@${username}, ${interaction.user.id})`;
}

export async function handleFeedbackSubmit(interaction: ModalSubmitInteraction): Promise<void> {
	const lastAt = lastSubmitAt.get(interaction.user.id);
	if (lastAt !== undefined && Date.now() - lastAt < COOLDOWN_MS) {
		await interaction.reply({
			content: "You're submitting feedback too quickly. Try again in a minute.",
			flags: MessageFlags.Ephemeral,
		});
		return;
	}

	const [type] = interaction.fields.getStringSelectValues(TYPE_SELECT_ID) as [FeedbackType?];
	const details = interaction.fields.getTextInputValue(DETAILS_INPUT_ID);
	if (!type) {
		await interaction.reply({
			content: "Please choose a feedback type.",
			flags: MessageFlags.Ephemeral,
		});
		return;
	}

	lastSubmitAt.set(interaction.user.id, Date.now());
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	try {
		const issue = await createFeedbackIssue({
			type,
			details,
			reporterTag: displayName(interaction),
		});
		await interaction.editReply(`Thanks! Filed as ${issue.url}`);
	} catch (error) {
		console.error("Failed to create feedback issue:", error);
		await interaction.editReply("Failed to submit feedback. Try again later.");
	}
}
