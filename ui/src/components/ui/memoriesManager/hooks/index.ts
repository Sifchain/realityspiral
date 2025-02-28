import { useEffect, useState } from "react";

export const use = () => {
	const API_BASE_URL = `${import.meta.env.VITE_SERVER_URL}/templates`;

	const [lore, setLore] = useState<string[]>([]);
	const [bio, setBio] = useState<string[]>([]);
	const [knowledge, setKnowledge] = useState<string[]>([]);
	const [templates, setTemplates] = useState<{ [key: string]: string }>({});

	const [newLore, setNewLore] = useState<string>("");
	const [newBio, setNewBio] = useState<string>("");
	const [newknowledge, setNewKnowledge] = useState<string>("");
	const [newTemplateName, setNewTemplateName] = useState("");
	const [newTemplateContent, setNewTemplateContent] = useState("");

	const [characters, setCharacters] = useState<string[]>([]);
	const [character, setCharacter] = useState("prosper");
	const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
	const [updatedTemplateContent, setUpdatedTemplateContent] = useState("");

	const [editingBioIndex, setEditingBioIndex] = useState<number | null>(null);
	const [editedBio, setEditedBio] = useState<string>("");

	const [editingLoreIndex, setEditingLoreIndex] = useState<number | null>(null);
	const [editedLore, setEditedLore] = useState<string>("");

	const [editingKnowledgeIndex, setEditingKnowledgeIndex] = useState<
		number | null
	>(null);
	const [editedKnowledge, setEditedKnowledge] = useState<string>("");

	// 1️⃣ Fetch Character Data
	const fetchCharacterData = async () => {
		if (!character.trim()) return;

		try {
			const res = await fetch(`${API_BASE_URL}/${character}/batch-get`);
			if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
			const data = await res.json();
			setLore(data.data.lore || []);
			setBio(data.data.bio || []);
			setKnowledge(data.data.knowledge || []);
			setTemplates(data.data.templates || {});
		} catch (error: any) {
			console.error("❌ Error fetching character data:", error);
		}
	};

	// 2️⃣ Batch Update Character Data
	const updateCharacterData = async () => {
		if (!character.trim()) {
			alert("Character name is required.");
			return;
		}

		if (
			(newTemplateName.trim() === "" && newTemplateContent.trim() !== "") ||
			(newTemplateName.trim() !== "" && newTemplateContent.trim() === "")
		) {
			alert("Template name and content are required.");
			return;
		}

		const updatedTemplates = {
			...templates,
			[newTemplateName]: newTemplateContent,
		};

		try {
			const requestBody = {
				// Conditionally include the templates property if newTemplateName is non-empty.
				...(newTemplateName.trim() ? { templates: updatedTemplates } : {}),
				lore: newLore ? [newLore] : [],
				bio: newBio ? [newBio] : [],
				knowledge: newknowledge ? [newknowledge] : [],
			};

			const res = await fetch(`${API_BASE_URL}/${character}/batch-update`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(requestBody),
			});

			if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);

			alert("Character updated successfully!");
			setTemplates(updatedTemplates);
			fetchCharacterData();
			resetFormFields();
		} catch (error: any) {
			console.error("❌ Error updating character:", error);
			alert(`Error: ${error.message}`);
		}
	};

	// 3️⃣ Fetch Available Characters
	const fetchCharacters = async () => {
		try {
			const res = await fetch(`${API_BASE_URL}/characters`);
			const data = await res.json();
			setCharacters(data.characters || []);
		} catch (error) {
			console.error("❌ Error fetching characters:", error);
		}
	};

	// 4️⃣ Delete a Template
	const deleteTemplate = async (templateName: string) => {
		const confirmDelete = window.confirm(
			`Are you sure you want to delete the template "${templateName}"?`,
		);
		if (!confirmDelete) return;

		try {
			const response = await fetch(
				`${API_BASE_URL}/${character}/${templateName}`,
				{
					method: "DELETE",
				},
			);

			if (response.ok) {
				alert("Template deleted successfully!");
				fetchCharacterData();
			} else {
				alert("❌ Error deleting template.");
			}
		} catch (error) {
			console.error("❌ Error deleting template:", error);
		}
	};

	// 5️⃣ Delete an Element from a Character Array
	const deleteArrayElement = async (arrayName: string, index: number) => {
		const confirmDelete = window.confirm(
			`Are you sure you want to delete the element at index ${index} from ${arrayName}?`,
		);
		if (!confirmDelete) return;

		try {
			const response = await fetch(
				`${API_BASE_URL}/${character}/array-delete/${arrayName}/${index}`,
				{
					method: "DELETE",
				},
			);

			if (response.ok) {
				alert("Element deleted successfully!");
				fetchCharacterData();
			} else {
				alert("❌ Error deleting element.");
			}
		} catch (error) {
			console.error("❌ Error deleting element:", error);
		}
	};

	// 6️⃣ Update an Element in a Character Array (Edit)
	const updateArrayElement = async (
		arrayName: string,
		index: number,
		newText: string,
	) => {
		try {
			const response = await fetch(
				`${API_BASE_URL}/${character}/array-update/${arrayName}/${index}`,
				{
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ newText }),
				},
			);

			if (!response.ok) {
				throw new Error(`HTTP error! Status: ${response.status}`);
			}

			alert("Array element updated successfully!");
			// Refresh data
			fetchCharacterData();
		} catch (error: any) {
			console.error("❌ Error updating array element:", error);
			alert(`Error: ${error.message}`);
		}
	};

	const resetFormFields = () => {
		setNewTemplateName("");
		setNewTemplateContent("");
		setNewLore("");
		setNewBio("");
		setNewKnowledge("");
		setSelectedTemplate(null);
		setUpdatedTemplateContent("");
		setEditingLoreIndex(null);
		setEditedLore("");
		setEditingBioIndex(null);
		setEditedBio("");
		setEditingKnowledgeIndex(null);
		setEditedKnowledge("");
	};

	// 7️⃣ Auto-fetch character data when `character` changes
	useEffect(() => {
		fetchCharacterData();
	}, [character]);

	return {
		// Arrays
		lore,
		setLore,
		bio,
		setBio,
		knowledge,
		setKnowledge,
		templates,

		// Form fields
		newLore,
		setNewLore,
		newBio,
		setNewBio,
		newknowledge,
		setNewKnowledge,

		// Characters & selected character
		characters,
		character,
		setCharacter,

		// Templates
		newTemplateName,
		setNewTemplateName,
		newTemplateContent,
		setNewTemplateContent,
		selectedTemplate,
		setSelectedTemplate,
		updatedTemplateContent,
		setUpdatedTemplateContent,

		// API methods
		fetchCharacters,
		updateCharacterData,
		deleteTemplate,
		deleteArrayElement,
		updateArrayElement,

		editingBioIndex,
		setEditingBioIndex,
		editedBio,
		setEditedBio,
		editingLoreIndex,
		setEditingLoreIndex,
		editedLore,
		setEditedLore,
		editingKnowledgeIndex,
		setEditingKnowledgeIndex,
		editedKnowledge,
		setEditedKnowledge,
	};
};
