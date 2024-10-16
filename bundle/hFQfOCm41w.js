// Minimal JS for handling user preference
(function () {
    const toggle = document.getElementById('dark-mode-toggle');

    // Set initial state based on localStorage or system preference
    const storedTheme = localStorage.getItem('color-scheme');
    if (storedTheme) {
        document.documentElement.setAttribute('data-theme', storedTheme);
        toggle.checked = storedTheme === 'dark';
    }

    // Handle toggle changes
    toggle.addEventListener('change', () => {
        const newTheme = toggle.checked ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('color-scheme', newTheme);
    });

    // const form = document.getElementById('theme-form');
    // Handle form submission (for no-JS fallback)
    // form.addEventListener('submit', (e) => {
    //     e.preventDefault();
    //     const formData = new FormData(form);
    //     fetch('/set-theme', {
    //         method: 'POST',
    //         body: formData
    //     }).then(() => {
    //         location.reload();
    //     });
    // });
})();

		// Generate a random user ID if not already stored
function getUserId() {
	return (
		localStorage.getItem("userId") ||
		localStorage.setItem(
			"userId",
			"user_" + Math.random().toString(36).slice(2, 11),
		)
	);
}

function sendMessageToWorker(message) {
	const baseUrl =
		window.location.hostname === "localhost" ||
		window.location.hostname === "127.0.0.1"
			? "http://localhost:8090"
			: "";
	const isDarkMode =
		document.documentElement.getAttribute("data-theme") === "dark";
	const animalParam = isDarkMode ? "frog" : "chicken";

	updateNavPhrase(isDarkMode ? "Ribbit" : "Cluck", true);

	// Get the body content
	const bodyContent = document.body.innerText;

	// Prepare the message with the body content
	const fullMessage = `Current page content:\n${bodyContent}\n\nUser message: ${message}`;

	fetch(
		`${baseUrl}/ai?message=${encodeURIComponent(fullMessage)}&animal=${animalParam}&userId=${getUserId()}`,
	)
		.then((response) => {
			if (!response.ok)
				throw new Error(`HTTP error! status: ${response.status}`);
			return response.body.getReader();
		})
		.then((reader) => {
			let accumulatedResponse = "";

			function readStream() {
				let buffer = "";
				reader.read().then(function processText({ done, value }) {
					if (done) {
						updateNavPhrase(accumulatedResponse, false);
						return;
					}

					buffer += new TextDecoder().decode(value);
					let newlineIndex;
					while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
						const line = buffer.slice(0, newlineIndex);
						buffer = buffer.slice(newlineIndex + 1);

						if (line.startsWith("data: ")) {
							try {
								const jsonStr = line.slice(5).trim();
								if (jsonStr === "[DONE]") {
									updateNavPhrase(accumulatedResponse, false);
									return;
								}
								const data = JSON.parse(jsonStr);
								if (data.response) {
									accumulatedResponse += data.response;
									updateNavPhrase(accumulatedResponse, false);
								}
							} catch (error) {
								buffer = line + "\n" + buffer;
								break;
							}
						}
					}

					return reader.read().then(processText);
				});
			}

			readStream();
		})
		.catch((error) => {
			console.error("Fetch error:", error);
			updateNavPhrase("Sorry, something went wrong.");
		});
}

function updateNavPhrase(text, isWaiting = false) {
	const navPhrase = document.getElementById("navPhrase");
	navPhrase.textContent = text;
	navPhrase.classList.toggle("waiting", isWaiting);
	navPhrase.classList.toggle("clickable", !isWaiting && text.length > 0);
}

