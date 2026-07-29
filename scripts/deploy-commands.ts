import { REST, Routes } from "discord.js";
import { config } from "../src/config.ts";
import { commandList } from "../src/commands/mod.ts";

const rest = new REST().setToken(config.token);

const body = commandList.map((command) => command.data.toJSON());

await rest.put(Routes.applicationGuildCommands(config.appId, config.guildId), { body });

console.info(`Registered ${body.length} command(s) in guild ${config.guildId}`);
