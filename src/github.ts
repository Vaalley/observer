import { config } from "./config.ts";

export type FeedbackType = "bug" | "enhancement" | "other";

export interface FeedbackReport {
	type: FeedbackType;
	details: string;
	reporterTag: string;
}

export interface CreatedIssue {
	number: number;
	url: string;
}

/** Fixed target repo for user-submitted feedback; not configurable. */
const FEEDBACK_REPO = "Vaalley/conduit";
const GITHUB_API = "https://api.github.com";
const GITHUB_TIMEOUT_MS = 10_000;

const TYPE_LABELS: Record<FeedbackType, string> = {
	bug: "bug",
	enhancement: "enhancement",
	other: "question",
};

const TYPE_TITLES: Record<FeedbackType, string> = {
	bug: "Bug report",
	enhancement: "Feature request",
	other: "Feedback",
};

function ensureGithubToken(): string {
	if (!config.githubToken) throw new Error("GITHUB_TOKEN is not set");
	return config.githubToken;
}

/**
 * Wrap `text` in a markdown code fence sized so the text's own backtick runs
 * can't break out of it, which also stops GitHub from parsing @mentions or
 * #issue-refs inside user-submitted content.
 */
function fence(text: string): string {
	const runs = text.match(/`+/g) ?? [];
	const longestRun = runs.reduce((max, run) => Math.max(max, run.length), 0);
	const ticks = "`".repeat(Math.max(3, longestRun + 1));
	return `${ticks}\n${text}\n${ticks}`;
}

/** Collapse to one line and cap length for use in a GitHub issue title. */
function sanitizeTitleFragment(text: string, maxLength: number): string {
	const collapsed = text.replaceAll(/\s+/g, " ").trim();
	return collapsed.length > maxLength ? `${collapsed.slice(0, maxLength - 1)}\u2026` : collapsed;
}

export async function createFeedbackIssue(report: FeedbackReport): Promise<CreatedIssue> {
	const title = sanitizeTitleFragment(report.details, 200);
	const body = `**Type:** ${
		TYPE_TITLES[report.type]
	}\n**Reported by:** \`${report.reporterTag}\` via Observer\n\n${fence(report.details)}`;

	const response = await fetch(`${GITHUB_API}/repos/${FEEDBACK_REPO}/issues`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${ensureGithubToken()}`,
			Accept: "application/vnd.github+json",
			"Content-Type": "application/json",
			"X-GitHub-Api-Version": "2022-11-28",
		},
		body: JSON.stringify({ title, body, labels: [TYPE_LABELS[report.type]] }),
		signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
	});

	if (!response.ok) {
		throw new Error(`GitHub API returned ${response.status}: ${await response.text()}`);
	}

	const json = await response.json() as { number: number; html_url: string };
	return { number: json.number, url: json.html_url };
}