document.addEventListener("DOMContentLoaded", function () {
	const chatTrigger = document.getElementById("chat-toggle");
	const talkBubble = document.querySelector(".nav-bubble");
	const mainContent = document.querySelector("main");
	const navPhrase = document.getElementById("navPhrase");
	const chatReset = document.getElementById("chat-reset");
	let originalContent = navPhrase.innerHTML;

	function resetChatInterface() {
		navPhrase.innerHTML = originalContent;
		talkBubble.classList.remove("chat-active");
		mainContent.classList.remove("chat-active");
	}

	chatReset.addEventListener("click", resetChatInterface);

	function activateChatInterface() {
		navPhrase.innerHTML = `
		<form id="chat-form">
		  <input type="text" id="user-input" placeholder="Search... or say hi?">
		  <button type="submit" style="display:none;">Send</button>
		</form>
		<div id="search-results"></div>
	  `;
		document.getElementById("user-input").focus();

		const searchResults = document.getElementById("search-results");
		let pagefind;

		document
			.getElementById("user-input")
			.addEventListener("input", async function () {
				if (!pagefind) {
					pagefind = await import("/pagefind/pagefind.js");
					await pagefind.options({
						element: "#search-results",
						excerptLength: 15,
						highlightParam: "highlight",
					});
					await pagefind.init();
				}

				const query = this.value.trim();
				if (query.length > 2) {
					const search = await pagefind.search(query);
					const results = await Promise.all(
						search.results.map((r) => r.data()),
					);

					searchResults.innerHTML =
						results.length > 0
							? results
									.map(
										(result) => `
			<a href="${result.url}" class="search-result">
			  <div class="search-result-title">${result.meta.title || "Untitled"}</div>
			  <p>${result.excerpt}</p>
			</a>
		  `,
									)
									.join("")
							: "";
					talkBubble.classList.add("chat-active");
				} else {
					searchResults.innerHTML = "";
				}
			});

		document
			.getElementById("chat-form")
			.addEventListener("submit", function (e) {
				e.preventDefault();
				const userInput = document.getElementById("user-input");
				if (userInput.value.trim() !== "") {
					sendMessageToWorker(userInput.value.trim());
					userInput.value = "";
					searchResults.innerHTML = "";
				}
			});

		document
			.getElementById("user-input")
			.addEventListener("keydown", function (e) {
				if (e.key === "Escape") resetChatInterface();
			});
	}

	function handleChatTrigger() {
		talkBubble.classList.toggle("chat-active");
		mainContent.classList.toggle("chat-active");
		talkBubble.classList.contains("chat-active")
			? activateChatInterface()
			: (navPhrase.innerHTML = originalContent);
	}

	chatTrigger.addEventListener("click", handleChatTrigger);

	navPhrase.addEventListener("click", function (event) {
		if (event.target.tagName.toLowerCase() === "a") return;
		if (
			window.innerWidth < 840 &&
			!talkBubble.classList.contains("chat-active")
		) {
			handleChatTrigger();
		} else if (navPhrase.classList.contains("clickable")) {
			activateChatInterface();
			navPhrase.classList.remove("clickable");
		}
	});
});

		// Thank you to https://github.com/daviddarnes/heading-anchors
// Thank you to https://amberwilson.co.uk/blog/are-your-anchor-links-accessible/

let globalInstanceIndex = 0;

class HeadingAnchors extends HTMLElement {
	static register(tagName) {
		if ("customElements" in window) {
			customElements.define(tagName || "heading-anchors", HeadingAnchors);
		}
	}

	static attributes = {
		exclude: "data-ha-exclude",
		prefix: "prefix",
		content: "content",
	}

	static classes = {
		anchor: "ha",
		placeholder: "ha-placeholder",
		srOnly: "ha-visualhide",
	}

	static defaultSelector = "h2,h3,h4,h5,h6";

	static css = `
.${HeadingAnchors.classes.srOnly} {
	clip: rect(0 0 0 0);
	height: 1px;
	overflow: hidden;
	position: absolute;
	width: 1px;
}
.${HeadingAnchors.classes.anchor} {
	position: absolute;
	left: var(--ha_offsetx);
	top: var(--ha_offsety);
	text-decoration: none;
	opacity: 0;
}
.${HeadingAnchors.classes.placeholder} {
	opacity: .3;
}
.${HeadingAnchors.classes.anchor}:is(:focus-within, :hover) {
	opacity: 1;
}
.${HeadingAnchors.classes.anchor},
.${HeadingAnchors.classes.placeholder} {
	padding: 0 .25em;

	/* Disable selection of visually hidden label */
	-webkit-user-select: none;
	user-select: none;
}

@supports (anchor-name: none) {
	.${HeadingAnchors.classes.anchor} {
		position: absolute;
		left: anchor(left);
		top: anchor(top);
	}
}`;

	get supports() {
		return "replaceSync" in CSSStyleSheet.prototype;
	}

	get supportsAnchorPosition() {
		return CSS.supports("anchor-name: none");
	}

