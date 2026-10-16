// Minimal stand-in for the Obsidian API, enough to render the settings tab for screenshots.
type ElOptions = string | { cls?: string; text?: string; attr?: Record<string, string>; type?: string; value?: string };

const proto = HTMLElement.prototype as any;
proto.createEl = function (tag: string, o?: ElOptions) {
	const el = document.createElement(tag);
	if (typeof o === "string") el.className = o;
	else if (o) {
		if (o.cls) el.className = o.cls;
		if (o.text !== undefined) el.textContent = o.text;
		if (o.attr) for (const [k, v] of Object.entries(o.attr)) el.setAttribute(k, v);
		if (o.type) (el as HTMLInputElement).type = o.type;
		if (o.value !== undefined) (el as HTMLInputElement).value = o.value;
	}
	this.appendChild(el);
	return el;
};
proto.createDiv = function (o?: ElOptions) {
	return this.createEl("div", o);
};
proto.empty = function () {
	this.innerHTML = "";
};

// Every component setter returns the component, so chained calls work.
function chain<T extends object>(base: T) {
	const p: any = new Proxy(base as any, {
		get: (t, k) => {
			if (!(k in t)) return () => p;
			const v = t[k];
			return typeof v === "function" ? (...args: any[]) => v(...args) ?? p : v;
		},
	});
	return p;
}

export class Setting {
	settingEl: HTMLElement;
	private infoEl: HTMLElement;
	private controlEl: HTMLElement;
	constructor(parent: HTMLElement) {
		this.settingEl = parent.createDiv("setting-item");
		this.infoEl = this.settingEl.createDiv("setting-item-info");
		this.controlEl = this.settingEl.createDiv("setting-item-control");
	}
	setName(n: string) {
		this.infoEl.createDiv({ cls: "setting-item-name", text: n });
		return this;
	}
	setDesc(d: string) {
		this.infoEl.createDiv({ cls: "setting-item-description", text: d });
		return this;
	}
	setHeading() {
		this.settingEl.classList.add("setting-item-heading");
		return this;
	}
	addToggle(cb: (c: any) => void) {
		const box = this.controlEl.createDiv("checkbox-container");
		box.createEl("input", { type: "checkbox" });
		cb(chain({ setValue: (v: boolean) => (box.classList.toggle("is-enabled", v), undefined) }));
		return this;
	}
	addDropdown(cb: (c: any) => void) {
		const select = this.controlEl.createEl("select", "dropdown") as HTMLSelectElement;
		const c: any = chain({
			addOption: (v: string, t: string) => (select.createEl("option", { value: v, text: t }), c),
			addOptions: (o: Record<string, string>) => {
				for (const [v, t] of Object.entries(o)) select.createEl("option", { value: v, text: t });
				return c;
			},
			setValue: (v: string) => ((select.value = v), c),
		});
		cb(c);
		return this;
	}
	addSlider(cb: (c: any) => void) {
		const input = this.controlEl.createEl("input", { cls: "slider", type: "range" }) as HTMLInputElement;
		const c: any = chain({
			setLimits: (min: number, max: number, step: number) => ((input.min = String(min)), (input.max = String(max)), (input.step = String(step)), c),
			setValue: (v: number) => ((input.value = String(v)), c),
		});
		cb(c);
		return this;
	}
	addText(cb: (c: any) => void) {
		const input = this.controlEl.createEl("input", { type: "text" }) as HTMLInputElement;
		const c: any = chain({
			setValue: (v: string) => ((input.value = v), c),
			setPlaceholder: (p: string) => ((input.placeholder = p), c),
		});
		cb(c);
		return this;
	}
	addTextArea(cb: (c: any) => void) {
		const ta = this.controlEl.createEl("textarea") as HTMLTextAreaElement;
		const c: any = chain({
			inputEl: ta,
			setValue: (v: string) => ((ta.value = v), c),
			setPlaceholder: (p: string) => ((ta.placeholder = p), c),
		});
		cb(c);
		return this;
	}
	addColorPicker(cb: (c: any) => void) {
		const input = this.controlEl.createEl("input", { type: "color" }) as HTMLInputElement;
		const c: any = chain({ setValue: (v: string) => ((input.value = v), c) });
		cb(c);
		return this;
	}
}

export class PluginSettingTab {
	containerEl: HTMLElement;
	constructor(public app: any, public plugin: any) {
		this.containerEl = document.createElement("div");
	}
}

/** Records the settings tab the plugin registers; everything else is a no-op. */
export class Plugin {
	settingTab: any;
	constructor(public app: any, public manifest: any) {}
	async loadData() {
		return {};
	}
	async saveData() {}
	addSettingTab(tab: any) {
		this.settingTab = tab;
	}
	registerEditorExtension() {}
	addCommand() {}
	addRibbonIcon() {}
	registerEvent() {}
}
export class Notice {
	constructor(_msg: string) {}
}
export class MarkdownView {}
export function debounce<T extends (...a: any[]) => any>(fn: T): T {
	return fn;
}
export type App = any;
export type Editor = any;
