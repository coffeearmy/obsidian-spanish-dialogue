// Spanish dialogue dash rules (raya, "—"), following https://www.correctores.es/guiones-largos/
//
//   —Me parece que me estás engañando —susurró Víctor—, pero no importa.
//   —¡Qué buen día hace! —exclamó sonriente Jorge.
//
// - The opening raya is attached to the first word: "—Hola", never "— Hola".
// - A narrator inciso opens with a space before the raya and none after: "engañando —dijo".
// - It closes with no space before the raya: "—dijo Víctor—". Punctuation goes after the
//   closing raya ("—dijo—, pero"); otherwise a space follows ("—dijo— que").
// - If the inciso ends the paragraph, there is no closing raya, just a period: "—dijo."
// - A period before an inciso that starts with a speech verb (lowercase) is dropped.

export const RAYA = "—";

export interface DashOptions {
	/** Treat "- Hola" (hyphen + space, normally a Markdown list) as dialogue. */
	listDashAsDialogue: boolean;
	/** Fix punctuation around incisos, not just dashes and spacing. */
	fixPunctuation: boolean;
}

// Indentation and blockquote/callout markers before the dialogue.
const PREFIX = /^[ \t]*(?:>[ \t]*)*/;
// —Hola, –Hola, --Hola, -Hola (a single hyphen must touch the next word, or it's a list).
const OPENER = /^(?:—|–|-{2,}|-(?=[^\s-]))[ \t]*/;
const LIST_OPENER = /^-[ \t]+(?!\[)/;
const DASH = /[ \t]*(—|–|-{2,}|-)[ \t]*/g;
// Spans that must never be touched.
const PROTECTED = /`[^`\n]*`|!?\[\[[^\]\n]*\]\]|\]\([^)\n]*\)|https?:\/\/\S+|%%.*?%%|\$[^$\n]+\$/g;
const WORD_CHAR = /[\p{L}\p{N}]/u;
const PUNCT_AFTER_CLOSE = /[,.;:…!?)\]»”"'’]/;

/** Fix one line of text. Lines that are not dialogue are returned unchanged. */
export function fixLine(line: string, opts: DashOptions): string {
	const prefix = PREFIX.exec(line)![0];
	const rest = line.slice(prefix.length);
	if (/^[-–—\s]*$/.test(rest)) return line; // horizontal rule, lone dash, empty

	const m = OPENER.exec(rest) ?? (opts.listDashAsDialogue ? LIST_OPENER.exec(rest) : null);
	if (!m) {
		// Narration, or speech continuing after a line break: "La Rifa- continuó la voz - había sido…"
		// Fix the inciso dashes but don't add an opening raya.
		if (NOT_PROSE.test(rest) || !INCISO_DASH.test(rest)) return line;
		return prefix + fixBody(rest, opts);
	}
	return prefix + RAYA + fixBody(rest.slice(m[0].length), opts);
}

// Lists, headings, tables: not prose.
const NOT_PROSE = /^(?:[-*+][ \t]|\d+[.)][ \t]|#|\|)/;
// A dash that can't be a hyphen inside a word: spaced, doubled, en or em dash.
const INCISO_DASH = /[ \t][-–]|[-–][ \t]|--|—|–/;

function fixBody(text: string, opts: DashOptions): string {
	// Hide code, links, math... behind placeholders so their dashes survive.
	const saved: string[] = [];
	let body = text.replace(PROTECTED, (s) => {
		saved.push(s);
		return `${saved.length - 1}`;
	});

	body = fixDashes(body);
	if (opts.fixPunctuation) body = fixPunctuation(body);

	return body.replace(/(\d+)/g, (_, i) => saved[Number(i)]);
}

/** Turn inciso dashes into rayas and normalise spacing. Rayas alternate open/close. */
function fixDashes(body: string): string {
	let count = 0;
	return body.replace(DASH, (match: string, dash: string, offset: number, s: string) => {
		const before = s[offset - 1] ?? "";
		const after = s[offset + match.length] ?? "";
		if (dash === "-") {
			// Hyphen inside a word or number: ex-novio, 1-2.
			if (match === "-" && WORD_CHAR.test(before) && WORD_CHAR.test(after)) return match;
			// Number range with spaces: "2 - 3".
			if (/\p{N}/u.test(before) && /\p{N}/u.test(after)) return match;
			// Negative number: " -5".
			if (match.endsWith("-") && /\p{N}/u.test(after) && (match !== "-" || before === "")) return match;
		}
		count++;
		const opening = count % 2 === 1;
		if (opening) return before === "" ? RAYA : " " + RAYA;
		return after === "" || PUNCT_AFTER_CLOSE.test(after) ? RAYA : RAYA + " ";
	});
}

/** Punctuation around incisos. Expects the spacing produced by fixDashes. */
function fixPunctuation(body: string): string {
	// Even indexes are speech, odd indexes are narrator incisos.
	const parts = body.split(RAYA);

	for (let i = 1; i < parts.length; i += 2) {
		const inciso = parts[i];
		if (!/^\p{Ll}/u.test(inciso)) continue; // only speech verbs: dijo, preguntó, susurró…

		const speech = parts[i - 1].trimEnd();
		const spacing = parts[i - 1].slice(speech.length);
		// "engañando. —dijo" → "engañando —dijo" (keep "..." and "?!")
		if (/[^.]\.$/.test(speech)) {
			parts[i - 1] = speech.slice(0, -1) + spacing;
		}
		// "Bueno, —dijo— vamos" → "Bueno —dijo—, vamos"
		else if (speech.endsWith(",")) {
			parts[i - 1] = speech.slice(0, -1) + spacing;
			const next = parts[i + 1];
			if (next !== undefined && next.trim() !== "" && !/^[,.;:]/.test(next)) {
				parts[i + 1] = "," + next;
			}
		}
	}

	// Inciso closing the paragraph loses its closing raya: "—dijo—." → "—dijo."
	if (parts.length >= 3 && parts.length % 2 === 1 && /^[ \t]*\.?[ \t]*$/.test(parts[parts.length - 1])) {
		parts.pop();
		const inciso = parts.pop()!.trimEnd();
		const end = /[.!?…]$/.test(inciso) ? "" : ".";
		const joined = parts.join(RAYA);
		return joined + RAYA + inciso + end;
	}

	return parts.join(RAYA);
}

/** Fix every dialogue line in text, skipping frontmatter and code blocks. */
export function fixText(text: string, opts: DashOptions): { text: string; changedLines: number[] } {
	const lines = text.split("\n");
	const changedLines: number[] = [];
	const skip = codeLines(lines);
	for (let i = 0; i < lines.length; i++) {
		if (skip[i]) continue;
		const fixed = fixLine(lines[i], opts);
		if (fixed !== lines[i]) {
			lines[i] = fixed;
			changedLines.push(i);
		}
	}
	return { text: lines.join("\n"), changedLines };
}

const FENCE = /^ {0,3}(`{3,}|~{3,})/;

