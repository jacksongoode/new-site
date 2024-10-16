import * as pagefind from "pagefind";
import fontSubsettingPlugin from "@photogabble/eleventy-plugin-font-subsetting";

import pluginRss from "@11ty/eleventy-plugin-rss";
import pluginSyntaxHighlight from "@11ty/eleventy-plugin-syntaxhighlight";
import pluginBundle from "@11ty/eleventy-plugin-bundle";
import pluginNavigation from "@11ty/eleventy-navigation";
import {
	IdAttributePlugin,
	HtmlBasePlugin,
} from "@11ty/eleventy";

import pluginDrafts from "./eleventy.config.drafts.js";
import pluginImages from "./eleventy.config.images.js";
import pluginFilters from "./_config/filters.js";

export default async function (eleventyConfig) {
	// const getSVGPathForLetter = await import('./public/js/sound-letters/svg-converter.js');

	// Copy the contents of the `public` folder to the output folder
	// For example, `./public/css/` ends up in `_site/css/`
	eleventyConfig.addPassthroughCopy({
		"./public/": "/",
		"/_site/pagefind": "pagefind",
	});

	// eleventyConfig.addJavaScriptFunction("getSVGPathForLetter", getSVGPathForLetter);
	// eleventyConfig.addNunjucksGlobal("getSVGPathForLetter", getSVGPathForLetter);

	// Run Eleventy when these files change:
	// https://www.11ty.dev/docs/watch-serve/#add-your-own-watch-targets

	// Watch content images for the image pipeline.
	eleventyConfig.addWatchTarget("content/**/*.{svg,webp,png,jpeg}");

	// App plugins
	eleventyConfig.addPlugin(pluginDrafts);
	eleventyConfig.addPlugin(pluginImages);

	// Official plugins
	eleventyConfig.addPlugin(pluginRss);
	eleventyConfig.addPlugin(pluginSyntaxHighlight, {
		preAttributes: { tabindex: 0 },
	});
	eleventyConfig.addPlugin(pluginNavigation);
	eleventyConfig.addPlugin(HtmlBasePlugin);
	eleventyConfig.addPlugin(pluginBundle);

	// Auto font subsetting
	eleventyConfig.addPlugin(fontSubsettingPlugin, {
		srcFiles: [
			"./public/font/Switzer-Variable.woff2",
			"./public/font/Rag-Regular.woff2",
			"./public/font/Rag-Italic.woff2",
			"./public/font/Rag-Bold.woff2",
			"./public/font/Rag-BoldItalic.woff2",
		],
		// enabled: process.env.ELEVENTY_ENV !== 'production'
	});

	// Watch CSS files for changes
	eleventyConfig.addWatchTarget("public/css/**/*.css");

	// Filters
	eleventyConfig.addPlugin(pluginFilters);

	eleventyConfig.addPlugin(IdAttributePlugin, {
		// by default we use Eleventy’s built-in `slugify` filter:
		// slugify: eleventyConfig.getFilter("slugify"),
		// selector: "h1,h2,h3,h4,h5,h6", // default
	});

	// Shortcodes
	eleventyConfig.addShortcode("currentBuildDate", () => {
		return new Date().toISOString();
	});

	eleventyConfig.addShortcode(
		"figure",
		function (src, caption, aspectRatio = "16/9") {
			if (src.includes("youtube.com")) {
				let [, queryString] = src.split("watch?");
				let [videoIdPart, ...otherParts] = queryString.split("?");
				let videoId = videoIdPart.split("=")[1];
				let otherParams = otherParts.join("&");

				return `<figure>
				<lite-youtube
					videoid="${videoId}"
					style="background-image: url('https://i.ytimg.com/vi/${videoId}/hqdefault.jpg');"
					${otherParams ? `params="${otherParams}"` : ""}
					data-title="${caption}"
					>
					<button type="button" class="lty-playbtn">
						<span class="lyt-visually-hidden">${caption}</span>
					</button>
				</lite-youtube>
				<figcaption>${caption}</figcaption>
			</figure>`;
			} else if (src.includes("vimeo.com")) {
				const videoId = src.split("/").pop();
				return `<figure>
				<lite-vimeo videoid="${videoId}" style="aspect-ratio: ${aspectRatio};">
					<div class="ltv-playbtn"></div>
				</lite-vimeo>
				<figcaption>${caption}</figcaption>
			</figure>`;
			} else {
				const isVideo = /\.(mp4|webm|ogg)$/i.test(src);
				const isUrl = /^https?:\/\//i.test(src);
				const imgSrc = isUrl ? src : `/img/${src}`;
				const element = isVideo
					? `<video src="${src}" style="aspect-ratio: ${aspectRatio};" controls>Your browser does not support the video tag.</video>`
					: `<img src="${imgSrc}" alt="${caption}" loading="lazy" decoding="async" />`;

				return `<figure>${element}<figcaption>${caption}</figcaption></figure>`;
			}
		},
	);

	eleventyConfig.addShortcode("cite", function (author, year, title, url) {
		const citation = `<p class="citation">${author}. (${year}). <em>${title}</em>`;
		const urlPattern = /^(https?:\/\/[^\s$.?#].[^\s]*)$/i;

		if (url && urlPattern.test(url)) {
			return `${citation}. Retrieved from <a href="${url}">${url}</a></p>`;
		} else if (url) {
			return `${citation}. ${url}</p>`;
		}
		return `${citation}</p>`;
	});

	// Features to make your build faster (when you need them)

	// If your passthrough copy gets heavy and cumbersome, add this line
	// to emulate the file copy on the dev server. Learn more:
	// https://www.11ty.dev/docs/copy/#emulate-passthrough-copy-during-serve

	// eleventyConfig.setServerPassthroughCopyBehavior("passthrough");

	eleventyConfig.on("eleventy.after", async () => {
		process.stdout.write("Running Pagefind...");
		try {
			const { index } = await pagefind.createIndex({
				rootSelector: "main",
				forceLanguage: "en",
				verbose: false,
			});
			await index.addDirectory({
				path: "_site",
			});
			await index.writeFiles({
				outputPath: "_site/pagefind",
			});
			process.stdout.write(" indexing complete.\n");
		} catch (error) {
			console.error("Pagefind error:", error);
		} finally {
			await pagefind.close();
		}
	});

	return {
		// Control which files Eleventy will process
		// e.g.: *.md, *.njk, *.html, *.liquid
		templateFormats: ["md", "njk", "html", "liquid"],

		// Pre-process *.md files with: (default: `liquid`)
		markdownTemplateEngine: "njk",

		// Pre-process *.html files with: (default: `liquid`)
		htmlTemplateEngine: "njk",

		// These are all optional:
		dir: {
			input: "content", // default: "."
			includes: "../_includes", // default: "_includes"
			data: "../_data", // default: "_data"
			output: "_site",
		},

		// -----------------------------------------------------------------
		// Optional items:
		// -----------------------------------------------------------------

		// If your site deploys to a subdirectory, change `pathPrefix`.
		// Read more: https://www.11ty.dev/docs/config/#deploy-to-a-subdirectory-with-a-path-prefix

		// When paired with the HTML <base> plugin https://www.11ty.dev/docs/plugins/html-base/
		// it will transform any absolute URLs in your HTML to include this
		// folder name and does **not** affect where things go in the output folder.
		pathPrefix: "/",
	};
}
