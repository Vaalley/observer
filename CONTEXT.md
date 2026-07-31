# Observer

Observer is the Discord bot for the MCTraveler Minecraft server. It bridges Discord and the
Minecraft server, and gives admins and players self-service tools without leaving Discord.

## Language

**Conduit**: The Fabric mod running on the Minecraft server that Observer talks to over a local,
authenticated HTTP interface (`src/conduit/client.ts`). Exposes server status, broadcasts, and
recent chat. _Avoid_: the Minecraft server, backend — when specifically meaning this HTTP interface

**Chat Bridge**: The two-way relay that mirrors messages between one designated Discord channel and
in-game Minecraft chat, so both sides see one shared conversation.

**Feature Overview Message**: The single Discord message, posted and tracked via `/features`,
describing everything Observer currently does. Edited in place on every re-run instead of reposted,
so only one ever exists. _Avoid_: announcement, changelog

**Feedback Report**: A submission a user files through `/feedback`'s modal (type + details), turned
directly into a GitHub issue on `Vaalley/conduit` labelled by its feedback type
(bug/enhancement/question).

**TPS Health Band**: The Healthy / Laggy / Struggling label and matching color `/status` derives
from a TPS reading (`tpsHealth()` in `src/status.ts`). Healthy ≥ 19 TPS, Laggy 15–19, Struggling
below 15.

## Conventions

**Keep `/features` in sync.** `FEATURES_MESSAGE_CONTENT` in `src/features.ts` is the single source
of truth for the live Feature Overview Message. Whenever a slash command's behavior changes, a
command gains a new capability, or a command is removed, update `FEATURES_MESSAGE_CONTENT` in the
same change — the live message only refreshes when an admin re-runs `/features`, so the source
string and reality must already agree at merge time. There is no automated check for this; it's a
manual discipline every command change must honor.
