import {
	ActionRowBuilder,
	ButtonBuilder,
	type ButtonInteraction,
	ButtonStyle,
	ChannelType,
	type ChatInputCommandInteraction,
	type Client,
	type Message,
	Routes,
} from "discord.js";
import {
	isFirebaseConfigured,
	listInvitedUserIds,
	listUsersAwaitingReminder,
	markSurveyReminded,
	recordSurveyInvite,
	saveSurveyResponse,
	setSurveyStatus,
	type SurveyStatus,
} from "./firebase.ts";

const INVITE_TEXT = "Hey! We're taking a survey to improve the MCTraveler Minecraft server. " +
	"Would you be up for answering 5 quick questions? Can be done in literally 1 minute!";

const REMINDER_TEXT =
	"Hey, just checking in to see if you could answer the above? I won't bother you again. :)";

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
const MAX_DM_ATTEMPTS = 3;
const REMINDER_AFTER_MS = 24 * 60 * 60 * 1000;
const REMINDER_SWEEP_INTERVAL_MS = 60 * 60 * 1000;

/** A user the survey should go to, and how they were picked. */
export interface SurveyTarget {
	userId: string;
	username: string;
	/** Named directly, rather than swept in by a role or `@everyone`. */
	explicit: boolean;
}

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

/**
 * DM a user, retrying only on rate limits. Discord returns the existing DM
 * channel for a recipient, so follow-ups land under the original invite.
 */
async function sendDirectMessage(
	client: Client,
	userId: string,
	body: Record<string, unknown>,
): Promise<void> {
	let attempt = 0;

	while (true) {
		attempt++;
		try {
			const channel = await client.rest.post(Routes.userChannels(), {
				body: { recipient_id: userId },
			}) as { id: string };
			await client.rest.post(Routes.channelMessages(channel.id), { body });
			return;
		} catch (error) {
			const retryAfter = getRetryAfter(error);
			if (retryAfter === undefined || attempt >= MAX_DM_ATTEMPTS) throw error;
			console.warn(`Rate limited while sending a DM; retrying in ${retryAfter}ms`);
			await sleep(retryAfter + DM_RETRY_BUFFER_MS);
		}
	}
}

export async function sendSurveyInvites(
	client: Client,
	targets: SurveyTarget[],
): Promise<{ sent: number; failed: number; skipped: number }> {
	// Only re-survey someone who was named directly; roles and @everyone skip
	// anyone who already got an invite.
	const alreadyInvited = await listInvitedUserIds();
	const pending = targets.filter((target) => target.explicit || !alreadyInvited.has(target.userId));
	const skipped = targets.length - pending.length;

	const components = inviteComponents().map((row) => row.toJSON());
	let sent = 0;
	let failed = 0;

	for (const [index, target] of pending.entries()) {
		if (index > 0) await sleep(DM_DELAY_MS);

		try {
			await sendDirectMessage(client, target.userId, { content: INVITE_TEXT, components });
			sent++;
		} catch (error) {
			console.warn(`Failed to send survey invite to ${target.userId}:`, error);
			failed++;
			continue;
		}

		// Recorded after the DM lands, so a failed send is not treated as invited.
		try {
			await recordSurveyInvite(target.userId, target.username);
		} catch (error) {
			console.error(`Failed to record survey invite for ${target.userId}:`, error);
		}
	}

	return { sent, failed, skipped };
}

