import { getServiceAccountToken } from "@sarfarajey/gcp-edge-auth";
import { firestoreBase, fsCreate } from "@sarfarajey/gcp-edge-auth/firestore";

async function loadServiceAccountJson(): Promise<string> {
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

export async function saveSurveyResponse(
	userId: string,
	responses: string[],
	completed = false,
): Promise<void> {
	const saJson = await loadServiceAccountJson();
	const serviceAccount = JSON.parse(saJson);
	const projectId = serviceAccount.project_id;

	const token = await getServiceAccountToken(saJson);
	if (!token) {
		throw new Error("Failed to get Firebase service account token");
	}

	const base = firestoreBase(projectId);
	const fields: Record<string, unknown> = {
		userId: { stringValue: userId },
		responses: {
			arrayValue: { values: responses.map((r) => ({ stringValue: r })) },
		},
		updatedAt: { timestampValue: new Date().toISOString() },
	};

	if (completed) {
		fields.completedAt = { timestampValue: new Date().toISOString() };
	}

	const created = await fsCreate(`${base}/surveys/${userId}`, fields, token);
	if (!created) {
		throw new Error("Failed to save survey response to Firestore");
	}
}
