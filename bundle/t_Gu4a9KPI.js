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