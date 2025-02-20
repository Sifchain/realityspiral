import { useEffect } from "react";
import { motion } from "framer-motion";
import { use } from "./hooks";

function TemplateManager() {
    const {
		fetchCharacters,
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
    } = use();

    useEffect(() => {
		fetchCharacters();
    }, [character]);

    return (
        <div className="p-10 to-black min-h-screen text-white flex flex-col items-center w-full">
            <motion.h2
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-4xl font-extrabold text-center mb-8 text-white drop-shadow-md"
            >
                Template Manager
            </motion.h2>

            <div className="w-full max-w-4xl">
                {/* Character Selector */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mb-6 bg-gray-800 p-4 rounded-lg shadow-lg relative"
                >
                    <label className="block text-sm font-semibold mb-2 text-gray-300">
                        Select Character
                    </label>
                    <div className="relative">
					<select
    value={character}
    onChange={(e) => setCharacter(e.target.value)}
    className="p-3 rounded-lg text-white border border-gray-600 w-full shadow-md transition hover:bg-gray-600 focus:ring focus:ring-blue-500 appearance-none cursor-pointer"
>
    {characters.length > 0 ? (
        characters.map((char) => (
            <option
                key={char}
                value={char}
                className="bg-gray-800 text-white p-2 hover:bg-gray-700 cursor-pointer"
            >
                {char.toUpperCase()}
            </option>
        ))
    ) : (
        <option value="" disabled>
            Loading...
        </option>
    )}
</select>

                        <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-400">
                            ▼
                        </div>
                    </div>
                </motion.div>

                {/* Add Template Section */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="mb-6 p-6 rounded-lg shadow-lg bg-gray-800 border border-gray-700"
                >
                    <h3 className="text-lg font-semibold mb-3 text-blue-300">
                        ➕ Add New Template
                    </h3>
                    <input
                        type="text"
                        placeholder="Template Name"
                        value={newTemplateName}
                        onChange={(e) => setNewTemplateName(e.target.value)}
                        className="w-full p-3 mb-3 rounded-lg text-white border border-gray-600 shadow-sm focus:ring focus:ring-blue-500"
                    />
                    <textarea
                        placeholder="Template Content"
                        value={newTemplateContent}
                        onChange={(e) => setNewTemplateContent(e.target.value)}
                        className="w-full p-3 mb-3 rounded-lg text-white border border-gray-600 shadow-sm focus:ring focus:ring-blue-500"
                        rows={3}
                    />
                    <button
                        onClick={addTemplate}
                        className="w-full py-3 border border-green-600 text-green-600 rounded-lg shadow-md transition font-semibold"
                    >
                        Add Template
                    </button>
                </motion.div>

                {/* Templates List */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-6 rounded-lg shadow-lg bg-gray-800 border border-gray-700"
                >
                    <h3 className="text-lg font-semibold mb-3 text-blue-300">
                        Available Templates
                    </h3>
                    {Object.keys(templates).length > 0 ? (
                        <ul>
                            {Object.entries(templates).map(
                                ([name, content]) => (
                                    <li
                                        key={name}
                                        className="mb-4 p-4 bg-[#161616] rounded-lg flex justify-between items-center shadow-md border border-gray-700 transition hover:bg-gray-700"
                                    >
                                        <div>
                                            <p className="text-sm font-bold text-gray-200">
                                                {name}
                                            </p>
                                            <p className="text-xs text-gray-400 truncate max-w-md">
                                                {content}
                                            </p>
                                        </div>
                                        <div className="space-x-2">
                                            {/* Edit button sets selected template & content */}
                                            <button
                                                onClick={() => {
                                                    setSelectedTemplate(name);
                                                    setUpdatedTemplateContent(
                                                        content
                                                    );
                                                }}
                                                className="px-4 py-2 text-blue-200 border border-blue-300 rounded-md text-xs font-semibold"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() =>
                                                    deleteTemplate(name)
                                                }
                                                className="px-4 py-2 text-red-500 border border-red-600 rounded-md text-xs font-semibold"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </li>
                                )
                            )}
                        </ul>
                    ) : (
                        <p className="text-sm text-gray-400">
                            No templates available.
                        </p>
                    )}
                </motion.div>

                {/* Edit Template Section (only visible if a template is selected) */}
                {selectedTemplate && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-6 mt-6 rounded-lg shadow-lg bg-gray-800 border border-gray-700"
                    >
                        <h3 className="text-lg font-semibold mb-3 text-blue-300">
                            Edit Template: {selectedTemplate}
                        </h3>
                        <textarea
                            value={updatedTemplateContent}
                            onChange={(e) =>
                                setUpdatedTemplateContent(e.target.value)
                            }
                            className="w-full p-3 mb-3 rounded-lg text-white border border-gray-600 shadow-sm focus:ring focus:ring-blue-500"
                            rows={3}
                        />
                        <div className="flex justify-end space-x-2">
                            <button
                                onClick={() => {
                                    // Call your update logic
                                    updateTemplate(
                                        selectedTemplate,
                                        updatedTemplateContent
                                    );
                                    // Clear the edit state after saving
                                    setSelectedTemplate(null);
                                }}
                                className="px-4 py-2 text-blue-200 border border-blue-300 rounded-md text-xs hover:bg-blue-600 font-semibold"
                            >
                                Save
                            </button>
                            <button
                                onClick={() => {
                                    // Cancel editing
                                    setSelectedTemplate(null);
                                    setUpdatedTemplateContent("");
                                }}
                                className="px-4 py-2 border border-gray-400 text-white rounded-md text-xs hover:bg-gray-700 font-semibold"
                            >
                                Cancel
                            </button>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
}

export default TemplateManager;
