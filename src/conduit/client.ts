import { config } from "../config.ts";

export interface PlayerSession {
	name: string;
	joinedAt: number | null;
}

export interface StatusResponse {
	online: number;
	players: string[];
	tps: number;
	sessions?: PlayerSession[];
	startedAt?: number;
	minecraftVersion?: string;
	modVersion?: string;
	dayTime?: number;
	raining?: boolean;
	thundering?: boolean;
}

export interface ChatMessage {
	timestamp: number;
	sender: string;
	content: string;
}

export interface PassportRegion {
	id: string;
	title: string;
	embassy: boolean;
	owner: string | null;
	at: number;
}

export interface PassportDistance {
	walk: number;
	ride: number;
	fly: number;
	swim: number;
	total: number;
}

export interface PassportResponse {
	name: string;
	firstJoin: number;
	biomes: string[];
	biomeCount: number;
	dimensions: string[];
	regions: PassportRegion[];
	distance: PassportDistance;
	deaths: number;
	rank: {
		distance: number;
		biomes: number;
		embassies: number;
	};
}

export type LeaderboardMetric = "distance" | "biomes" | "embassies";

export interface TopEntry {
	name: string;
	value: number;
}

interface ChatResponse {
	messages: ChatMessage[];
}

interface TopResponse {
	by: LeaderboardMetric;
	entries: TopEntry[];
}

interface BroadcastRequest {
	sender: string;
	content: string;
}

const CONDUIT_TIMEOUT_MS = 5_000;

function ensureToken(): string {
	if (!config.conduitToken) throw new Error("CONDUIT_TOKEN is not set");
	return config.conduitToken;
}

export async function fetchStatus(): Promise<StatusResponse> {
	const response = await fetch(`${config.conduitUrl}/status`, {
		headers: { Authorization: `Bearer ${ensureToken()}` },
		signal: AbortSignal.timeout(CONDUIT_TIMEOUT_MS),
	});
	if (!response.ok) {
		throw new Error(`Conduit returned ${response.status}`);
	}
	return await response.json() as StatusResponse;
}

export async function sendBroadcast(sender: string, content: string): Promise<void> {
	const response = await fetch(`${config.conduitUrl}/broadcast`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${ensureToken()}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ sender, content } satisfies BroadcastRequest),
		signal: AbortSignal.timeout(CONDUIT_TIMEOUT_MS),
	});
	if (!response.ok) {
		throw new Error(`Conduit returned ${response.status}`);
	}
}

export async function fetchChat(since: number): Promise<ChatMessage[]> {
	const response = await fetch(`${config.conduitUrl}/chat?since=${since}`, {
		headers: { Authorization: `Bearer ${ensureToken()}` },
		signal: AbortSignal.timeout(CONDUIT_TIMEOUT_MS),
	});
	if (!response.ok) {
		throw new Error(`Conduit returned ${response.status}`);
	}
	const body = await response.json() as ChatResponse;
	return body.messages;
}

export async function fetchPassport(name: string): Promise<PassportResponse | null> {
	const response = await fetch(
		`${config.conduitUrl}/passport?name=${encodeURIComponent(name)}`,
		{
			headers: { Authorization: `Bearer ${ensureToken()}` },
			signal: AbortSignal.timeout(CONDUIT_TIMEOUT_MS),
		},
	);
	if (response.status === 404) return null;
	if (!response.ok) {
		throw new Error(`Conduit returned ${response.status}`);
	}
	return await response.json() as PassportResponse;
}

export async function fetchTop(
	by: LeaderboardMetric,
	limit = 10,
): Promise<TopEntry[]> {
	const response = await fetch(`${config.conduitUrl}/passports/top?by=${by}&limit=${limit}`, {
		headers: { Authorization: `Bearer ${ensureToken()}` },
		signal: AbortSignal.timeout(CONDUIT_TIMEOUT_MS),
	});
	if (!response.ok) {
		throw new Error(`Conduit returned ${response.status}`);
	}
	const body = await response.json() as TopResponse;
	return body.entries;
}
