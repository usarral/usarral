// Rewrites the "Latest writing" block of README.md from the blog's RSS feed.
// No dependencies. It never touches the README if the feed fails or the markers are missing.
import { readFileSync, writeFileSync } from "node:fs";

const FEED = "https://usarral.com/en/rss.xml";
const LIMIT = 5;
const START = "<!-- posts:start -->";
const END = "<!-- posts:end -->";

const entities = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decode = (s) =>
	s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e) => {
		if (e[0] !== "#") return entities[e.toLowerCase()];
		return String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
	});
const text = (xml, tag) => {
	const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
	return m ? decode(m[1].replace(/^<!\[CDATA\[|\]\]>$/g, "").trim()) : "";
};

const res = await fetch(FEED, { headers: { "user-agent": "usarral-profile-readme" } });
if (!res.ok) throw new Error(`Feed answered ${res.status}`);
const xml = await res.text();

const posts = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
	.map(([, item]) => ({
		title: text(item, "title"),
		link: text(item, "link"),
		date: new Date(text(item, "pubDate")),
	}))
	.filter((p) => p.title && p.link && !Number.isNaN(p.date.getTime()))
	.sort((a, b) => b.date - a.date)
	.slice(0, LIMIT);

if (posts.length === 0) throw new Error("The feed has no valid posts");

const month = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
const escapeMd = (s) => s.replace(/([[\]])/g, "\\$1");
const block = posts
	.map((p) => `- [${escapeMd(p.title)}](${p.link}) · ${month.format(p.date)}`)
	.join("\n");

const readme = readFileSync("README.md", "utf8");
const a = readme.indexOf(START);
const b = readme.indexOf(END);
if (a === -1 || b === -1 || b < a) throw new Error("Markers not found in README.md");

const next = `${readme.slice(0, a + START.length)}\n${block}\n${readme.slice(b)}`;
if (next === readme) console.log("README is already up to date");
else {
	writeFileSync("README.md", next);
	console.log(`README updated with ${posts.length} posts`);
}
