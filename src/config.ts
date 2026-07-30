function required(name: string): string {
	const value = Deno.env.get(name);
	if (!value) throw new Error(`Missing environment variable: ${name}`);
	return value;
}

export const config = {
	token: required("DISCORD_TOKEN"),
	appId: required("DISCORD_APP_ID"),
	guildId: required("DISCORD_GUILD_ID"),
	conduitUrl: Deno.env.get("CONDUIT_URL") ?? "http://127.0.0.1:8080",
	conduitToken: required("CONDUIT_TOKEN"),
} as const;
