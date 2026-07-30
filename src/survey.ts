import {
	ActionRowBuilder,
	ButtonBuilder,
	type ButtonInteraction,
	ButtonStyle,
	ChannelType,
	type ChatInputCommandInteraction,
	type GuildMember,
	type Message,
	type User,
} from "discord.js";
import { saveSurveyResponse } from "./firebase.ts";

const INVITE_TEXT =
	"Hey! We're taking a survey for MCTraveler, a server you have played on before. " +
	"Would you be up for answering 5 quick questions?";

export const SURVEY_QUESTIONS = [
	"Great! Do you regularly join the server? Text me your response",
	"Okay, and is there something we can change/improve to make playing MCTraveler more desirable for you? Text me your response",
	"What's your biggest grievances with the current state of MCTraveler and its features? If you've not been on in a while, feel free to just say none! Text me your response",
	"Do you have any radical ideas to help improve MCTraveler? Text me your response",
	"Finally, what would you NOT change if anything about MCTraveler? Text me your response",
];

const ACCEPT_ID = "survey:accept";
const DECLINE_ID = "survey:decline";
const DM_DELAY_MS = 350;
const DM_RETRY_BUFFER_MS = 500;

interface SurveySession {
	userId: string;
	questionIndex: number;
	answers: string[];
}

const sessions = new Map<string, SurveySession>();

function inviteComponents() {
	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(ACCEPT_ID)
			.setLabel("I'd love to answer 5 questions")
			.setStyle(ButtonStyle.Primary),
		new ButtonBuilder()
			.setCustomId(DECLINE_ID)
			.setLabel("No thanks")
			.setStyle(ButtonStyle.Secondary),
	);
	return [row];
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryAfter(error: unknown): number | undefined {
	if (typeof error !== "object" || error === null) return undefined;
	const rawError = (error as { rawError?: { retry_after?: number } }).rawError;
	if (typeof rawError?.retry_after === "number") {
		return rawError.retry_after * 1000;
	}
	const retryAfter = (error as { retryAfter?: number }).retryAfter;
	if (typeof retryAfter === "number") {
		return retryAfter;
	}
	return undefined;
}

export async function sendSurveyInvites(users: User[]): Promise<{ sent: number; failed: number }> {
	let sent = 0;
	let failed = 0;

	for (const user of users) {
		let attempt = 0;
		const maxAttempts = 3;

		while (attempt < maxAttempts) {
			attempt++;
			try {
				await user.send({ content: INVITE_TEXT, components: inviteComponents() });
				sent++;
				break;
			} catch (error) {
				const retryAfter = getRetryAfter(error);
				if (retryAfter !== undefined && attempt < maxAttempts) {
					console.warn(`Rate limited while sending survey; retrying in ${retryAfter}ms`);
					await sleep(retryAfter + DM_RETRY_BUFFER_MS);
					continue;
				}

				console.warn(`Failed to send survey invite to ${user.id}:`, error);
				failed++;
				break;
			}
		}

		if (users.indexOf(user) < users.length - 1) {
			await sleep(DM_DELAY_MS);
		}
	}

	return { sent, failed };
}

export async function handleSurveyButton(interaction: ButtonInteraction): Promise<boolean> {
	if (interaction.customId !== ACCEPT_ID && interaction.customId !== DECLINE_ID) {
		return false;
	}

	if (interaction.customId === DECLINE_ID) {
		sessions.delete(interaction.user.id);
		await interaction.update({
			content: "No problem, maybe next time!",
			components: [],
		});
		return true;
	}

	const session: SurveySession = {
		userId: interaction.user.id,
		questionIndex: 0,
		answers: [],
	};
	sessions.set(interaction.user.id, session);

	const firstQuestion = SURVEY_QUESTIONS[0];
	if (!firstQuestion) return false;
	await interaction.update({
		content: firstQuestion,
		components: [],
	});
	return true;
}

export async function handleSurveyMessage(message: Message): Promise<void> {
	if (message.channel.type !== ChannelType.DM) return;
	if (message.author.bot) return;

	const session = sessions.get(message.author.id);
	if (!session) return;

	const answer = message.content.trim();
	if (answer.length === 0) return;

	session.answers[session.questionIndex] = answer;
	session.questionIndex++;

	const completed = session.questionIndex >= SURVEY_QUESTIONS.length;

	try {
		await saveSurveyResponse(message.author.id, session.answers, completed);
	} catch (error) {
		console.error(`Failed to save survey answer for ${message.author.id}:`, error);
		sessions.delete(message.author.id);
		await message.author.send(
			"Sorry, I couldn't save your answer. Please try the survey again later.",
		);
		return;
	}

	if (completed) {
		sessions.delete(message.author.id);
		await message.author.send("Thank you! Your responses have been recorded.");
		return;
	}

	const nextQuestion = SURVEY_QUESTIONS[session.questionIndex];
	if (!nextQuestion) return;
	await message.author.send(nextQuestion);
}

const USER_MENTION_RE = /<@!?(\d{17,20})>/g;
const ROLE_MENTION_RE = /<@&(\d{17,20})>/g;

function normalizeName(text: string): string {
	return text.trim().replace(/[,;]+$/g, "").trim().toLowerCase();
}

async function resolveMentionedUsers(
	interaction: ChatInputCommandInteraction,
	mentionsText: string,
): Promise<User[]> {
	const guild = interaction.guild;
	if (!guild) return [];

	const userIds = new Set<string>();
	for (const match of mentionsText.matchAll(USER_MENTION_RE)) {
		userIds.add(match[1]!);
	}

	const roleIds = new Set<string>();
	for (const match of mentionsText.matchAll(ROLE_MENTION_RE)) {
		roleIds.add(match[1]!);
	}

	const targetEveryone = mentionsText.includes("@everyone") || mentionsText.includes("@here");
	const membersById = new Map<string, GuildMember>();

	if (targetEveryone) {
		const everyone = await guild.members.fetch();
		everyone.forEach((member) => membersById.set(member.id, member));
		return [...membersById.values()]
			.filter((member) => !member.user.bot)
			.map((member) => member.user);
	}

	const allMembers = await guild.members.fetch();
	const allRoles = await guild.roles.fetch();

	for (const roleId of roleIds) {
		const role = allRoles.get(roleId);
		if (!role) continue;
		allMembers
			.filter((member) => member.roles.cache.has(role.id))
			.forEach((member) => membersById.set(member.id, member));
	}

	for (const userId of userIds) {
		const member = allMembers.get(userId);
		if (member) membersById.set(member.id, member);
	}

	const leftover = mentionsText
		.replaceAll(USER_MENTION_RE, "")
		.replaceAll(ROLE_MENTION_RE, "");
	const nameParts = leftover
		.split("@")
		.map(normalizeName)
		.filter((part) => part.length > 0 && part !== "everyone" && part !== "here");

	for (const part of nameParts) {
		const roleByName = allRoles.find((role) => role.name.toLowerCase() === part);
		if (roleByName) {
			allMembers
				.filter((member) => member.roles.cache.has(roleByName.id))
				.forEach((member) => membersById.set(member.id, member));
			continue;
		}

		const memberByName = allMembers.find((member) =>
			member.displayName.toLowerCase() === part ||
			member.user.username.toLowerCase() === part ||
			(member.user.globalName?.toLowerCase() === part)
		);
		if (memberByName) membersById.set(memberByName.id, memberByName);
	}

	return [...membersById.values()]
		.filter((member) => !member.user.bot)
		.map((member) => member.user);
}

export { resolveMentionedUsers };
