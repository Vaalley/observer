import { getServiceAccountToken } from "@sarfarajey/gcp-edge-auth";
import { firestoreBase, fsCreate } from "@sarfarajey/gcp-edge-auth/firestore";

const SERVICE_ACCOUNT_PATH = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_PATH");

export async function saveSurveyResponse(
	userId: string,
	responses: string[],
	completed = false,
): Promise<void> {
	if (!SERVICE_ACCOUNT_PATH) {
		throw new Error("Missing environment variable: FIREBASE_SERVICE_ACCOUNT_PATH");
	}

	const saJson = await Deno.readTextFile(SERVICE_ACCOUNT_PATH);
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
