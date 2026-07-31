import { getServiceAccountToken } from "@sarfarajey/gcp-edge-auth";
import { firestoreBase, fsUpdate } from "@sarfarajey/gcp-edge-auth/firestore";

/** Where a user is in the survey flow. Drives reminders and re-invite filtering. */
export type SurveyStatus = "invited" | "reminded" | "accepted" | "declined" | "completed";

const SURVEYS_COLLECTION = "surveys";

interface ServiceAccount {
	json: string;
	projectId: string;
}

let cachedServiceAccount: ServiceAccount | undefined;

export function isFirebaseConfigured(): boolean {
	return Boolean(
		Deno.env.get("FIREBASE_SERVICE_ACCOUNT_BASE64") ??
			Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON") ??
			Deno.env.get("FIREBASE_SERVICE_ACCOUNT_PATH"),
	);
}

async function readServiceAccountJson(): Promise<string> {
	const base64 = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_BASE64")?.replace(/\s/g, "");
	if (base64) {
		try {
			return atob(base64);
		} catch {
			throw new Error("FIREBASE_SERVICE_ACCOUNT_BASE64 is not valid base64");
		}
	}

	const json = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
	if (json) return json;

	const path = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_PATH");
	if (!path) {
		throw new Error(
			"Missing Firebase service account configuration. Set one of: FIREBASE_SERVICE_ACCOUNT_BASE64, FIREBASE_SERVICE_ACCOUNT_JSON, or FIREBASE_SERVICE_ACCOUNT_PATH.",
		);
	}

	return await Deno.readTextFile(path);
}

async function loadServiceAccount(): Promise<ServiceAccount> {
	if (cachedServiceAccount) return cachedServiceAccount;

	const json = await readServiceAccountJson();
	cachedServiceAccount = { json, projectId: JSON.parse(json).project_id };
	return cachedServiceAccount;
}

/** Base document URL plus a (library-cached) access token for the surveys database. */
async function firestore(): Promise<{ base: string; token: string }> {
	const { json, projectId } = await loadServiceAccount();
	const token = await getServiceAccountToken(json);
	if (!token) {
		throw new Error("Failed to get Firebase service account token");
	}
	return { base: firestoreBase(projectId), token };
}

/** Merge `fields` into `surveys/{userId}`, creating the document if it is new. */
async function writeSurveyFields(
	userId: string,
	fields: Record<string, unknown>,
): Promise<void> {
	const { base, token } = await firestore();
	const written = await fsUpdate(`${base}/${SURVEYS_COLLECTION}/${userId}`, fields, token);
	if (!written) {
		throw new Error(`Failed to write survey document for ${userId}`);
	}
}

interface FirestoreDocument {
	name?: string;
	fields?: Record<string, { stringValue?: string; timestampValue?: string }>;
}

/**
 * Run a structured query against the surveys database.
 *
 * Unlike the library's `fsRunQuery` this throws instead of returning `[]` on
 * failure: callers use the result to decide who has *not* been surveyed yet, so
 * an outage must not read as "nobody".
 */
async function runQuery(structuredQuery: unknown): Promise<FirestoreDocument[]> {
	const { base, token } = await firestore();
	const response = await fetch(`${base}:runQuery`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify({ structuredQuery }),
	});

	if (!response.ok) {
		throw new Error(`Firestore query failed with ${response.status}: ${await response.text()}`);
	}

	const results = await response.json() as Array<{ document?: FirestoreDocument }>;
	if (!Array.isArray(results)) return [];
	return results.flatMap((result) => result.document ? [result.document] : []);
}

/** The document id of `surveys/{userId}` is the Discord user id. */
function documentUserId(document: FirestoreDocument): string | undefined {
	return document.name?.split("/").pop();
}

/** Record that an invite DM went out, resetting any state from an earlier run. */
export async function recordSurveyInvite(userId: string, username: string): Promise<void> {
	const now = new Date().toISOString();
	await writeSurveyFields(userId, {
		userId: { stringValue: userId },
		username: { stringValue: username },
		status: { stringValue: "invited" },
		invitedAt: { timestampValue: now },
		remindedAt: { nullValue: null },
		completedAt: { nullValue: null },
		updatedAt: { timestampValue: now },
	});
}