/** Marks lines inside frontmatter or fenced code blocks. */
export function codeLines(lines: string[]): boolean[] {
	const skip = new Array<boolean>(lines.length).fill(false);
	let i = 0;
	if (lines[0]?.trim() === "---") {
		skip[0] = true;
		for (i = 1; i < lines.length; i++) {
			skip[i] = true;
			if (/^(---|\.\.\.)\s*$/.test(lines[i])) {
				i++;
				break;
			}
		}
	}
	let open: string | null = null;
	for (; i < lines.length; i++) {
		const m = FENCE.exec(lines[i]);
		if (open === null) {
			if (m) {
				open = m[1];
				skip[i] = true;
			}
		} else {
			skip[i] = true;
			if (m && m[1][0] === open[0] && m[1].length >= open.length && lines[i].trim() === m[1]) open = null;
		}
	}
	return skip;
}

/**
 * Live conversion while typing. `before` is the line text up to the cursor and `typed`
 * the character being typed. Returns the replacement for line[from, before.length).
 */
export function liveDash(before: string, typed: string, opts: DashOptions): { from: number; insert: string } | null {
	if (typed.length !== 1 || typed === "-") return null;
	const prefix = PREFIX.exec(before)![0];
	const rest = before.slice(prefix.length);
	const isSpace = /\s/.test(typed);

	// "-H" at line start → "—H". ("- " stays a list item.)
	if (rest === "-" && (!isSpace || opts.listDashAsDialogue)) {
		return isSpace ? { from: prefix.length, insert: RAYA } : { from: prefix.length, insert: RAYA + typed };
	}
	// "--" anywhere → "—" (but not "---", a horizontal rule or frontmatter)
	if (before.endsWith("--") && !before.endsWith("---")) {
		return { from: before.length - 2, insert: RAYA + typed };
	}

	if (!rest.startsWith(RAYA)) return null;
	// Inside a dialogue line:
	// " -d" → " —d" (opening inciso)
	if (before.endsWith(" -") && /\p{L}/u.test(typed)) {
		return { from: before.length - 1, insert: RAYA + typed };
	}
	// "Víctor-," / "Víctor- " → "Víctor—," (closing inciso)
	if (/[\p{L}.!?…]-$/u.test(before) && (isSpace || /[,.;:]/.test(typed))) {
		return { from: before.length - 1, insert: RAYA + typed };
	}
	return null;
}
