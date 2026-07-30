import { config } from "../config.ts";

export interface StatusResponse {
	online: number;
	players: string[];
	tps: number;
}

export interface ChatMessage {
	timestamp: number;
	sender: string;
	content: string;
}

interface ChatResponse {
	messages: ChatMessage[];
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
