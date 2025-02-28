import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Request, Response } from "express";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Function to get dynamic character file path based on request parameter
const charactersDir = path.join(__dirname, "../../../characters");

// Function to get a dynamic character file path
const getCharacterFilePath = (characterName: string) => {
	return path.join(charactersDir, `${characterName}.character.json`);
};

// Function to get available characters dynamically
export const getCharacters = (_req: Request, res: Response) => {
	fs.readdir(charactersDir, (err, files) => {
		if (err) {
			return res
				.status(500)
				.json({ error: "Failed to read characters directory" });
		}

		const characterNames = files
			.filter((file) => file.endsWith(".character.json"))
			.map((file) => file.replace(".character.json", "")); // Remove extension

		res.json({ characters: characterNames });
	});
};

// Function to read character JSON file
const readCharacterFile = (characterName: string) => {
	try {
		const characterFilePath = getCharacterFilePath(characterName);
		console.log("Checking existence of:", characterFilePath);

		if (!fs.existsSync(characterFilePath)) {
			console.error(`❌ Character file NOT found at: ${characterFilePath}`);
			return null;
		}

		const data = fs.readFileSync(characterFilePath, "utf8");
		console.log("✅ Character file read successfully:", characterFilePath);
		return JSON.parse(data);
	} catch (error) {
		console.error("❌ Error reading character file:", error);
		return null;
	}
};

// Function to write character JSON file
const writeCharacterFile = (characterName: string, data: object) => {
	try {
		const characterFilePath = getCharacterFilePath(characterName);
		fs.writeFileSync(characterFilePath, JSON.stringify(data, null, 2), "utf8");
	} catch (error) {
		console.error("❌ Error writing to character file:", error);
	}
};

/** ========================== Templates API ========================== **/
export const getTemplates = (req: Request, res: Response) => {
	const { characterName } = req.params;
	const characterData = readCharacterFile(characterName);

	if (!characterData) {
		return res
			.status(404)
			.json({ message: `Character ${characterName} not found` });
	}

	return res.json({ templates: characterData.templates || {} });
};

export const addTemplate = (req: Request, res: Response) => {
	const { characterName } = req.params;
	const { templateName, content } = req.body;

	if (!templateName || !content) {
		return res
			.status(400)
			.json({ message: "Template name and content are required" });
	}

	const characterData = readCharacterFile(characterName);

	console.log("characterData", characterData);

	if (!characterData) {
		return res
			.status(404)
			.json({ message: `Character ${characterName} not found` });
	}

	characterData.templates = characterData.templates || {};
	characterData.templates[templateName] = content;

	writeCharacterFile(characterName, characterData);
	return res.status(201).json({
		message: "Template added successfully",
		templates: characterData.templates,
	});
};

export const updateTemplate = (req: Request, res: Response) => {
	const { characterName } = req.params;
	const { templateName, content } = req.body;

	if (!templateName || !content) {
		return res
			.status(400)
			.json({ message: "Template name and content are required" });
	}

	const characterData = readCharacterFile(characterName);
	if (!characterData) {
		return res
			.status(404)
			.json({ message: `Character ${characterName} not found` });
	}

	if (!characterData.templates || !characterData.templates[templateName]) {
		return res.status(404).json({ message: "Template not found" });
	}

	characterData.templates[templateName] = content;
	writeCharacterFile(characterName, characterData);
	return res.json({
		message: "Template updated successfully",
		templates: characterData.templates,
	});
};

export const deleteTemplate = (req: Request, res: Response) => {
	const { characterName, templateName } = req.params;

	const characterData = readCharacterFile(characterName);
	if (!characterData) {
		return res
			.status(404)
			.json({ message: `Character ${characterName} not found` });
	}

	if (!characterData.templates || !characterData.templates[templateName]) {
		return res.status(404).json({ message: "Template not found" });
	}

	delete characterData.templates[templateName];
	writeCharacterFile(characterName, characterData);
	return res.json({
		message: "Template deleted successfully",
		templates: characterData.templates,
	});
};

