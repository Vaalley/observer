import type { Command } from "../command.ts";
import { ping } from "./ping.ts";

export const commands: Record<string, Command> = {
	ping,
};

export const commandList: readonly Command[] = Object.values(commands);
