import { DateTime } from "luxon";
import { createCanvas } from "canvas";
import * as letterUtils from "../public/js/sound-letters/letter-utils.js";

export default function (eleventyConfig) {
	eleventyConfig.addFilter("readableDate", (dateObj, format, zone) => {
		// Formatting tokens for Luxon: https://moment.github.io/luxon/#/formatting?id=table-of-tokens
		return DateTime.fromJSDate(dateObj, { zone: zone || "utc" }).toFormat(
			format || "dd LLLL yyyy",
		);
	});

	eleventyConfig.addFilter("htmlDateString", (dateObj) => {
		// dateObj input: https://html.spec.whatwg.org/multipage/common-microsyntaxes.html#valid-date-string
		return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat("yyyy-LL-dd");
	});

	// Get the first `n` elements of a collection.
	eleventyConfig.addFilter("head", (array, n) => {
		if (!Array.isArray(array) || array.length === 0) {
			return [];
		}
		if (n < 0) {
			return array.slice(n);
		}

		return array.slice(0, n);
	});

	// Return the smallest number argument
	eleventyConfig.addFilter("min", (...numbers) => {
		return Math.min.apply(null, numbers);
	});

	// Return all the tags used in a collection
	eleventyConfig.addFilter("getAllTags", (collection) => {
		let tagSet = new Set();
		for (let item of collection) {
			(item.data.tags || []).forEach((tag) => tagSet.add(tag));
		}
		return Array.from(tagSet);
	});

	eleventyConfig.addFilter("filterTagList", function filterTagList(tags) {
		return (tags || []).filter(
			(tag) => ["all", "nav", "post", "posts"].indexOf(tag) === -1,
		);
	});

	// Emoji color border
	eleventyConfig.addFilter("getEmojiColor", function (emoji) {
		if (!emoji) return "#f0f0f0";

		const canvas = createCanvas(16, 16);
		const ctx = canvas.getContext("2d");

		ctx.textDrawingMode = "glyph";
		ctx.font = "bold 16px Arial";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText(emoji, 8, 8);

		const imageData = ctx.getImageData(0, 0, 16, 16).data;
		let r = 0,
			g = 0,
			b = 0,
			count = 0;

		for (let i = 0; i < imageData.length; i += 4) {
			if (imageData[i + 3] > 0) {
				r += imageData[i];
				g += imageData[i + 1];
				b += imageData[i + 2];
				count++;
			}
		}

		if (count) {
			r = Math.round(r / count);
			g = Math.round(g / count);
			b = Math.round(b / count);
			return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
		}

		return "#f0f0f0";
	});

	// Add this import
	eleventyConfig.addFilter(
		"randomLetterStyles",
		function (index, totalLetters) {
			const parentHeight = 100; // We'll use a percentage for the build-time version
			const height = letterUtils.getRandomHeight(index, parentHeight);
			const rotation = letterUtils.getRandomRotate();
			const size = letterUtils.getRandomSize();
			const delay = size / 100;

			// Generate colors only once per word
			if (!this.colors || this.colors.length !== totalLetters) {
				this.colors = letterUtils.generateColors(totalLetters);
			}
			const color = this.colors[index];

			return {
				wrapper: `--random-height: ${height}%;`,
				letter: `
                        --rotation: ${rotation}deg;
                        --random-size: ${size};
                        --primary-color: ${color.primary};
                        --accent-color: ${color.accent};
                        --random-delay: ${delay}s;
                    `,
			};
		},
	);
}
