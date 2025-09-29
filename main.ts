import { Plugin, App, PluginSettingTab } from 'obsidian';
interface DarkModeImagesSettings {
	// array of extensions without leading dot, e.g. ["svg","png"]
	extensions: string[];
}

// Settings tab UI (placed after the plugin class)
class DarkModeImagesSettingTab extends PluginSettingTab {
	plugin: DarkModeImagesPlugin;

	constructor(app: App, plugin: DarkModeImagesPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();

	containerEl.createEl('h2', {text: 'Dark Mode Images settings'});

		// input for extensions
		const input = containerEl.createEl('input', {type: 'text'});
		input.value = this.plugin.settings.extensions.join(', ');
		input.style.width = '100%';
		(input as HTMLInputElement).placeholder = 'e.g. svg, png, gif';

		const desc = containerEl.createEl('div', {text: 'Comma-separated list of extensions (without dot). The filter will apply to images whose src ends with these extensions.'});
		desc.style.marginBottom = '8px';

		const saveBtn = containerEl.createEl('button', {text: 'Save'});
		saveBtn.style.marginTop = '8px';

		saveBtn.addEventListener('click', async () => {
			const raw = (input as HTMLInputElement).value;
			const exts = raw.split(',').map((s: string) => s.trim()).filter(Boolean).map((s: string) => s.startsWith('.') ? s.slice(1) : s);
			this.plugin.settings.extensions = exts;
			await this.plugin.saveSettings();
		});
	}
}

const DEFAULT_SETTINGS: DarkModeImagesSettings = {
	extensions: ['svg','png','gif'],
};

export default class DarkModeImagesPlugin extends Plugin {
	private svgFilterElement: SVGElement | null = null;
	private styleElement: HTMLStyleElement | null = null;
	settings: DarkModeImagesSettings = {} as DarkModeImagesSettings;
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.updateCSS();
	}

	async onload() {
		await this.loadSettings();
		this.injectSVGFilter();
		this.injectCSS();
		this.addSettingTab(new DarkModeImagesSettingTab(this.app, this));
	}

	onunload() {
		console.log('Unloading Dark Mode Images plugin');
		
		// Clean up the injected SVG filter
		if (this.svgFilterElement && this.svgFilterElement.parentNode) {
			this.svgFilterElement.parentNode.removeChild(this.svgFilterElement);
		}
		
		// Clean up the injected CSS
		if (this.styleElement && this.styleElement.parentNode) {
			this.styleElement.parentNode.removeChild(this.styleElement);
		}
	}


	private injectSVGFilter() {
	// Create the SVG filter element (used to apply image adjustments)
		const svgFilter = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svgFilter.style.position = 'fixed';
		svgFilter.style.left = '0';
		svgFilter.style.top = '0';
		svgFilter.style.width = '0';
		svgFilter.style.height = '0';
		svgFilter.style.pointerEvents = 'none';

	// credit: https://monochrome.sutic.nu/2024/02/25/hue-preserving-invert-css-filter-for-dark-mode.html
		svgFilter.innerHTML = `
			<defs>
				<filter id="invert-luminance" color-interpolation-filters="linearRGB">
					<feComponentTransfer>
						<feFuncR type="gamma" amplitude="1" exponent="0.5" offset="0.0"/>
						<feFuncG type="gamma" amplitude="1" exponent="0.5" offset="0.0"/>
						<feFuncB type="gamma" amplitude="1" exponent="0.5" offset="0.0"/>
						<feFuncA type="gamma" amplitude="1" exponent="1" offset="0.0"/>
					</feComponentTransfer>
					<feColorMatrix type="matrix" values="
						1.000 -1.000 -1.000 0.000 1.000
					   -1.000 1.000 -1.000 0.000 1.000
					   -1.000 -1.000 1.000 0.000 1.000
						0.000 0.000 0.000 1.000 0.000
					"/>
				</filter>
			</defs>
		`;
		
		// Add to document body
		document.body.appendChild(svgFilter);
		this.svgFilterElement = svgFilter;
	}

	private injectCSS() {
	// Create a style element
	const style = document.createElement('style');
	style.setAttribute('data-darkmode-images', 'true');
	// initial CSS generation from settings
	style.textContent = this.generateCSSForExtensions(this.settings.extensions);
		
		// Add to document head
		document.head.appendChild(style);
		this.styleElement = style;
	}

	// Update the existing injected style element (or inject if missing)
	private updateCSS() {
	const css = this.generateCSSForExtensions(this.settings.extensions);
		if (this.styleElement) {
			this.styleElement.textContent = css;
		} else {
			this.injectCSS();
		}
	}

	// Generate a compact CSS rule using :is() and configured extensions
	private generateCSSForExtensions(extensions: string[]): string {
		// normalize and dedupe
		const exts = Array.from(new Set(extensions
			.map(e => e.trim().toLowerCase())
			.filter(Boolean)
			.map(e => e.startsWith('.') ? e.slice(1) : e)
		));

		if (exts.length === 0) {
			return ''; // nothing to apply
		}

		const contexts = [
			'body.theme-dark',
			'body.is-dark',
			'.theme-dark'
		];

		// Combine contexts with :is() for the inner selectors (markdown view and code mirror)
		const inner = ':is(.markdown-preview-view, .cm-editor)';

		// Compose final compact selector using :is()
		const selector = contexts.map(ctx => `${ctx} ${inner} ${exts.length === 1 ? `img[src*=".${exts[0]}"]` : `:is(${exts.map(ext => `img[src*=".${ext}"]`).join(',')})`}`).join(',\n\t');

		return `/* Apply dark-mode adjustments to configured image extensions in dark mode */\n\t${selector} {\n\t\tfilter: url(#invert-luminance) !important;\n\t}`;
	}
}