	constructor() {
		super();

		if(!this.supports) {
			return;
		}

		let sheet = new CSSStyleSheet();
		sheet.replaceSync(HeadingAnchors.css);
		document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];

		this.headingStyles = {};
		this.instanceIndex = globalInstanceIndex++;
	}

	connectedCallback() {
		if (!this.supports) {
			return;
		}

		this.headings.forEach((heading, index) => {
			if(!heading.hasAttribute(HeadingAnchors.attributes.exclude)) {
				let anchor = this.getAnchorElement(heading);
				let placeholder = this.getPlaceholderElement();

				// Prefers anchor position approach for better accessibility
				// https://amberwilson.co.uk/blog/are-your-anchor-links-accessible/
				if(this.supportsAnchorPosition) {
					let anchorName = `--ha_${this.instanceIndex}_${index}`;
					placeholder.style.setProperty("anchor-name", anchorName);
					anchor.style.positionAnchor = anchorName;
				}

				heading.appendChild(placeholder)
				heading.after(anchor);
			}
		});
	}

	// Polyfill-only
	positionAnchorFromPlaceholder(placeholder) {
		if(!placeholder) {
			return;
		}

		let heading = placeholder.closest("h1,h2,h3,h4,h5,h6");
		if(!heading.nextElementSibling) {
			return;
		}

		// TODO next element could be more defensive
		this.positionAnchor(heading.nextElementSibling);
	}

	// Polyfill-only
	positionAnchor(anchor) {
		if(!anchor || !anchor.previousElementSibling) {
			return;
		}

		// TODO previous element could be more defensive
		let heading = anchor.previousElementSibling;
		this.setFontProp(heading, anchor);

		if(this.supportsAnchorPosition) {
			// quit early
			return;
		}

		let placeholder = heading.querySelector(`.${HeadingAnchors.classes.placeholder}`);
		if(placeholder) {
			anchor.style.setProperty("--ha_offsetx", `${placeholder.offsetLeft}px`);
			anchor.style.setProperty("--ha_offsety", `${placeholder.offsetTop}px`);
		}
	}

	setFontProp(heading, anchor) {
		let placeholder = heading.querySelector(`.${HeadingAnchors.classes.placeholder}`);
		if(placeholder) {
			let style = getComputedStyle(placeholder);
			let props = ["font-weight", "font-size", "line-height", "font-family"];
			let font = props.map(name => style.getPropertyValue(name));
			anchor.style.setProperty("font", `${font[0]} ${font[1]}/${font[2]} ${font[3]}`);
		}
	}

	getAccessibleTextPrefix() {
		// Useful for i18n
		return this.getAttribute(HeadingAnchors.attributes.prefix) || "Jump to section titled";
	}

	getContent() {
		return this.getAttribute(HeadingAnchors.attributes.content) || "#";
	}

	getPlaceholderElement() {
		let ph = document.createElement("span");
		ph.setAttribute("aria-hidden", true);
		ph.classList.add(HeadingAnchors.classes.placeholder);
		ph.textContent = this.getContent();

		ph.addEventListener("mouseover", (e) => {
			let placeholder = e.target.closest(`.${HeadingAnchors.classes.placeholder}`);
			if(placeholder) {
				this.positionAnchorFromPlaceholder(placeholder);
			}
		});

		return ph;
	}

	getAnchorElement(heading) {
		let anchor = document.createElement("a");
		anchor.href = `#${heading.id}`;
		anchor.classList.add(HeadingAnchors.classes.anchor);

		let content = this.getContent();
		anchor.innerHTML = `<span class="${HeadingAnchors.classes.srOnly}">${this.getAccessibleTextPrefix()}: ${heading.textContent}</span><span aria-hidden="true">${content}</span>`;

		anchor.addEventListener("focus", e => {
			let anchor = e.target.closest(`.${HeadingAnchors.classes.anchor}`);
			if(anchor) {
				this.positionAnchor(anchor);
			}
		});

		anchor.addEventListener("mouseover", (e) => {
			// when CSS anchor positioning is supported, this is only used to set the font
			let anchor = e.target.closest(`.${HeadingAnchors.classes.anchor}`);
			this.positionAnchor(anchor);
		});

		return anchor;
	}

	get headings() {
		return this.querySelectorAll(this.selector.split(",").map(entry => `${entry.trim()}[id]`));
	}

	get selector() {
		return this.getAttribute("selector") || HeadingAnchors.defaultSelector;
	}
}

