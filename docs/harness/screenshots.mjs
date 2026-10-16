// Regenerates the README screenshots: renders the real editor extension and settings tab against a mock
// Obsidian API, styled with Obsidian's own app.css (read from the local Obsidian.app, never committed),
// via headless Chrome.
// Usage: npm run screenshots   (macOS, needs Obsidian and Google Chrome installed)
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, openSync, readFileSync, readSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import esbuild from "esbuild";

const ASAR = "/Applications/Obsidian.app/Contents/Resources/obsidian.asar";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const root = resolve(import.meta.dirname, "../..");
const outDir = join(root, "docs/images");
const work = mkdtempSync(join(tmpdir(), "shots-"));
mkdirSync(outDir, { recursive: true });

const scenes = JSON.parse(readFileSync(join(import.meta.dirname, "scenes.json"), "utf8"));

function extractFromAsar(name) {
	const fd = openSync(ASAR, "r");
	const head = Buffer.alloc(16);
	readSync(fd, head, 0, 16, 0);
	const headerSize = head.readUInt32LE(4);
	const jsonLen = head.readUInt32LE(12);
	const json = Buffer.alloc(jsonLen);
	readSync(fd, json, 0, jsonLen, 16);
	const entry = JSON.parse(json.toString()).files[name];
	const data = Buffer.alloc(entry.size);
	readSync(fd, data, 0, entry.size, 8 + headerSize + Number(entry.offset));
	return data;
}

writeFileSync(join(work, "app.css"), extractFromAsar("app.css"));
let pluginCss = "";
try {
	pluginCss = readFileSync(join(root, "styles.css"), "utf8");
} catch {}
writeFileSync(join(work, "styles.css"), pluginCss);
await esbuild.build({
	entryPoints: [join(root, "docs/harness/scenes.ts")],
	bundle: true,
	format: "iife",
	outfile: join(work, "scenes.js"),
	alias: { obsidian: join(root, "docs/harness/obsidian-mock.ts") },
	logLevel: "warning",
});

const harnessCss = `
	body { overflow: hidden; background: var(--background-secondary); }
	#root { position: fixed; inset: 0; display: flex; gap: 1px; background: var(--divider-color); }
	.shot-pane { position: relative; flex: 1; display: flex; flex-direction: column; background: var(--background-primary); }
	.shot-pane .view-header { flex: none; }
	.shot-pane .view-content { flex: 1; overflow: hidden; }
	.shot-sizer { width: 100%; max-width: var(--file-line-width); margin: 0 auto; padding: 8px 32px; }
	.shot-sizer .cm-editor { font-family: var(--font-text); font-size: var(--font-text-size); line-height: var(--line-height-normal); color: var(--text-normal); }
	.shot-sizer .cm-editor.cm-focused { outline: none; }
	.shot-settings { flex: 1; padding: 32px 48px; background: var(--background-primary); overflow: hidden; }
	.shot-settings > div { max-width: 760px; margin: 0 auto; }
`;

for (const s of scenes) {
	const html = join(work, `${s.name}.html`);
	writeFileSync(
		html,
		`<!DOCTYPE html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="app.css"><link rel="stylesheet" href="styles.css"><style>${harnessCss}</style></head>
<body class="theme-${s.theme} mod-macos is-focused show-inline-title"><div id="root"></div><script src="scenes.js"></script></body></html>`,
	);
	const png = join(outDir, `${s.name}.png`);
	execFileSync(CHROME, [
		"--headless=new",
		"--disable-gpu",
		"--hide-scrollbars",
		"--force-device-scale-factor=2",
		`--window-size=${s.size.join(",")}`,
		"--virtual-time-budget=3000",
		`--screenshot=${png}`,
		`file://${html}#${s.name}`,
	], { stdio: "ignore" });
	console.log("wrote", png);
}
