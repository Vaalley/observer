import { initWasm, Resvg } from "@resvg/resvg-wasm";
import type { PostcardEvent } from "../conduit/client.ts";
import { biomeColor, dimensionLabel, prettyBiome } from "../passport.ts";
import { weatherLabel, worldTimeLabel } from "../status.ts";

const WIDTH = 900;
const HEIGHT = 600;
const PAPER = "#f6efe3";

interface RenderResources {
	caveat: Uint8Array;
	inter: Uint8Array;
}

let resourcesPromise: Promise<RenderResources | null> | undefined;
let renderFailureLogged = false;

function escapeXml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&apos;");
}

function colorHex(color: number): string {
	return `#${color.toString(16).padStart(6, "0")}`;
}

function ellipsize(value: string, maxLength: number): string {
	return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function wrapText(value: string, maxChars: number, maxLines: number): string[] {
	const words = value.trim().split(/\s+/).filter(Boolean);
	if (words.length === 0) return [];

	const lines: string[] = [];
	let line = "";
	for (const word of words) {
		const candidate = line.length === 0 ? word : `${line} ${word}`;
		if (candidate.length <= maxChars) {
			line = candidate;
		} else if (line.length > 0) {
			lines.push(line);
			line = word;
		} else {
			lines.push(ellipsize(word, maxChars));
			line = "";
		}
		if (lines.length === maxLines) break;
	}
	if (lines.length < maxLines && line.length > 0) lines.push(line);

	const consumed = lines.join(" ").length;
	if (consumed < value.trim().length && lines.length > 0) {
		const lastIndex = lines.length - 1;
		const last = lines[lastIndex];
		if (last !== undefined) lines[lastIndex] = ellipsize(last, maxChars - 1) + "…";
	}
	return lines.slice(0, maxLines);
}

function plainLabel(value: string): string {
	return value.replace(/^[^A-Za-z0-9]+/u, "").trim();
}

function dimensionStamp(dimension: string): string {
	if (dimension === "minecraft:overworld") return "O";
	if (dimension === "minecraft:the_nether") return "N";
	if (dimension === "minecraft:the_end") return "E";
	if (dimension === "mctraveler:embassies") return "E";
	return "•";
}

function titleFor(event: PostcardEvent): string {
	return ellipsize(event.region?.title ?? prettyBiome(event.biome), 40);
}

export function postcardSvg(event: PostcardEvent): string {
	const accent = colorHex(biomeColor(event.biome, event.dimension));
	const greeting = ellipsize(`Greetings from ${titleFor(event)}`, 40);
	const titleSize = greeting.length > 22 ? 44 : 56;
	const captionLines = event.caption ? wrapText(event.caption, 34, 2) : [];
	const dimension = plainLabel(dimensionLabel(event.dimension));
	const biome = prettyBiome(event.biome);
	const time = plainLabel(worldTimeLabel(event.dayTime));
	const weather = plainLabel(weatherLabel(event.raining, event.thundering));
	const embassy = event.region?.embassy
		? `<text x="45" y="535" class="inter embassy">Embassy of ${
			escapeXml(event.region.owner ?? "unknown")
		}</text>`
		: "";
	const caption = captionLines.map((line, index) =>
		`<text x="45" y="${260 + index * 48}" class="caveat caption">${index === 0 ? "&quot;" : ""}${
			escapeXml(line)
		}${index === captionLines.length - 1 ? "&quot;" : ""}</text>`
	).join("");

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
<defs>
<linearGradient id="paper" x1="0" y1="0" x2="0" y2="1">
<stop offset="0%" stop-color="${accent}" stop-opacity="0.35"/>
<stop offset="23%" stop-color="${accent}" stop-opacity="0.12"/>
<stop offset="28%" stop-color="${PAPER}"/>
<stop offset="100%" stop-color="${PAPER}"/>
</linearGradient>
<style>
.caveat { font-family: 'Caveat'; fill: #302b27; }
.inter { font-family: 'Inter'; fill: #403a34; }
.caption { font-size: 36px; }
.label { font-size: 22px; }
.small { font-size: 18px; }
.embassy { font-size: 20px; fill: #725b27; }
</style>
</defs>
<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#paper)"/>
<rect x="1" y="1" width="${WIDTH - 2}" height="${
		HEIGHT - 2
	}" rx="18" fill="none" stroke="#d9c9b2" stroke-width="2"/>
<rect x="680" y="35" width="170" height="105" rx="8" fill="#fffaf2" stroke="#8c7c68" stroke-width="3" stroke-dasharray="9 7"/>
<text x="765" y="103" text-anchor="middle" class="inter" font-size="52" fill="${accent}">${
		dimensionStamp(event.dimension)
	}</text>
<text x="45" y="185" class="caveat" font-size="${titleSize}">${escapeXml(greeting)}</text>
${caption}
<text x="45" y="475" class="inter label">${escapeXml(dimension)} · ${escapeXml(biome)} · ~${
		escapeXml(String(event.x))
	}, ${escapeXml(String(event.z))}</text>
<text x="45" y="508" class="inter label">${escapeXml(time)} · ${escapeXml(weather)}</text>
${embassy}
<text x="855" y="545" text-anchor="end" class="inter small">from ${escapeXml(event.player)}</text>
</svg>`;
}

async function loadResources(): Promise<RenderResources | null> {
	try {
		const wasmUrl = new URL(import.meta.resolve("@resvg/resvg-wasm/index_bg.wasm"));
		await initWasm(await Deno.readFile(wasmUrl));
		const [caveat, inter] = await Promise.all([
			Deno.readFile(new URL("../../assets/fonts/Caveat-Regular.ttf", import.meta.url)),
			Deno.readFile(new URL("../../assets/fonts/Inter-Regular.ttf", import.meta.url)),
		]);
		return { caveat, inter };
	} catch (error) {
		if (!renderFailureLogged) {
			console.error("Postcard image rendering unavailable:", error);
			renderFailureLogged = true;
		}
		return null;
	}
}

export async function renderPostcardPng(event: PostcardEvent): Promise<Uint8Array | null> {
	resourcesPromise ??= loadResources();
	const resources = await resourcesPromise;
	if (!resources) return null;
	try {
		return new Resvg(postcardSvg(event), {
			font: {
				loadSystemFonts: false,
				fontBuffers: [resources.caveat, resources.inter],
			},
		}).render().asPng();
	} catch (error) {
		if (!renderFailureLogged) {
			console.error("Postcard image rendering unavailable:", error);
			renderFailureLogged = true;
		}
		return null;
	}
}