HeadingAnchors.register();

export { HeadingAnchors }


		
			
			/**
 * A lightweight youtube embed. Still should feel the same to the user, just MUCH faster to initialize and paint.
 *
 * Thx to these as the inspiration
 *   https://storage.googleapis.com/amp-vs-non-amp/youtube-lazy.html
 *   https://autoplay-youtube-player.glitch.me/
 *
 * Once built it, I also found these:
 *   https://github.com/ampproject/amphtml/blob/master/extensions/amp-youtube (👍👍)
 *   https://github.com/Daugilas/lazyYT
 *   https://github.com/vb/lazyframe
 */
class LiteYTEmbed extends HTMLElement {
    connectedCallback() {
        this.videoId = this.getAttribute('videoid');

        let playBtnEl = this.querySelector('.lty-playbtn');
        // A label for the button takes priority over a [playlabel] attribute on the custom-element
        this.playLabel = (playBtnEl && playBtnEl.textContent.trim()) || this.getAttribute('playlabel') || 'Play';

        this.dataset.title = this.getAttribute('title') || "";

        /**
         * Lo, the youtube poster image!  (aka the thumbnail, image placeholder, etc)
         *
         * See https://github.com/paulirish/lite-youtube-embed/blob/master/youtube-thumbnail-urls.md
         */
        if (!this.style.backgroundImage) {
          this.style.backgroundImage = `url("https://i.ytimg.com/vi/${this.videoId}/hqdefault.jpg")`;
          this.upgradePosterImage();
        }

        // Set up play button, and its visually hidden label
        if (!playBtnEl) {
            playBtnEl = document.createElement('button');
            playBtnEl.type = 'button';
            playBtnEl.classList.add('lty-playbtn');
            this.append(playBtnEl);
        }
        if (!playBtnEl.textContent) {
            const playBtnLabelEl = document.createElement('span');
            playBtnLabelEl.className = 'lyt-visually-hidden';
            playBtnLabelEl.textContent = this.playLabel;
            playBtnEl.append(playBtnLabelEl);
        }

        this.addNoscriptIframe();

        // for the PE pattern, change anchor's semantics to button
        if(playBtnEl.nodeName === 'A'){
            playBtnEl.removeAttribute('href');
            playBtnEl.setAttribute('tabindex', '0');
            playBtnEl.setAttribute('role', 'button');
            // fake button needs keyboard help
            playBtnEl.addEventListener('keydown', e => {
                if( e.key === 'Enter' || e.key === ' ' ){
                    e.preventDefault();
                    this.activate();
                }
            });
        }

        // On hover (or tap), warm up the TCP connections we're (likely) about to use.
        this.addEventListener('pointerover', LiteYTEmbed.warmConnections, {once: true});
        this.addEventListener('focusin', LiteYTEmbed.warmConnections, {once: true});

        // Once the user clicks, add the real iframe and drop our play button
        // TODO: In the future we could be like amp-youtube and silently swap in the iframe during idle time
        //   We'd want to only do this for in-viewport or near-viewport ones: https://github.com/ampproject/amphtml/pull/5003
        this.addEventListener('click', this.activate);

        // Chrome & Edge desktop have no problem with the basic YouTube Embed with ?autoplay=1
        // However Safari desktop and most/all mobile browsers do not successfully track the user gesture of clicking through the creation/loading of the iframe,
        // so they don't autoplay automatically. Instead we must load an additional 2 sequential JS files (1KB + 165KB) (un-br) for the YT Player API
        // TODO: Try loading the the YT API in parallel with our iframe and then attaching/playing it. #82
        this.needsYTApi = this.hasAttribute("js-api") || navigator.vendor.includes('Apple') || navigator.userAgent.includes('Mobi');
    }

    /**
     * Add a <link rel={preload | preconnect} ...> to the head
     */
    static addPrefetch(kind, url, as) {
        const linkEl = document.createElement('link');
        linkEl.rel = kind;
        linkEl.href = url;
        if (as) {
            linkEl.as = as;
        }
        document.head.append(linkEl);
    }

