// Renders one README scene, picked by the page's #hash, using the real fix rules and settings tab.
import { EditorView } from "@codemirror/view";
import { fixLine } from "../../src/dialogue";
import SpanishDialoguePlugin from "../../src/main";

const root = document.getElementById("root")!;

function notePane(title: string, text: string) {
	const pane = root.createDiv("workspace-leaf-content shot-pane");
	const source = pane
		.createDiv("view-content")
		.createDiv("markdown-source-view cm-s-obsidian mod-cm6 is-readable-line-width is-live-preview");
	const sizer = source.createDiv("shot-sizer");
	sizer.createDiv({ cls: "inline-title", text: title });
	new EditorView({ parent: sizer, doc: text, extensions: [EditorView.lineWrapping] });
}

const before = `Ana dejó el sobre encima de la mesa.

-¿Has visto la carta? -preguntó sin levantar la vista.

— No. ¿Qué carta?

--La del banco--dijo ella-, la que llegó ayer.

-Me parece que me estás engañando. -susurró Víctor-. Pero no importa.

-Bueno, -dijo Ana- vamos a leerla juntos.

-Como quieras -respondió él-.`;

const scene = location.hash.slice(1);

(async () => {
	try {
		if (scene === "fix") {
			const opts = { listDashAsDialogue: false, fixPunctuation: true };
			const after = before.split("\n").map((l) => fixLine(l, opts)).join("\n");
			notePane("Before", before);
			notePane("After: Fix dialogue dashes", after);
		} else if (scene === "settings") {
			const plugin = new SpanishDialoguePlugin({ workspace: { on: () => ({}) } } as any, {} as any) as any;
			await plugin.onload();
			plugin.settingTab.display();
			root.createDiv("shot-settings vertical-tab-content").appendChild(plugin.settingTab.containerEl);
		}
	} catch (e) {
		// Surfaced in the page title so a blank screenshot can be debugged with --dump-dom.
		document.title = "ERR " + (e as Error).stack;
	}
	document.body.dataset.ready = "1";
})();
