import { Plugin } from 'obsidian';

export default class DarkModeSVGFilterPlugin extends Plugin {
	private svgFilterElement: SVGElement | null = null;
	private styleElement: HTMLStyleElement | null = null;

	async onload() {
		console.log('Loading Dark Mode SVG Filter plugin');
		
		// Inject the SVG filter into the DOM
		this.injectSVGFilter();
		
		// Inject CSS rules that automatically apply filters based on theme
		this.injectCSS();
	}

	onunload() {
		console.log('Unloading Dark Mode SVG Filter plugin');
		
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
		// Create the SVG filter element
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
		style.setAttribute('data-darkmode-svg-filter', 'true');
		
		// CSS rules that apply the filter only in dark mode
		style.textContent = `
			/* Apply SVG filter to img elements with SVG sources in dark mode */
			body.theme-dark .markdown-preview-view img[src*=".svg"],
			body.theme-dark .cm-editor img[src*=".svg"],
			body.is-dark .markdown-preview-view img[src*=".svg"],
			body.is-dark .cm-editor img[src*=".svg"],
			.theme-dark .markdown-preview-view img[src*=".svg"],
			.theme-dark .cm-editor img[src*=".svg"] {
				filter: url(#invert-luminance) !important;
			}
			
			/* Ensure no filter in light mode */
			body:not(.theme-dark):not(.is-dark) .markdown-preview-view img[src*=".svg"],
			body:not(.theme-dark):not(.is-dark) .cm-editor img[src*=".svg"] {
				filter: none !important;
			}
		`;
		
		// Add to document head
		document.head.appendChild(style);
		this.styleElement = style;
	}
}