    /**
     * Begin pre-connecting to warm up the iframe load
     * Since the embed's network requests load within its iframe,
     *   preload/prefetch'ing them outside the iframe will only cause double-downloads.
     * So, the best we can do is warm up a few connections to origins that are in the critical path.
     *
     * Maybe `<link rel=preload as=document>` would work, but it's unsupported: http://crbug.com/593267
     * But TBH, I don't think it'll happen soon with Site Isolation and split caches adding serious complexity.
     */
    static warmConnections() {
        if (LiteYTEmbed.preconnected) return;

        // The iframe document and most of its subresources come right off youtube.com
        LiteYTEmbed.addPrefetch('preconnect', 'https://www.youtube-nocookie.com');
        // The botguard script is fetched off from google.com
        LiteYTEmbed.addPrefetch('preconnect', 'https://www.google.com');

        // Not certain if these ad related domains are in the critical path. Could verify with domain-specific throttling.
        LiteYTEmbed.addPrefetch('preconnect', 'https://googleads.g.doubleclick.net');
        LiteYTEmbed.addPrefetch('preconnect', 'https://static.doubleclick.net');

        LiteYTEmbed.preconnected = true;
    }

    fetchYTPlayerApi() {
        if (window.YT || (window.YT && window.YT.Player)) return;

        this.ytApiPromise = new Promise((res, rej) => {
            var el = document.createElement('script');
            el.src = 'https://www.youtube.com/iframe_api';
            el.async = true;
            el.onload = _ => {
                YT.ready(res);
            };
            el.onerror = rej;
            this.append(el);
        });
    }

    /** Return the YT Player API instance. (Public L-YT-E API) */
    async getYTPlayer() {
        if(!this.playerPromise) {
            await this.activate();
        }

        return this.playerPromise;
    }

    async addYTPlayerIframe() {
        this.fetchYTPlayerApi();
        await this.ytApiPromise;

        const videoPlaceholderEl = document.createElement('div')
        this.append(videoPlaceholderEl);

        const paramsObj = Object.fromEntries(this.getParams().entries());

        this.playerPromise = new Promise(resolve => {
            let player = new YT.Player(videoPlaceholderEl, {
                width: '100%',
                videoId: this.videoId,
                playerVars: paramsObj,
                events: {
                    'onReady': event => {
                        event.target.playVideo();
                        resolve(player);
                    }
                }
            });
        });
    }

    // Add the iframe within <noscript> for indexability discoverability. See https://github.com/paulirish/lite-youtube-embed/issues/105
    addNoscriptIframe() {
        const iframeEl = this.createBasicIframe();
        const noscriptEl = document.createElement('noscript');
        // Appending into noscript isn't equivalant for mysterious reasons: https://html.spec.whatwg.org/multipage/scripting.html#the-noscript-element
        noscriptEl.innerHTML = iframeEl.outerHTML;
        this.append(noscriptEl);
    }

    getParams() {
        const params = new URLSearchParams(this.getAttribute('params') || []);
        params.append('autoplay', '1');
        params.append('playsinline', '1');
        return params;
    }

    async activate(){
        if (this.classList.contains('lyt-activated')) return;
        this.classList.add('lyt-activated');

        if (this.needsYTApi) {
            return this.addYTPlayerIframe(this.getParams());
        }

        const iframeEl = this.createBasicIframe();
        this.append(iframeEl);

        // Set focus for a11y
        iframeEl.focus();
    }

    createBasicIframe(){
        const iframeEl = document.createElement('iframe');
        iframeEl.width = 560;
        iframeEl.height = 315;
        // No encoding necessary as [title] is safe. https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html#:~:text=Safe%20HTML%20Attributes%20include
        iframeEl.title = this.playLabel;
        iframeEl.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture';
        iframeEl.allowFullscreen = true;
        // AFAIK, the encoding here isn't necessary for XSS, but we'll do it only because this is a URL
        // https://stackoverflow.com/q/64959723/89484
        iframeEl.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(this.videoId)}?${this.getParams().toString()}`;
        return iframeEl;
    }

    /**
     * In the spirit of the `lowsrc` attribute and progressive JPEGs, we'll upgrade the reliable
     * poster image to a higher resolution one, if it's available.
     * Interestingly this sddefault webp is often smaller in filesize, but we will still attempt it second
     * because getting _an_ image in front of the user if our first priority.
     *
     * See https://github.com/paulirish/lite-youtube-embed/blob/master/youtube-thumbnail-urls.md for more details
     */
    upgradePosterImage() {
         // Defer to reduce network contention.
        setTimeout(() => {
            const webpUrl = `https://i.ytimg.com/vi_webp/${this.videoId}/sddefault.webp`;
            const img = new Image();
            img.fetchPriority = 'low'; // low priority to reduce network contention
            img.referrerpolicy = 'origin'; // Not 100% sure it's needed, but https://github.com/ampproject/amphtml/pull/3940
            img.src = webpUrl;
            img.onload = e => {
                // A pretty ugly hack since onerror won't fire on YouTube image 404. This is (probably) due to
                // Youtube's style of returning data even with a 404 status. That data is a 120x90 placeholder image.
                // … per "annoying yt 404 behavior" in the .md
                const noAvailablePoster = e.target.naturalHeight == 90 && e.target.naturalWidth == 120;
                if (noAvailablePoster) return;

                this.style.backgroundImage = `url("${webpUrl}")`;
            }
        }, 100);
    }
}
// Register custom element
customElements.define('lite-youtube', LiteYTEmbed);

			const style = document.head.appendChild(document.createElement('style'));
