import type { Command } from "../command.ts";
import { feedback } from "./feedback.ts";
import { features } from "./features.ts";
import { status } from "./status.ts";
import { survey } from "./survey.ts";

export const commands: Record<string, Command> = {
	feedback,
	features,
	status,
	survey,
};

export const commandList: readonly Command[] = Object.values(commands);
