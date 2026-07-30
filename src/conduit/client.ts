import { config } from "../config.ts";

export interface StatusResponse {
	online: number;
	players: string[];
	tps: number;
}

interface BroadcastRequest {
	sender: string;
	content: string;
}

export async function fetchStatus(): Promise<StatusResponse> {
	const response = await fetch(`${config.conduitUrl}/status`, {
		headers: { Authorization: `Bearer ${config.conduitToken}` },
	});
	if (!response.ok) {
		throw new Error(`Conduit returned ${response.status}: ${await response.text()}`);
	}
	return await response.json() as StatusResponse;
}

export async function sendBroadcast(sender: string, content: string): Promise<void> {
	const response = await fetch(`${config.conduitUrl}/broadcast`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${config.conduitToken}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ sender, content } satisfies BroadcastRequest),
	});
	if (!response.ok) {
		throw new Error(`Conduit returned ${response.status}: ${await response.text()}`);
	}
}
