import type { Command } from "../command.ts";
import { broadcast } from "./broadcast.ts";
import { ping } from "./ping.ts";
import { status } from "./status.ts";

export const commands: Record<string, Command> = {
	broadcast,
	ping,
	status,
};

export const commandList: readonly Command[] = Object.values(commands);