style.textContent = /*css*/`

  lite-vimeo {
    aspect-ratio: 16 / 9;
    background-color: #000;
    position: relative;
    display: block;
    contain: content;
    background-position: center center;
    background-size: cover;
    cursor: pointer;
  }

  lite-vimeo > iframe {
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
    border: 0;
  }

  lite-vimeo > .ltv-playbtn {
    font-size: 10px;
    padding: 0;
    width: 6.5em;
    height: 4em;
    background: rgba(23, 35, 34, .75);
    z-index: 1;
    opacity: .8;
    border-radius: .5em;
    transition: opacity .2s ease-out, background .2s ease-out;
    outline: 0;
    border: 0;
    cursor: pointer;
  }

  lite-vimeo:hover > .ltv-playbtn {
    background-color: rgb(0, 173, 239);
    opacity: 1;
  }

  /* play button triangle */
  lite-vimeo > .ltv-playbtn::before {
    content: '';
    border-style: solid;
    border-width: 10px 0 10px 20px;
    border-color: transparent transparent transparent #fff;
  }

  lite-vimeo > .ltv-playbtn,
  lite-vimeo > .ltv-playbtn::before {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate3d(-50%, -50%, 0);
  }

  /* Post-click styles */
  lite-vimeo.ltv-activated {
    cursor: unset;
  }

  lite-vimeo.ltv-activated::before,
  lite-vimeo.ltv-activated > .ltv-playbtn {
    opacity: 0;
    pointer-events: none;
  }
`;

/**
 * Ported from https://github.com/paulirish/lite-youtube-embed
 *
 * A lightweight vimeo embed. Still should feel the same to the user, just MUCH faster to initialize and paint.
 *
 * Thx to these as the inspiration
 *   https://storage.googleapis.com/amp-vs-non-amp/youtube-lazy.html
 *   https://autoplay-youtube-player.glitch.me/
 *
 * Once built it, I also found these:
 *   https://github.com/ampproject/amphtml/blob/master/extensions/amp-youtube (👍👍)
 *   https://github.com/Daugilas/lazyYT
 *   https://github.com/vb/lazyframe
 */
class LiteVimeo extends (globalThis.HTMLElement ?? class {}) {
  /**
   * Begin pre-connecting to warm up the iframe load
   * Since the embed's network requests load within its iframe,
   *   preload/prefetch'ing them outside the iframe will only cause double-downloads.
   * So, the best we can do is warm up a few connections to origins that are in the critical path.
   *
   * Maybe `<link rel=preload as=document>` would work, but it's unsupported: http://crbug.com/593267
   * But TBH, I don't think it'll happen soon with Site Isolation and split caches adding serious complexity.
   */
  static _warmConnections() {
    if (LiteVimeo.preconnected) return;
    LiteVimeo.preconnected = true;

    // The iframe document and most of its subresources come right off player.vimeo.com
    addPrefetch('preconnect', 'https://player.vimeo.com');
    // Images
    addPrefetch('preconnect', 'https://i.vimeocdn.com');
    // Files .js, .css
    addPrefetch('preconnect', 'https://f.vimeocdn.com');
    // Metrics
    addPrefetch('preconnect', 'https://fresnel.vimeocdn.com');
  }

