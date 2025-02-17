const fs = require("node:fs/promises");
const path = require("node:path");

// Base directory for docs
const DOCS_DIR = __dirname;
const SIDEBAR_PATH = path.join(DOCS_DIR, "_sidebar.md");

// Capitalize all words in a string and replace underscores with spaces
function formatFolderName(str) {
	return str
		.replace(/_/g, " ") // Replace underscores with spaces
		.split(" ") // Split by spaces
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // Capitalize each word
		.join(" "); // Join the words back with spaces
}

// Extract H1 from markdown file
function extractTitle(filePath) {
	const content = fs.readFileSync(filePath, "utf8");
	const match = content.match(/^#\s+(.+)/m);
	return match ? match[1].trim() : path.basename(filePath, ".md");
}

// Recursively build sidebar content
async function generateSidebar(dir, prefix = "") {
	const files = await fs.readdir(dir).sort();
	let content = "";

	for (const file of files) {
		const fullPath = path.join(dir, file);
		const _relativePath = path.relative(DOCS_DIR, fullPath);
		const stat = await fs.stat(fullPath);

		// Exclude files and folders starting with '_' or named 'assets'
		if (file.startsWith("_") || file === "_assets") {
			continue;
		}

		if (stat.isDirectory()) {
			const sectionName = formatFolderName(file);
			// Add the folder name as plain text, not a link
			content += `* ${sectionName}\n`;
			content += generateSidebar(fullPath, `${prefix}${file}/`);
		} else if (file.endsWith(".md")) {
			const title = extractTitle(fullPath);
			content += `  * [${title}](${prefix}${file})\n`;
		}
	}

	return content;
}

// Main function to generate sidebar
async function buildSidebar() {
	let sidebarContent = "* [Home](/)\n";
	sidebarContent += await generateSidebar(DOCS_DIR);
	await fs.writeFile(SIDEBAR_PATH, sidebarContent);
	console.log("Sidebar generated successfully!");
}

buildSidebar();
