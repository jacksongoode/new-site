// Function to prefetch a URL
function prefetch(url) {
	const link = document.createElement("link");
	link.rel = "prefetch";
	link.href = url;
	document.head.appendChild(link);
}

// Set to keep track of prefetched URLs
const prefetchedUrls = new Set();

// Function to handle mouse enter event
function handleMouseEnter(event) {
	const link = event.target.closest("a");
	if (link && link.href && !prefetchedUrls.has(link.href)) {
		// Small delay to avoid prefetching on accidental hovers
		setTimeout(() => {
			if (link.matches(":hover")) {
				prefetch(link.href);
				prefetchedUrls.add(link.href);
			}
		}, 100);
	}
}

// Add event listener to the document
document.addEventListener("mouseover", handleMouseEnter);