/** Bookkeeping only — never block the reply the user is waiting on. */
async function recordStatus(interaction: ButtonInteraction, status: SurveyStatus): Promise<void> {
	try {
		await setSurveyStatus(interaction.user.id, interaction.user.username, status);
	} catch (error) {
		console.error(`Failed to record survey ${status} for ${interaction.user.id}:`, error);
	}
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
		await recordStatus(interaction, "declined");
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
	await recordStatus(interaction, "accepted");
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
		await saveSurveyResponse(
			message.author.id,
			message.author.username,
			session.answers,
			completed,
		);
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

async function sweepSurveyReminders(client: Client): Promise<void> {
	const invitedBefore = new Date(Date.now() - REMINDER_AFTER_MS);
	const userIds = await listUsersAwaitingReminder(invitedBefore);

	for (const [index, userId] of userIds.entries()) {
		if (index > 0) await sleep(DM_DELAY_MS);

		try {
			// Marked before sending: the reminder promises not to bother them
			// again, so dropping one beats sending it twice.
			await markSurveyReminded(userId);
			await sendDirectMessage(client, userId, { content: REMINDER_TEXT });
		} catch (error) {
			console.warn(`Failed to send survey reminder to ${userId}:`, error);
		}
	}
}

/** Nudge, once, anyone who has sat on an invite for 24 hours. */
export function startSurveyReminders(client: Client) {
	if (!isFirebaseConfigured()) {
		console.info("Firebase service account not set; survey reminders disabled");
		return;
	}

	const sweep = async () => {
		try {
			await sweepSurveyReminders(client);
		} catch (error) {
			console.error("Survey reminder sweep failed:", error);
		}
	};

	const schedule = () => {
		setTimeout(() => {
			sweep().finally(schedule);
		}, REMINDER_SWEEP_INTERVAL_MS);
	};

	sweep().finally(schedule);
}

const USER_MENTION_RE = /<@!?(\d{17,20})>/g;
const ROLE_MENTION_RE = /<@&(\d{17,20})>/g;

interface RawUser {
	id: string;
	username: string;
	global_name?: string | null;
	display_name?: string | null;
	bot?: boolean;
}

interface RawMember {
	user: RawUser;
	roles: string[];
	nick?: string | null;
}

interface MemberInfo {
	userId: string;
	username: string;
	globalName?: string | null;
	nick?: string | null;
	roles: string[];
}

function displayNameFor(member: MemberInfo): string {
	return member.nick ?? member.globalName ?? member.username;
}

async function fetchAllGuildMembers(
	interaction: ChatInputCommandInteraction,
): Promise<MemberInfo[]> {
	const client = interaction.client;
	const guildId = interaction.guildId;
	if (!guildId) return [];

	const all: MemberInfo[] = [];
	let after: string | undefined;

	while (true) {
		const query = new URLSearchParams({ limit: "1000" });
		if (after) query.set("after", after);

		const page = await client.rest.get(Routes.guildMembers(guildId), { query }) as RawMember[];
		if (!Array.isArray(page) || page.length === 0) break;

		for (const raw of page) {
			// Advance the cursor past bots too, or a page ending in one repeats forever.
			after = raw.user.id;
			if (raw.user.bot) continue;
			all.push({
				userId: raw.user.id,
				username: raw.user.username,
				globalName: raw.user.global_name ?? raw.user.display_name,
				nick: raw.nick,
				roles: raw.roles,
			});
		}

		if (page.length < 1000) break;
	}

	return all;
}

async function fetchSingleMember(
	interaction: ChatInputCommandInteraction,
	userId: string,
): Promise<MemberInfo | undefined> {
	const client = interaction.client;
	const guildId = interaction.guildId;
	if (!guildId) return undefined;

	try {
		const raw = await client.rest.get(Routes.guildMember(guildId, userId)) as RawMember;
		if (!raw || raw.user.bot) return undefined;
		return {
			userId: raw.user.id,
			username: raw.user.username,
			globalName: raw.user.global_name ?? raw.user.display_name,
			nick: raw.nick,
			roles: raw.roles,
		};
	} catch {
		return undefined;
	}
}

function normalizeName(text: string): string {
	return text.trim().replace(/[,;]+$/g, "").trim().toLowerCase();
}

export async function resolveSurveyTargets(
	interaction: ChatInputCommandInteraction,
	mentionsText: string,
): Promise<SurveyTarget[]> {
	if (!interaction.guildId) return [];

	const explicitUserIds = new Set<string>();
	for (const match of mentionsText.matchAll(USER_MENTION_RE)) {
		explicitUserIds.add(match[1]!);
	}

	const roleIds = new Set<string>();
	for (const match of mentionsText.matchAll(ROLE_MENTION_RE)) {
		roleIds.add(match[1]!);
	}

	const targetEveryone = mentionsText.includes("@everyone") || mentionsText.includes("@here");

	const leftover = mentionsText
		.replaceAll(USER_MENTION_RE, "")
		.replaceAll(ROLE_MENTION_RE, "");
	const nameParts = leftover
		.split("@")
		.map(normalizeName)
		.filter((part) => part.length > 0 && part !== "everyone" && part !== "here");

	const needAllMembers = targetEveryone || roleIds.size > 0 || nameParts.length > 0;
	const membersById = new Map<string, MemberInfo>();

	if (needAllMembers) {
		for (const member of await fetchAllGuildMembers(interaction)) {
			membersById.set(member.userId, member);
		}
	}

	for (const userId of explicitUserIds) {
		if (membersById.has(userId)) continue;
		const member = await fetchSingleMember(interaction, userId);
		if (member) membersById.set(member.userId, member);
	}

	// Free-text names are either a role name or a member name.
	const targetRoleIds = new Set<string>(roleIds);
	if (nameParts.length > 0) {
		const guildRoles = await interaction.guild?.roles.fetch();
		const roleIdsByName = new Map<string, string>();
		if (guildRoles) {
			for (const [id, role] of guildRoles) {
				roleIdsByName.set(role.name.toLowerCase(), id);
			}
		}

		for (const part of nameParts) {
			const matchedRoleId = roleIdsByName.get(part);
			if (matchedRoleId) {
				targetRoleIds.add(matchedRoleId);
				continue;
			}

			const matchedByName = [...membersById.values()].find((member) =>
				displayNameFor(member).toLowerCase() === part ||
				member.username.toLowerCase() === part ||
				(member.globalName?.toLowerCase() === part)
			);
			if (matchedByName) explicitUserIds.add(matchedByName.userId);
		}
	}

	const targets: SurveyTarget[] = [];
	for (const member of membersById.values()) {
		const explicit = explicitUserIds.has(member.userId);
		const included = targetEveryone || explicit ||
			member.roles.some((roleId) => targetRoleIds.has(roleId));
		if (!included) continue;
		targets.push({ userId: member.userId, username: member.username, explicit });
	}

	return targets;
}
