import type { PostcardEvent } from "../conduit/client.ts";
import { postcardSvg, renderPostcardPng } from "./render.ts";

const baseEvent: PostcardEvent = {
	type: "postcard",
	at: Date.UTC(2025, 0, 3),
	player: "Traveler",
	dimension: "minecraft:overworld",
	biome: "minecraft:cherry_grove",
	x: 120,
	y: 70,
	z: -40,
	dayTime: 6_000,
	raining: false,
	thundering: false,
	caption: "Found a <b>cherry</b> grove!",
};

function assert(condition: boolean, message: string): void {
	if (!condition) throw new Error(message);
}

Deno.test("postcardSvg escapes text and wraps captions", () => {
	const svg = postcardSvg({
		...baseEvent,
		caption: "Found a <b>cherry</b> grove at dawn, come see it! Bring friends and snacks too.",
	});
	assert(svg.includes("&lt;b&gt;"), "caption should be XML escaped");
	assert(
		(svg.match(/class="caveat caption"/g) ?? []).length === 2,
		"caption should wrap to two lines",
	);
	assert(svg.includes("Cherry Grove"), "biome should be used without a region");
	assert(!svg.includes("<b>"), "raw caption markup should not remain");
});

Deno.test("postcardSvg uses a region and embassy line only when applicable", () => {
	const embassy = postcardSvg({
		...baseEvent,
		dimension: "mctraveler:embassies",
		region: { id: "one", title: "The Embassy", embassy: true, owner: "Mayor" },
	});
	assert(embassy.includes("The Embassy"), "region title should be used");
	assert(embassy.includes("Embassy of Mayor"), "embassy owner should be shown");

	const ordinary = postcardSvg({
		...baseEvent,
		region: { id: "two", title: "Wilds", embassy: false, owner: null },
	});
	assert(!ordinary.includes("Embassy of"), "ordinary regions should not show embassy text");
});

Deno.test("renderPostcardPng returns a PNG", async () => {
	const png = await renderPostcardPng(baseEvent);
	assert(png !== null, "rendering should succeed");
	assert(
		png?.[0] === 0x89 && png?.[1] === 0x50 && png?.[2] === 0x4e && png?.[3] === 0x47,
		"PNG signature",
	);
});
