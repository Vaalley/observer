import type { Command } from "../command.ts";
import { feedback } from "./feedback.ts";
import { features } from "./features.ts";
import { leaderboard } from "./leaderboard.ts";
import { livestatus } from "./livestatus.ts";
import { passport } from "./passport.ts";
import { postcards } from "./postcards.ts";
import { status } from "./status.ts";
import { survey } from "./survey.ts";

export const commands: Record<string, Command> = {
	feedback,
	features,
	leaderboard,
	livestatus,
	passport,
	postcards,
	status,
	survey,
};

export const commandList: readonly Command[] = Object.values(commands);