export async function setSurveyStatus(
	userId: string,
	username: string,
	status: SurveyStatus,
): Promise<void> {
	await writeSurveyFields(userId, {
		userId: { stringValue: userId },
		username: { stringValue: username },
		status: { stringValue: status },
		updatedAt: { timestampValue: new Date().toISOString() },
	});
}

export async function markSurveyReminded(userId: string): Promise<void> {
	const now = new Date().toISOString();
	await writeSurveyFields(userId, {
		status: { stringValue: "reminded" },
		remindedAt: { timestampValue: now },
		updatedAt: { timestampValue: now },
	});
}

export async function saveSurveyResponse(
	userId: string,
	username: string,
	responses: string[],
	completed = false,
): Promise<void> {
	const now = new Date().toISOString();
	const fields: Record<string, unknown> = {
		userId: { stringValue: userId },
		username: { stringValue: username },
		status: { stringValue: completed ? "completed" : "accepted" },
		responses: {
			arrayValue: { values: responses.map((r) => ({ stringValue: r })) },
		},
		updatedAt: { timestampValue: now },
	};

	if (completed) {
		fields.completedAt = { timestampValue: now };
	}

	await writeSurveyFields(userId, fields);
}

/** Every user who has ever been sent a survey invite. */
export async function listInvitedUserIds(): Promise<Set<string>> {
	const documents = await runQuery({
		from: [{ collectionId: SURVEYS_COLLECTION }],
		select: { fields: [{ fieldPath: "__name__" }] },
	});

	const userIds = new Set<string>();
	for (const document of documents) {
		const userId = documentUserId(document);
		if (userId) userIds.add(userId);
	}
	return userIds;
}

/**
 * Users invited before `invitedBefore` who have neither replied nor been
 * reminded. Filtering `invitedAt` here rather than in the query keeps this to a
 * single equality filter, which Firestore indexes automatically.
 */
export async function listUsersAwaitingReminder(invitedBefore: Date): Promise<string[]> {
	const documents = await runQuery({
		from: [{ collectionId: SURVEYS_COLLECTION }],
		where: {
			fieldFilter: {
				field: { fieldPath: "status" },
				op: "EQUAL",
				value: { stringValue: "invited" },
			},
		},
	});

	const userIds: string[] = [];
	for (const document of documents) {
		const userId = documentUserId(document);
		const invitedAt = document.fields?.invitedAt?.timestampValue;
		if (!userId || !invitedAt) continue;
		if (new Date(invitedAt) > invitedBefore) continue;
		userIds.push(userId);
	}
	return userIds;
}

const BOT_STATE_COLLECTION = "botState";
const FEATURES_MESSAGE_DOC_ID = "featuresMessage";

export interface FeaturesMessageState {
	channelId: string;
	messageId: string;
}

/** The channel/message Observer is currently keeping the feature overview in, if any. */
export async function getFeaturesMessageState(): Promise<FeaturesMessageState | undefined> {
	const { base, token } = await firestore();
	const response = await fetch(`${base}/${BOT_STATE_COLLECTION}/${FEATURES_MESSAGE_DOC_ID}`, {
		headers: { Authorization: `Bearer ${token}` },
	});

	if (response.status === 404) return undefined;
	if (!response.ok) {
		throw new Error(`Firestore read failed with ${response.status}: ${await response.text()}`);
	}

	const document = await response.json() as FirestoreDocument;
	const channelId = document.fields?.channelId?.stringValue;
	const messageId = document.fields?.messageId?.stringValue;
	if (!channelId || !messageId) return undefined;
	return { channelId, messageId };
}

/** Remember which message holds the feature overview, so future runs edit it in place. */
export async function saveFeaturesMessageState(
	channelId: string,
	messageId: string,
): Promise<void> {
	const { base, token } = await firestore();
	const written = await fsUpdate(`${base}/${BOT_STATE_COLLECTION}/${FEATURES_MESSAGE_DOC_ID}`, {
		channelId: { stringValue: channelId },
		messageId: { stringValue: messageId },
		updatedAt: { timestampValue: new Date().toISOString() },
	}, token);
	if (!written) {
		throw new Error("Failed to write features message state");
	}
}
