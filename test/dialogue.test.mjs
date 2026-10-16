import { test } from "node:test";
import assert from "node:assert/strict";
import esbuild from "esbuild";

const { outputFiles } = await esbuild.build({ entryPoints: ["src/dialogue.ts"], bundle: true, format: "esm", write: false });
const { fixLine, fixText, liveDash } = await import(
	"data:text/javascript;base64," + Buffer.from(outputFiles[0].text).toString("base64")
);

const opts = { listDashAsDialogue: false, fixPunctuation: true };
const fix = (s, o = {}) => fixLine(s, { ...opts, ...o });

test("opening raya attached to first word", () => {
	assert.equal(fix("-Voy a recitar un discurso."), "—Voy a recitar un discurso.");
	assert.equal(fix("— Voy a recitar un discurso."), "—Voy a recitar un discurso.");
	assert.equal(fix("– Voy a recitar un discurso."), "—Voy a recitar un discurso.");
	assert.equal(fix("--Voy a recitar un discurso."), "—Voy a recitar un discurso.");
});

test("inciso spacing, comma after closing raya", () => {
	assert.equal(
		fix("-Me parece que me estás engañando - susurró Víctor -, pero no importa."),
		"—Me parece que me estás engañando —susurró Víctor—, pero no importa."
	);
	assert.equal(
		fix("—Me parece que me estás engañando—susurró Víctor—, pero no importa."),
		"—Me parece que me estás engañando —susurró Víctor—, pero no importa."
	);
});

test("inciso ending the paragraph has no closing raya", () => {
	assert.equal(fix("-Me parece que me estás engañando -dijo."), "—Me parece que me estás engañando —dijo.");
	assert.equal(fix("—Me parece que me estás engañando —dijo—."), "—Me parece que me estás engañando —dijo.");
	assert.equal(fix("—Me parece que me estás engañando —dijo—"), "—Me parece que me estás engañando —dijo.");
});

test("speech verb stays lowercase after ? and !, punctuation kept", () => {
	assert.equal(fix("-¡Qué buen día hace! - exclamó sonriente Jorge."), "—¡Qué buen día hace! —exclamó sonriente Jorge.");
	assert.equal(fix("-¿Vienes? -preguntó."), "—¿Vienes? —preguntó.");
});

test("period before a speech verb is removed", () => {
	assert.equal(fix("—Me parece que me estás engañando. —dijo."), "—Me parece que me estás engañando —dijo.");
	assert.equal(fix("—Pues... —dijo."), "—Pues... —dijo.");
});

test("narrator action with capital keeps period, closing raya before dialogue continues", () => {
	assert.equal(
		fix("—Voy a recitar un discurso. —El profesor Duskovsky hizo una pausa—. Es muy largo."),
		"—Voy a recitar un discurso. —El profesor Duskovsky hizo una pausa—. Es muy largo."
	);
});

test("comma before inciso moves after closing raya", () => {
	assert.equal(fix("—Bueno, —dijo Paula— vamos."), "—Bueno —dijo Paula—, vamos.");
	assert.equal(fix("—Bueno, —dijo Paula—, vamos."), "—Bueno —dijo Paula—, vamos.");
	assert.equal(fix("—La casa —dijo Paula— muy completa."), "—La casa —dijo Paula— muy completa.");
});

test("hyphenated words, numbers, links and code are kept", () => {
	assert.equal(fix("-Mi ex-novio llegó a las 3-4 -dijo."), "—Mi ex-novio llegó a las 3-4 —dijo.");
	assert.equal(fix("-Mira [[nota - uno]] y `a - b` -dijo."), "—Mira [[nota - uno]] y `a - b` —dijo.");
	assert.equal(fix("-Hace -5 grados."), "—Hace -5 grados.");
});

test("non-dialogue lines untouched", () => {
	assert.equal(fix("- item de lista"), "- item de lista");
	assert.equal(fix("- [ ] tarea"), "- [ ] tarea");
	assert.equal(fix("---"), "---");
	assert.equal(fix("Texto normal sin rayas, ex-novio."), "Texto normal sin rayas, ex-novio.");
	assert.equal(fix("# Título - uno"), "# Título - uno");
	assert.equal(fix("* item - uno"), "* item - uno");
	assert.equal(fix("| a - b |"), "| a - b |");
	assert.equal(fix("- Hola -dijo.", { listDashAsDialogue: true }), "—Hola —dijo.");
});

test("speech continuing on a line without opening dash", () => {
	assert.equal(
		fix("La Rifa de la Salvación- continuo la voz - había sido el último intento."),
		"La Rifa de la Salvación —continuo la voz— había sido el último intento."
	);
	assert.equal(
		fix("Efectivamente- continuo el narrador - Roneo activó el piloto."),
		"Efectivamente —continuo el narrador— Roneo activó el piloto."
	);
	assert.equal(fix("Entre las 2 - 3 de la tarde."), "Entre las 2 - 3 de la tarde.");
});

test("blockquote prefix kept", () => {
	assert.equal(fix("> -Hola -dijo."), "> —Hola —dijo.");
});

test("fixText skips frontmatter and code blocks", () => {
	const text = ["---", "-x: y", "---", "-Hola -dijo.", "```", "-a - b", "```"].join("\n");
	const r = fixText(text, opts);
	assert.deepEqual(r.changedLines, [3]);
	assert.equal(r.text.split("\n")[3], "—Hola —dijo.");
});

test("live typing", () => {
	assert.deepEqual(liveDash("-", "H", opts), { from: 0, insert: "—H" });
	assert.equal(liveDash("-", " ", opts), null); // list item
	assert.deepEqual(liveDash("hola --", "d", opts), { from: 5, insert: "—d" });
	assert.equal(liveDash("---", "\n", opts), null);
	assert.deepEqual(liveDash("—Hola -", "d", opts), { from: 6, insert: "—d" });
	assert.deepEqual(liveDash("—Hola —dijo Víctor-", ",", opts), { from: 18, insert: "—," });
	assert.equal(liveDash("—Mi ex-", "n", opts), null);
	assert.equal(liveDash("Texto -", "d", opts), null); // not a dialogue line
});
