import { useState } from "react";

export const use = () => {
	const API_BASE_URL = `${import.meta.env.VITE_SERVER_URL}/templates`;

	const [lore, setLore] = useState("");
	const [bio, setBio] = useState("");
	const [knowledge, setKnowledge] = useState("");

	const [characters, setCharacters] = useState<string[]>([]);
	const [character, setCharacter] = useState("prosper");
	const [templates, setTemplates] = useState<{ [key: string]: string }>({});
	const [newTemplateName, setNewTemplateName] = useState("");
	const [newTemplateContent, setNewTemplateContent] = useState("");
	const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
	const [updatedTemplateContent, setUpdatedTemplateContent] = useState("");

	const updateCharacterData = async () => {
		if (!character.trim()) {
			alert("Character name is required.");
			return;
		}

		if (!newTemplateName.trim() || !newTemplateContent.trim()) {
			alert("Template name and content are required.");
			return;
		}

		// Merging new template into existing ones
		const updatedTemplates = {
			...templates,
			[newTemplateName]: newTemplateContent, // Adding new template
		};

		try {
			const requestBody = {
				templates: updatedTemplates, // Includes all templates
				lore: lore ? [lore] : [], // Ensures it's an array
				bio: bio ? [bio] : [],
				knowledge: knowledge ? [knowledge] : [],
			};

			const res = await fetch(`${API_BASE_URL}/${character}/batch-update`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(requestBody),
			});

			if (!res.ok) {
				throw new Error(`HTTP error! Status: ${res.status}`);
			}

			const data = await res.json();
			alert("✅ Character updated successfully!");
			console.log("✅ Character updated:", data);

			// Update state after successful update
			setTemplates(updatedTemplates);
			setNewTemplateName(""); // Reset template name input
			setNewTemplateContent(""); // Reset template content input
		} catch (error) {
			if (error instanceof Error) {
				console.error("❌ Error updating character:", error);
				alert(`Error: ${error.message}`);
			} else {
				console.error("❌ Error updating character:", error);
				alert("An unknown error occurred.");
			}
		}
	};

	const fetchCharacters = async () => {
		try {
			const response = await fetch(`${API_BASE_URL}/characters`);
			const data = await response.json();
			setCharacters(data.characters || []);
			fetchTemplates();
		} catch (error) {
			console.error("❌ Error fetching characters:", error);
		}
	};

	const fetchTemplates = async () => {
		try {
			const response = await fetch(`${API_BASE_URL}/${character}`);
			const data = await response.json();
			setTemplates(data.templates || {});
		} catch (error) {
			console.error("❌ Error fetching templates:", error);
		}
	};

	const addTemplate = async () => {
		if (!newTemplateName || !newTemplateContent) {
			alert("Template name and content are required.");
			return;
		}

		try {
			const response = await fetch(`${API_BASE_URL}/${character}`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					templateName: newTemplateName,
					content: newTemplateContent,
				}),
			});

			if (response.ok) {
				alert("✅ Template added successfully!");
				setNewTemplateName("");
				setNewTemplateContent("");
				fetchTemplates();
			} else {
				alert("❌ Error adding template.");
			}
		} catch (error) {
			console.error("❌ Error adding template:", error);
		}
	};

	const updateTemplate = async (
		selectedTemplate?: string,
		updatedTemplateContent?: string,
	) => {
		if (!selectedTemplate || !updatedTemplateContent) {
			alert("Please select a template and provide updated content.");
			return;
		}

		try {
			const response = await fetch(`${API_BASE_URL}/${character}`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					templateName: selectedTemplate,
					content: updatedTemplateContent,
				}),
			});

			if (response.ok) {
				alert("✅ Template updated successfully!");
				setSelectedTemplate(null);
				setUpdatedTemplateContent("");
				fetchTemplates();
			} else {
				alert("❌ Error updating template.");
			}
		} catch (error) {
			console.error("❌ Error updating template:", error);
		}
	};

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
				alert("✅ Template deleted successfully!");
				fetchTemplates();
			} else {
				alert("❌ Error deleting template.");
			}
		} catch (error) {
			console.error("❌ Error deleting template:", error);
		}
	};

	return {
		lore,
		setLore,
		bio,
		setBio,
		knowledge,
		setKnowledge,
		updateCharacterData,

		fetchCharacters,
		fetchTemplates,
		addTemplate,
		updateTemplate,
		deleteTemplate,
		templates,
		newTemplateName,
		newTemplateContent,
		character,
		setCharacter,
		characters,
		selectedTemplate,
		setSelectedTemplate,
		updatedTemplateContent,
		setUpdatedTemplateContent,
		setNewTemplateName,
		setNewTemplateContent,
	};
};
