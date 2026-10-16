import { App, Editor, MarkdownView, Notice, Plugin, PluginSettingTab, Setting, SettingDefinitionItem } from "obsidian";
import { EditorState, Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { DashOptions, RAYA, codeLines, fixLine, liveDash } from "./dialogue";

interface DialogueSettings extends DashOptions {
	liveConvert: boolean;
}

const DEFAULT_SETTINGS: DialogueSettings = {
	liveConvert: true,
	listDashAsDialogue: false,
	fixPunctuation: true,
};

export default class SpanishDialoguePlugin extends Plugin {
	settings!: DialogueSettings;

	async onload() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, (await this.loadData()) as Partial<DialogueSettings> | null);
		this.registerEditorExtension(this.liveConversion());
		this.addSettingTab(new DialogueSettingTab(this.app, this));

		this.addCommand({
			id: "fix-dialogue",
			name: "Fix dialogue dashes in note (or selection)",
			editorCallback: (editor) => this.fixEditor(editor),
		});

		this.addRibbonIcon("quote", "Fix dialogue dashes in note", () => {
			const editor = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
			if (editor) this.fixEditor(editor);
			else new Notice("Open a note to fix its dialogue.");
		});

		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, editor) => {
				menu.addItem((item) =>
					item
						.setTitle("Fix dialogue dashes")
						.setIcon("quote")
						.onClick(() => this.fixEditor(editor))
				);
			})
		);

		this.addCommand({
			id: "insert-raya",
			name: "Insert raya (—)",
			editorCallback: (editor) => editor.replaceSelection(RAYA),
		});
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private fixEditor(editor: Editor) {
		const lines = editor.getValue().split("\n");
		const skip = codeLines(lines);

		let first = 0;
		let last = lines.length - 1;
		if (editor.somethingSelected()) {
			first = Math.min(editor.getCursor("from").line, editor.getCursor("to").line);
			last = Math.max(editor.getCursor("from").line, editor.getCursor("to").line);
		}

		const changes = [];
		for (let i = first; i <= last; i++) {
			if (skip[i]) continue;
			const fixed = fixLine(lines[i], this.settings);
			if (fixed !== lines[i]) {
				changes.push({ from: { line: i, ch: 0 }, to: { line: i, ch: lines[i].length }, text: fixed });
			}
		}

		if (changes.length === 0) {
			new Notice("No dialogue dashes to fix.");
			return;
		}
		editor.transaction({ changes });
		new Notice(`Fixed ${changes.length} dialogue line${changes.length === 1 ? "" : "s"}.`);
	}

	/** Converts dashes as you type: "-Hola" → "—Hola", "--" → "—", " -dijo" → " —dijo". */
	private liveConversion(): Extension {
		return EditorView.inputHandler.of((view, from, to, text) => {
			if (!this.settings.liveConvert || from !== to || text.length !== 1) return false;
			const line = view.state.doc.lineAt(from);
			const before = line.text.slice(0, from - line.from);
			const r = liveDash(before, text, this.settings);
			if (!r || inCode(view.state, line.number, before)) return false;

			const start = line.from + r.from;
			view.dispatch({
				changes: { from: start, to: from, insert: r.insert },
				selection: { anchor: start + r.insert.length },
				userEvent: "input.type",
			});
			return true;
		});
	}
}

/** True when the cursor is in frontmatter, a code block, or inline code. */
function inCode(state: EditorState, lineNumber: number, before: string): boolean {
	if ((before.match(/`/g)?.length ?? 0) % 2 === 1) return true;
	const lines: string[] = [];
	for (let n = 1; n <= lineNumber; n++) lines.push(state.doc.line(n).text);
	return codeLines(lines)[lineNumber - 1];
}

type ToggleKey = "liveConvert" | "fixPunctuation" | "listDashAsDialogue";

/** Description with inline code examples: plain strings are text, one-element arrays are code. */
function desc(parts: (string | [string])[]): DocumentFragment {
	return createFragment((f) => {
		for (const p of parts) {
			if (typeof p === "string") f.appendText(p);
			else f.createEl("code", { text: p[0] });
		}
	});
}

// Shared by the declarative settings (Obsidian 1.13+) and the display() fallback.
const TOGGLES: { key: ToggleKey; name: string; desc: () => DocumentFragment }[] = [
	{
		key: "liveConvert",
		name: "Convert while typing",
		desc: () =>
			desc([
				"Turns hyphens into rayas as you type: ", ["-Hola"], " → ", ["—Hola"], ", ", ["--"], " → ", ["—"],
				", and inside dialogue ", [" -dijo"], " → ", [" —dijo"], " and ", ["Víctor-,"], " → ", ["Víctor—,"], ".",
			]),
	},
	{
		key: "fixPunctuation",
		name: "Fix punctuation around incisos",
		desc: () =>
			desc([
				"When running the fix command: drop the period before a speech verb (", ["engañando. —dijo"], " → ",
				["engañando —dijo"], "), move commas after the closing raya, and drop the closing raya at the end of a paragraph (",
				["—dijo—."], " → ", ["—dijo."], ").",
			]),
	},
	{
		key: "listDashAsDialogue",
		name: "Treat \"- \" at line start as dialogue",
		desc: () => desc(["Off by default because ", ["- "], " starts a Markdown list. Turn on if you never use hyphen lists."]),
	},
];

class DialogueSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private plugin: SpanishDialoguePlugin,
	) {
		super(app, plugin);
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return TOGGLES.map((t) => ({ name: t.name, desc: t.desc(), control: { type: "toggle", key: t.key } }));
	}

	getControlValue(key: string): unknown {
		return this.plugin.settings[key as ToggleKey];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		this.plugin.settings[key as ToggleKey] = value === true;
		await this.plugin.saveSettings();
	}

	/** Fallback for Obsidian < 1.13, which never calls getSettingDefinitions(). */
	display(): void {
		const { containerEl } = this;
		const s = this.plugin.settings;
		containerEl.empty();

		for (const t of TOGGLES) {
			new Setting(containerEl)
				.setName(t.name)
				.setDesc(t.desc())
				.addToggle((toggle) =>
					toggle.setValue(s[t.key]).onChange(async (v) => {
						s[t.key] = v;
						await this.plugin.saveSettings();
					}),
				);
		}
	}
}
