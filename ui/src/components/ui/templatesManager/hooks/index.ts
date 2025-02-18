import { useState } from "react";

export const use = () => {
    const API_BASE_URL = "http://localhost:3000/templates";

    const [character, setCharacter] = useState("prosper");
    const [templates, setTemplates] = useState<{ [key: string]: string }>({});
    const [newTemplateName, setNewTemplateName] = useState("");
    const [newTemplateContent, setNewTemplateContent] = useState("");
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(
        null
    );
    const [updatedTemplateContent, setUpdatedTemplateContent] = useState("");

    const fetchTemplates = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/${character}`,{
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            });
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
        updatedTemplateContent?: string
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
            `Are you sure you want to delete the template "${templateName}"?`
        );
        if (!confirmDelete) return;

        try {
            const response = await fetch(
                `${API_BASE_URL}/${character}/${templateName}`,
                {
                    method: "DELETE",
                }
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
        fetchTemplates,
        addTemplate,
        updateTemplate,
        deleteTemplate,
        templates,
        newTemplateName,
        newTemplateContent,
        character,
        setCharacter,
        selectedTemplate,
        setSelectedTemplate,
        updatedTemplateContent,
        setUpdatedTemplateContent,
        setNewTemplateName,
        setNewTemplateContent,
    };
};
