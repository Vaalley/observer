# MCTraveler - Observer

Observer is the Discord bot for the MCTraveler Minecraft server. It gives admins and players tools
to interact with the server from Discord.

The Minecraft side lives in [conduit](https://github.com/Vaalley/conduit).

## Requirements

- [Deno](https://deno.com/) 2.9+
- A Discord application with a bot user

## Setup

```sh
cp .env.example .env
```

Fill in `DISCORD_TOKEN`, `DISCORD_APP_ID` and `DISCORD_GUILD_ID`. Only the token is secret; see
[.env.example](.env.example) for where each value comes from.

Then invite the bot to the server, replacing the id with your `DISCORD_APP_ID`:

```
https://discord.com/oauth2/authorize?client_id=DISCORD_APP_ID&permissions=0&scope=bot%20applications.commands
```

The `applications.commands` scope is required, otherwise registering commands fails with
`403 Missing Access`.

## Register slash commands

Run once, and again whenever commands change:

```sh
deno task deploy
```

## Run

```sh
deno task start
```

Or with auto-reload while developing:

```sh
deno task dev
```

## Adding a command

1. Create `src/commands/<name>.ts` exporting a `Command`:

```ts
import { MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../command.ts";

export const hello: Command = {
	data: new SlashCommandBuilder()
		.setName("hello")
		.setDescription("Say hello"),
	async execute(interaction) {
		await interaction.reply({ content: "Hi!", flags: MessageFlags.Ephemeral });
	},
};
```

2. Register it in the table in `src/commands/mod.ts`:

```ts
import { hello } from "./hello.ts";

export const commands: Record<string, Command> = {
	ping,
	hello,
};
```

The table key must match `setName(...)`; `src/main.ts` looks commands up by the name Discord sends.

3. Push the new command definition to Discord, then restart the bot:

```sh
deno task deploy
deno task start
```

`deno task deploy` is only needed when a command's _definition_ changes (name, description,
options). Editing `execute` logic just needs a restart, or nothing at all under `deno task dev`.

Throwing inside `execute` is fine: `src/main.ts` catches it, logs it, and replies with a generic
error instead of leaving the interaction hanging.

If a command needs a Discord permission the bot does not have yet, re-invite it with that permission
— the invite URL above requests none.

## License

See [LICENSE](LICENSE).
