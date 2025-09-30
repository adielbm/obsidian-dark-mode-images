import { Plugin, App, PluginSettingTab, Setting } from 'obsidian';

interface DarkModeImagesSettings {
	// array of extensions without leading dot, e.g. ["svg","png"]
	extensions: string[];
}

class DarkModeImagesSettingTab extends PluginSettingTab {
	plugin: DarkModeImagesPlugin;

	constructor(app: App, plugin: DarkModeImagesPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('File extensions')
			.setDesc('Comma-separated list of file extensions (without dots) to apply the dark mode adaptation to.')
			.addText((text) => text
				.setPlaceholder('e.g. svg, png, gif')
				.setValue(this.plugin.settings.extensions.join(', '))
				.onChange(async (value: string) => {
					// Parse the input: split by comma, trim whitespace, filter empty, remove leading dots
					const extensions = value
						.split(',')
						.map((ext: string) => ext.trim())
						.filter(Boolean)
						.map((ext: string) => ext.startsWith('.') ? ext.slice(1) : ext);

					this.plugin.settings.extensions = extensions;
					await this.plugin.saveSettings();
				}));
	}
}

const DEFAULT_SETTINGS: DarkModeImagesSettings = {
	extensions: ['svg', 'png', 'gif'],
};

export default class DarkModeImagesPlugin extends Plugin {
	private svgFilterElement: SVGElement | null = null;
	private observer: MutationObserver | null = null;
	settings: DarkModeImagesSettings = {} as DarkModeImagesSettings;
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.updateImageClasses();
	}

	async onload() {
		await this.loadSettings();
		this.injectSVGFilter();
		this.updateImageClasses();
		this.startObserver();
		this.addSettingTab(new DarkModeImagesSettingTab(this.app, this));
	}

	onunload() {
		// Stop the observer
		if (this.observer) {
			this.observer.disconnect();
			this.observer = null;
		}

		// Clean up the injected SVG filter
		if (this.svgFilterElement && this.svgFilterElement.parentNode) {
			this.svgFilterElement.parentNode.removeChild(this.svgFilterElement);
		}

		// Clean up CSS classes from images
		const allImages = document.querySelectorAll('img.dark-mode-images-img');
		allImages.forEach(img => img.classList.remove('dark-mode-images-img'));
	}

	private startObserver() {
		// Observe DOM changes to automatically apply classes to new images
		this.observer = new MutationObserver((mutations) => {
			let shouldUpdate = false;
			mutations.forEach((mutation) => {
				if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
					mutation.addedNodes.forEach((node) => {
						if (node.nodeType === Node.ELEMENT_NODE) {
							const element = node as Element;
							// Check if new node contains images or is an image itself
							if (element.tagName === 'IMG' || element.querySelector('img')) {
								shouldUpdate = true;
							}
						}
					});
				}
			});
			if (shouldUpdate) {
				this.updateImageClasses();
			}
		});

		// Start observing
		this.observer.observe(document.body, {
			childList: true,
			subtree: true
		});
	}


	private injectSVGFilter() {
		const svgFilter = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svgFilter.setAttribute('id', 'dark-mode-images-svg');
		// credit: https://monochrome.sutic.nu/2024/02/25/hue-preserving-invert-css-filter-for-dark-mode.html
		const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
		const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
		filter.setAttribute('id', 'dark-mode-images-svg-filter');
		filter.setAttribute('color-interpolation-filters', 'linearRGB');

		const feComponentTransfer = document.createElementNS('http://www.w3.org/2000/svg', 'feComponentTransfer');

		const feFuncR = document.createElementNS('http://www.w3.org/2000/svg', 'feFuncR');
		feFuncR.setAttribute('type', 'gamma');
		feFuncR.setAttribute('amplitude', '1');
		feFuncR.setAttribute('exponent', '0.5');
		feFuncR.setAttribute('offset', '0.0');

		const feFuncG = document.createElementNS('http://www.w3.org/2000/svg', 'feFuncG');
		feFuncG.setAttribute('type', 'gamma');
		feFuncG.setAttribute('amplitude', '1');
		feFuncG.setAttribute('exponent', '0.5');
		feFuncG.setAttribute('offset', '0.0');

		const feFuncB = document.createElementNS('http://www.w3.org/2000/svg', 'feFuncB');
		feFuncB.setAttribute('type', 'gamma');
		feFuncB.setAttribute('amplitude', '1');
		feFuncB.setAttribute('exponent', '0.5');
		feFuncB.setAttribute('offset', '0.0');

		const feFuncA = document.createElementNS('http://www.w3.org/2000/svg', 'feFuncA');
		feFuncA.setAttribute('type', 'gamma');
		feFuncA.setAttribute('amplitude', '1');
		feFuncA.setAttribute('exponent', '1');
		feFuncA.setAttribute('offset', '0.0');

		const feColorMatrix = document.createElementNS('http://www.w3.org/2000/svg', 'feColorMatrix');
		feColorMatrix.setAttribute('type', 'matrix');
		feColorMatrix.setAttribute('values', `
			1.000 -1.000 -1.000 0.000 1.000
		   -1.000 1.000 -1.000 0.000 1.000
		   -1.000 -1.000 1.000 0.000 1.000
			0.000 0.000 0.000 1.000 0.000
		`);

		// Assemble the SVG structure
		feComponentTransfer.appendChild(feFuncR);
		feComponentTransfer.appendChild(feFuncG);
		feComponentTransfer.appendChild(feFuncB);
		feComponentTransfer.appendChild(feFuncA);

		filter.appendChild(feComponentTransfer);
		filter.appendChild(feColorMatrix);

		defs.appendChild(filter);
		svgFilter.appendChild(defs);

		// Add to document body
		document.body.appendChild(svgFilter);
		this.svgFilterElement = svgFilter;
	}

	// Add CSS classes to images that match user-configured extensions
	private updateImageClasses() {
		// normalize and dedupe extensions
		const exts = Array.from(new Set(this.settings.extensions
			.map(e => e.trim().toLowerCase())
			.filter(Boolean)
			.map(e => e.startsWith('.') ? e.slice(1) : e)
		));

		// Remove class from all images first
		const allImages = document.querySelectorAll('img.dark-mode-images-img');
		allImages.forEach(img => img.classList.remove('dark-mode-images-img'));

		if (exts.length === 0) return;

		// Add class to images with matching extensions
		const images = document.querySelectorAll(':is(.markdown-preview-view, .cm-editor) img[src]');
		images.forEach(img => {
			const src = (img as HTMLImageElement).src;
			if (src && exts.some(ext => src.toLowerCase().includes(`.${ext}`))) {
				img.classList.add('dark-mode-images-img');
			}
		});
	}
}