  connectedCallback() {
    this.videoId = this.getAttribute('videoid');

    /**
     * Lo, the vimeo placeholder image!  (aka the thumbnail, poster image, etc)
     * We have to use the Vimeo API.
     */
    let { width, height } = getThumbnailDimensions(this.getBoundingClientRect());
    let devicePixelRatio = window.devicePixelRatio || 1;
    if (devicePixelRatio >= 2) devicePixelRatio *= .75;
    width = Math.round(width * devicePixelRatio);
    height = Math.round(height * devicePixelRatio);

    fetch(`https://vimeo.com/api/v2/video/${this.videoId}.json`)
      .then(response => response.json())
      .then(data => {
        let thumbnailUrl = data[0].thumbnail_large;
        thumbnailUrl = thumbnailUrl.replace(/-d_[\dx]+$/i, `-d_${width}x${height}`);
        this.style.backgroundImage = `url("${thumbnailUrl}")`;
      });

    let playBtnEl = this.querySelector('.ltv-playbtn');
    // A label for the button takes priority over a [playlabel] attribute on the custom-element
    this.playLabel = (playBtnEl && playBtnEl.textContent.trim()) || this.getAttribute('playlabel') || 'Play video';

    if (!playBtnEl) {
      playBtnEl = document.createElement('button');
      playBtnEl.type = 'button';
      playBtnEl.setAttribute('aria-label', this.playLabel);
      playBtnEl.classList.add('ltv-playbtn');
      this.append(playBtnEl);
    }
    playBtnEl.removeAttribute('href');

    // On hover (or tap), warm up the TCP connections we're (likely) about to use.
    this.addEventListener('pointerover', LiteVimeo._warmConnections, {
      once: true
    });

    // Once the user clicks, add the real iframe and drop our play button
    // TODO: In the future we could be like amp-youtube and silently swap in the iframe during idle time
    //   We'd want to only do this for in-viewport or near-viewport ones: https://github.com/ampproject/amphtml/pull/5003
    this.addEventListener('click', this.addIframe);
  }

  addIframe() {
    if (this.classList.contains('ltv-activated')) return;
    this.classList.add('ltv-activated');

    const iframeEl = document.createElement('iframe');
    iframeEl.width = 640;
    iframeEl.height = 360;
    // No encoding necessary as [title] is safe. https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html#:~:text=Safe%20HTML%20Attributes%20include
    iframeEl.title = this.playLabel;
    iframeEl.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture';
    // AFAIK, the encoding here isn't necessary for XSS, but we'll do it only because this is a URL
    // https://stackoverflow.com/q/64959723/89484
    iframeEl.src = `https://player.vimeo.com/video/${encodeURIComponent(this.videoId)}?autoplay=1`;
    this.append(iframeEl);

    // Set focus for a11y
    iframeEl.addEventListener('load', iframeEl.focus, { once: true });
  }
}

if (globalThis.customElements && !globalThis.customElements.get('lite-vimeo')) {
  globalThis.customElements.define('lite-vimeo', LiteVimeo);
}

/**
 * Add a <link rel={preload | preconnect} ...> to the head
 */
function addPrefetch(kind, url, as) {
  const linkElem = document.createElement('link');
  linkElem.rel = kind;
  linkElem.href = url;
  if (as) {
    linkElem.as = as;
  }
  linkElem.crossorigin = true;
  document.head.append(linkElem);
}

/**
 * Get the thumbnail dimensions to use for a given player size.
 *
 * @param {Object} options
 * @param {number} options.width The width of the player
 * @param {number} options.height The height of the player
 * @return {Object} The width and height
 */
function getThumbnailDimensions({ width, height }) {
  let roundedWidth = width;
  let roundedHeight = height;

  // If the original width is a multiple of 320 then we should
  // not round up. This is to keep the native image dimensions
  // so that they match up with the actual frames from the video.
  //
  // For example 640x360, 960x540, 1280x720, 1920x1080
  //
  // Round up to nearest 100 px to improve cacheability at the
  // CDN. For example, any width between 601 pixels and 699
  // pixels will render the thumbnail at 700 pixels width.
  if (roundedWidth % 320 !== 0) {
    roundedWidth = Math.ceil(width / 100) * 100;
    roundedHeight = Math.round((roundedWidth / width) * height);
  }

  return {
    width: roundedWidth,
    height: roundedHeight
  };
}