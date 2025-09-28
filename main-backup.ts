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

	private setupThemeDetection() {
		// Initial application based on current theme
		this.updateSVGFilters();
		
		// Watch for theme changes by observing both body and html element changes
		const themeObserver = new MutationObserver((mutations) => {
			let shouldUpdate = false;
			
			mutations.forEach((mutation) => {
				if (mutation.type === 'attributes') {
					const target = mutation.target as Element;
					const attrName = mutation.attributeName;
					
					// Check if it's a theme-related change
					if (attrName === 'class' || attrName === 'data-theme' || attrName === 'theme') {
						console.log('Theme-related attribute change detected:', {
							target: target.tagName,
							attribute: attrName,
							oldValue: mutation.oldValue,
							newValue: target.getAttribute(attrName),
							classList: Array.from(target.classList || [])
						});
						shouldUpdate = true;
					}
				}
			});
			
			if (shouldUpdate) {
				// Small delay to ensure DOM has updated completely
				setTimeout(() => {
					console.log('Updating SVG filters due to theme change');
					this.updateSVGFilters();
				}, 10);
			}
		});
		
		// Observe both body and html elements for attribute changes
		themeObserver.observe(document.body, {
			attributes: true,
			attributeFilter: ['class', 'data-theme', 'theme'],
			attributeOldValue: true
		});
		
		themeObserver.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['class', 'data-theme', 'theme'],
			attributeOldValue: true
		});
		
		// Store the observer for cleanup
		this.observer = themeObserver;
	}

	private isDarkMode(): boolean {
		// Check multiple possible locations for dark theme indicators
		const body = document.body;
		const html = document.documentElement;
		
		// Check body classes
		const bodyHasDark = body.classList.contains('theme-dark') || 
						   body.classList.contains('dark') ||
						   body.classList.contains('is-dark');
		
		// Check html classes
		const htmlHasDark = html.classList.contains('theme-dark') || 
						   html.classList.contains('dark') ||
						   html.classList.contains('is-dark');
		
		// Check data attributes
		const bodyDataTheme = body.getAttribute('data-theme') === 'dark' || 
							 body.getAttribute('theme') === 'dark';
		const htmlDataTheme = html.getAttribute('data-theme') === 'dark' || 
							 html.getAttribute('theme') === 'dark';
		
		const isDark = bodyHasDark || htmlHasDark || bodyDataTheme || htmlDataTheme;
		
		// Debug logging
		console.log('Dark mode detection:', {
			bodyHasDark,
			htmlHasDark,
			bodyDataTheme,
			htmlDataTheme,
			isDark,
			bodyClasses: Array.from(body.classList),
			htmlClasses: Array.from(html.classList),
			bodyDataThemeAttr: body.getAttribute('data-theme'),
			htmlDataThemeAttr: html.getAttribute('data-theme')
		});
		
		return isDark;
	}

	private updateSVGFilters() {
		const isDark = this.isDarkMode();
		const svgImages = document.querySelectorAll('.markdown-preview-view img[src$=".svg"], .markdown-preview-view img[src*=".svg"], .cm-editor img[src$=".svg"], .cm-editor img[src*=".svg"]');
		
		console.log(`Updating SVG filters: isDark=${isDark}, found ${svgImages.length} SVG images`);
		
		svgImages.forEach((img, index) => {
			const element = img as HTMLElement;
			const hasFilter = element.hasAttribute('data-darkmode-filtered');
			console.log(`Image ${index}: isDark=${isDark}, hasFilter=${hasFilter}, src=${element.getAttribute('src')}`);
			
			if (isDark) {
				this.applySVGFilter(element);
			} else {
				this.removeSVGFilter(element);
			}
		});
		
		// In light mode, also clean up any lingering filters from elements that might not be in selectors anymore
		if (!isDark) {
			const filteredElements = document.querySelectorAll('[data-darkmode-filtered]');
			console.log(`Light mode cleanup: found ${filteredElements.length} filtered elements to clean up`);
			filteredElements.forEach((element) => {
				this.removeSVGFilter(element as HTMLElement);
			});
		}
	}

	private applySVGFilter(element: HTMLElement) {
		// Only apply filter if not already applied and avoid data attribute check to prevent duplication
		if (!element.hasAttribute('data-darkmode-filtered')) {
			const existingFilter = element.style.filter || '';
			// Make sure we don't add the filter if it's already there
			if (!existingFilter.includes('url(#invert-luminance)')) {
				const newFilter = existingFilter ? 
					`${existingFilter} url(#invert-luminance)` : 
					'url(#invert-luminance)';
				element.style.filter = newFilter;
				console.log(`Applied filter to element:`, element.getAttribute('src'), `filter: "${newFilter}"`);
			} else {
				console.log(`Filter already present in style for element:`, element.getAttribute('src'));
			}
			
			// Add a data attribute to track our modification
			element.setAttribute('data-darkmode-filtered', 'true');
		} else {
			console.log(`Element already marked as filtered:`, element.getAttribute('src'));
		}
	}

	private removeSVGFilter(element: HTMLElement) {
		if (element.hasAttribute('data-darkmode-filtered')) {
			// Remove ALL instances of our filter while preserving other filters
			const currentFilter = element.style.filter || '';
			const newFilter = currentFilter
				.replace(/\s*url\(#invert-luminance\)\s*/g, '')
				.replace(/^\s+|\s+$/g, '') // trim
				.replace(/\s+/g, ' '); // normalize spaces
			
			element.style.filter = newFilter || '';
			element.removeAttribute('data-darkmode-filtered');
			console.log(`Removed filter from element:`, element.getAttribute('src'), `old: "${currentFilter}" new: "${newFilter}"`);
		} else {
			console.log(`Element not marked as filtered, skipping:`, element.getAttribute('src'));
		}
	}

	private applyFiltersToExistingSVGs() {
		if (this.isDarkMode()) {
			const svgImages = document.querySelectorAll('.markdown-preview-view img[src$=".svg"], .markdown-preview-view img[src*=".svg"], .cm-editor img[src$=".svg"], .cm-editor img[src*=".svg"]');
			svgImages.forEach((img) => {
				this.applySVGFilter(img as HTMLElement);
			});
		}
	}

	private setupSVGObserver() {
		// Watch for new SVG elements being added to the DOM
		const svgObserver = new MutationObserver((mutations) => {
			mutations.forEach((mutation) => {
				mutation.addedNodes.forEach((node) => {
					if (node.nodeType === Node.ELEMENT_NODE) {
						const element = node as Element;
						
						// Check if the added node is an img with SVG source within note content areas
						const svgsToProcess: Element[] = [];
						
						// Only process if we're within a note content area
						const isInNoteContent = element.closest('.markdown-preview-view, .cm-editor') || 
							element.querySelector('.markdown-preview-view, .cm-editor');
						
						if (isInNoteContent) {
							if (element.tagName === 'IMG' && 
								 (element.getAttribute('src')?.includes('.svg') || false)) {
								svgsToProcess.push(element);
							}
							
							// Also check for img elements with SVG sources within the added element
							const nestedSvgs = element.querySelectorAll('.markdown-preview-view img[src$=".svg"], .markdown-preview-view img[src*=".svg"], .cm-editor img[src$=".svg"], .cm-editor img[src*=".svg"]');
							svgsToProcess.push(...Array.from(nestedSvgs));
						}
						
						// Apply filters if in dark mode
						if (this.isDarkMode()) {
							svgsToProcess.forEach((svg) => {
								this.applySVGFilter(svg as HTMLElement);
							});
						}
					}
				});
			});
		});
		
		// Observe the entire document for new SVG additions
		svgObserver.observe(document.body, {
			childList: true,
			subtree: true
		});
		
		// Combine with existing observer
		if (this.observer) {
			// We need to create a new combined observer
			const combinedObserver = new MutationObserver((mutations) => {
				mutations.forEach((mutation) => {
					// Handle theme changes
					if (mutation.type === 'attributes' && 
						mutation.target === document.body && 
						mutation.attributeName === 'class') {
						this.updateSVGFilters();
					}
					
					// Handle new SVG additions
					if (mutation.type === 'childList') {
						mutation.addedNodes.forEach((node) => {
							if (node.nodeType === Node.ELEMENT_NODE) {
								const element = node as Element;
								const svgsToProcess: Element[] = [];
								
								// Only process if we're within a note content area
								const isInNoteContent = element.closest('.markdown-preview-view, .cm-editor') || 
									element.querySelector('.markdown-preview-view, .cm-editor');
								
								if (isInNoteContent) {
									if (element.tagName === 'IMG' && 
										 (element.getAttribute('src')?.includes('.svg') || false)) {
										svgsToProcess.push(element);
									}
									
									const nestedSvgs = element.querySelectorAll('.markdown-preview-view img[src$=".svg"], .markdown-preview-view img[src*=".svg"], .cm-editor img[src$=".svg"], .cm-editor img[src*=".svg"]');
									svgsToProcess.push(...Array.from(nestedSvgs));
								}
								
								if (this.isDarkMode()) {
									svgsToProcess.forEach((svg) => {
										this.applySVGFilter(svg as HTMLElement);
									});
								}
							}
						});
					}
				});
			});
			
			this.observer.disconnect();
			combinedObserver.observe(document.body, {
				attributes: true,
				attributeFilter: ['class'],
				childList: true,
				subtree: true
			});
			
			this.observer = combinedObserver;
		}
	}

	private removeAllFilters() {
		// Remove filters from all elements that we've modified
		const filteredElements = document.querySelectorAll('[data-darkmode-filtered]');
		filteredElements.forEach((element) => {
			this.removeSVGFilter(element as HTMLElement);
		});
	}
}