/** ========================== Batch Update API ========================== **/
export const batchUpdateCharacterData = (req: Request, res: Response) => {
	console.log("req.body", req.body);

	const { characterName } = req.params;
	const { templates, lore, bio, knowledge } = req.body;

	const characterData = readCharacterFile(characterName);
	if (!characterData) {
		return res
			.status(404)
			.json({ message: `Character ${characterName} not found` });
	}

	let updated = false;

	if (templates && Object.keys(templates).length > 0) {
		characterData.templates = { ...characterData.templates, ...templates };
		updated = true;
	}

	if (lore && Array.isArray(lore) && lore.length > 0) {
		characterData.lore = [...characterData.lore, ...lore];
		updated = true;
	}

	if (bio && Array.isArray(bio) && bio.length > 0) {
		characterData.bio = [...characterData.bio, ...bio];
		updated = true;
	}

	if (knowledge && Array.isArray(knowledge) && knowledge.length > 0) {
		characterData.knowledge = [...characterData.knowledge, ...knowledge];
		updated = true;
	}

	if (updated) {
		writeCharacterFile(characterName, characterData);
		return res.json({
			message: "Character data updated successfully",
			updatedFields: { templates, lore, bio, knowledge },
		});
	}

	return res.status(400).json({ message: "No valid updates provided" });
};

export const getCharacterData = (req: Request, res: Response) => {
	const { characterName } = req.params;
	console.log("🟢 Extracted characterName:", characterName); // Debug log

	// Read character file
	const characterData = readCharacterFile(characterName);
	if (!characterData) {
		return res
			.status(404)
			.json({ message: `❌ Character '${characterName}' not found` });
	}

	// Extract relevant data
	const { templates, lore, bio, knowledge } = characterData;

	return res.json({
		message: "✅ Character data retrieved successfully",
		data: { templates, lore, bio, knowledge },
	});
};

export const updateCharacterArrayElement = (req: Request, res: Response) => {
	const { characterName, arrayName, index } = req.params;
	const { newText } = req.body;

	// Validate required fields
	console.log(
		"requesttt",
		characterName,
		arrayName,
		typeof newText,
		typeof index,
	);
	if (!arrayName || typeof newText !== "string") {
		return res.status(400).json({
			message: "Please provide 'arrayName', 'newText', and a numeric 'index'.",
		});
	}

	// Read character file
	const characterData = readCharacterFile(characterName);
	if (!characterData) {
		return res
			.status(404)
			.json({ message: `Character ${characterName} not found` });
	}

	// Ensure the specified field exists and is an array
	if (!Array.isArray(characterData[arrayName])) {
		return res.status(400).json({
			message: `'${arrayName}' is not a valid array field in character data.`,
		});
	}
	// Validate index range
	if (
		Number.parseInt(index) < 0 ||
		Number.parseInt(index) >= characterData[arrayName].length
	) {
		return res.status(400).json({
			message: "Invalid index provided for the specified array.",
		});
	}

	// Update the element
	characterData[arrayName][index] = newText;
	writeCharacterFile(characterName, characterData);

	return res.json({
		message: "Array element updated successfully",
		updatedArray: characterData[arrayName],
	});
};

export const deleteCharacterArrayElement = (req: Request, res: Response) => {
	const { characterName, arrayName, index } = req.params;
	const indexNumber = Number.parseInt(index, 10);

	// Validate the index is a number
	if (Number.isNaN(indexNumber)) {
		return res.status(400).json({
			message: "The provided index is not a valid number.",
		});
	}

	// Read character file
	const characterData = readCharacterFile(characterName);
	if (!characterData) {
		return res
			.status(404)
			.json({ message: `Character ${characterName} not found` });
	}

	// Ensure the specified field exists and is an array
	if (!Array.isArray(characterData[arrayName])) {
		return res.status(400).json({
			message: `'${arrayName}' is not a valid array field in character data.`,
		});
	}

	// Validate index range
	if (indexNumber < 0 || indexNumber >= characterData[arrayName].length) {
		return res.status(400).json({
			message: "Invalid index provided for the specified array.",
		});
	}

	// Remove the element at the specified index
	const removedElement = characterData[arrayName].splice(indexNumber, 1);
	writeCharacterFile(characterName, characterData);

	return res.json({
		message: "Array element deleted successfully",
		updatedArray: characterData[arrayName],
		removedElement, // Optional: returns the removed element(s)
	});
};
