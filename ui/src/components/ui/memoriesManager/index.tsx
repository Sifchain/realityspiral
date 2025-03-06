import { motion } from "framer-motion";
import { Save, SquarePen, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { use } from "./hooks";

function MemoryManager() {
	const {
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
		setSelectedTemplate,
		setUpdatedTemplateContent,

		// API methods
		fetchCharacters,
		updateCharacterData,
		deleteTemplate,
		deleteArrayElement,
		updateArrayElement,

		// Editing states for each memory type
		editingLoreIndex,
		setEditingLoreIndex,
		editedLore,
		setEditedLore,
		editingBioIndex,
		setEditingBioIndex,
		editedBio,
		setEditedBio,
		editingKnowledgeIndex,
		setEditingKnowledgeIndex,
		editedKnowledge,
		setEditedKnowledge,
	} = use();

	// Tab state to switch between Templates, Lore, Bio, and Knowledge
	const [activeTab, setActiveTab] = useState("templates");

	// Fetch characters on change
	useEffect(() => {
		fetchCharacters();
	}, [character]);

	return (
		<div className="min-h-screen from-gray-900 to-black p-10 text-white">
			<motion.h2
				initial={{ opacity: 0, y: -20 }}
				animate={{ opacity: 1, y: 0 }}
				className="text-5xl font-bold mb-8 text-center drop-shadow-lg"
			>
				Template Manager
			</motion.h2>

			<div className="flex flex-col md:flex-row gap-6">
				{/* Left Column: Character Selector and Add Memory Form */}
				<div className="md:w-1/3 space-y-6">
					{/* Character Selector */}
					<motion.div className="bg-[#1d1d1d] p-6 rounded-lg shadow-xl relative ">
						<label className="block text-lg font-semibold text-gray-300 mb-2">
							Select Character
						</label>
						<div className="relative">
							<select
								value={character}
								onChange={(e) => setCharacter(e.target.value)}
								className="w-full p-3 rounded-lg text-white border border-gray-600 transition hover:bg-sidebar-accent appearance-none cursor-pointer"
							>
								{characters.length > 0 ? (
									characters.map((char) => (
										<option key={char} value={char} className="bg-gray-800">
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

					{/* Add Memory Form */}
					<motion.div className="bg-[#1d1d1d] p-6 rounded-lg shadow-xl">
						<h3 className="text-xl font-semibold text-gray-300 mb-4">
							➕ Add New Memory
						</h3>
						<input
							type="text"
							placeholder="Template Name"
							value={newTemplateName}
							onChange={(e) => setNewTemplateName(e.target.value)}
							className="w-full p-3 mb-4 rounded-lg text-white border border-gray-600 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 hover:bg-sidebar-accent"
						/>
						<textarea
							placeholder="Template Content"
							value={newTemplateContent}
							onChange={(e) => setNewTemplateContent(e.target.value)}
							className="w-full p-3 mb-4 rounded-lg hover:bg-sidebar-accent text-white border border-gray-600 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
							rows={3}
						/>
						<textarea
							placeholder="Lore"
							value={newLore}
							onChange={(e) => setNewLore(e.target.value)}
							className="w-full p-3 mb-4 rounded-lg hover:bg-sidebar-accent text-white border border-gray-600 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
							rows={3}
						/>
						<textarea
							placeholder="Bio"
							value={newBio}
							onChange={(e) => setNewBio(e.target.value)}
							className="w-full p-3 mb-4 rounded-lg hover:bg-sidebar-accent text-white border border-gray-600 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
							rows={3}
						/>
						<textarea
							placeholder="Knowledge"
							value={newknowledge}
							onChange={(e) => setNewKnowledge(e.target.value)}
							className="w-full p-3 mb-4 rounded-lg hover:bg-sidebar-accent text-white border border-gray-600 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
							rows={3}
						/>
						<button
							onClick={updateCharacterData}
							className="w-full py-3 bg-green-600 text-white rounded-lg shadow-md transition hover:bg-green-500 font-semibold"
						>
							Add Memory
						</button>
					</motion.div>
				</div>

				{/* Right Column: Tabbed Content */}
				<div className="md:w-2/3 space-y-6">
					{/* Tab Navigation */}
					<div className="flex space-x-4 mb-4">
						<button
							onClick={() => setActiveTab("templates")}
							className={`px-4 py-2 rounded-lg transition ${
								activeTab === "templates"
									? "border border-blue-200"
									: "bg-[#1d1d1d] hover:bg-gray-600"
							}`}
						>
							Templates
						</button>
						<button
							onClick={() => setActiveTab("lore")}
							className={`px-4 py-2 rounded-lg transition ${
								activeTab === "lore"
									? "border border-blue-200"
									: "bg-[#1d1d1d] hover:bg-gray-600"
							}`}
						>
							Lore
						</button>
						<button
							onClick={() => setActiveTab("bio")}
							className={`px-4 py-2 rounded-lg transition ${
								activeTab === "bio"
									? "border border-blue-200"
									: "bg-[#1d1d1d] hover:bg-gray-600"
							}`}
						>
							Bio
						</button>
						<button
							onClick={() => setActiveTab("knowledge")}
							className={`px-4 py-2 rounded-lg transition ${
								activeTab === "knowledge"
									? "border border-blue-200"
									: "bg-[#1d1d1d] hover:bg-gray-600"
							}`}
						>
							Knowledge
						</button>
					</div>

					{/* Tab Content */}
					{activeTab === "templates" && (
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							className="bg-[#1d1d1d] p-6 rounded-lg shadow-xl"
						>
							<h3 className="text-xl font-semibold text-gray-300 mb-4">
								Available Templates
							</h3>
							{Object.keys(templates).length > 0 ? (
								<ul className="space-y-4">
									{Object.entries(templates).map(([name, content]) => (
										<li
											key={name}
											className="p-4 rounded-lg bg-[#121212] flex justify-between items-center shadow-md border border-gray-600 transition hover:bg-sidebar-accent"
										>
											<div>
												<p className="text-lg font-bold text-gray-200">
													{name}
												</p>
												<p className="text-sm text-gray-400 truncate max-w-md">
													{content}
												</p>
											</div>
											<div className="space-x-3">
												<button
													onClick={() => {
														setSelectedTemplate(name);
														setUpdatedTemplateContent(content);
													}}
													className="p-2 text-blue-200 border border-blue-200 rounded hover:text-blue-200 transition"
													title="Edit Template"
												>
													<SquarePen className="w-5 h-5" />
												</button>
												<button
													onClick={() => deleteTemplate(name)}
													className="p-2 text-red-400 border border-red-400 rounded hover:text-red-600 transition"
													title="Delete Template"
												>
													<Trash2 className="w-5 h-5" />
												</button>
											</div>
										</li>
									))}
								</ul>
							) : (
								<p className="text-sm text-gray-400">No templates available.</p>
							)}
						</motion.div>
					)}

					{activeTab === "lore" && (
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							className="bg-[#1d1d1d] p-6 rounded-lg shadow-xl"
						>
							<h3 className="text-xl font-semibold text-gray-300 mb-4">
								Available Lore
							</h3>
							<div className="bg-[#121212] p-5 rounded-lg shadow-md border border-gray-600 transition hover:bg-sidebar-accent">
								{lore.length > 0 ? (
									<ul className="space-y-4">
										{lore.map((content, index) => (
											<li key={index} className="group relative">
												{editingLoreIndex === index ? (
													<textarea
														value={editedLore}
														onChange={(e) => setEditedLore(e.target.value)}
														className="w-full p-2 rounded-lg bg-gray-600 text-white border border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 whitespace-pre-wrap text-sm"
													/>
												) : (
													<textarea
														value={content}
														disabled
														className="w-full p-2 bg-transparent text-white border-none focus:outline-none whitespace-pre-wrap text-sm"
													/>
												)}
												<div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex space-x-2 opacity-0 group-hover:opacity-100 transition duration-200">
													{editingLoreIndex === index ? (
														<>
															<button
																onClick={() => {
																	updateArrayElement("lore", index, editedLore);
																	const updatedLore = [...lore];
																	updatedLore[index] = editedLore;
																	setLore(updatedLore);
																	setEditingLoreIndex(null);
																}}
																className="text-green-400 hover:text-green-600 mb-24"
																title="Update Lore"
															>
																<Save className="w-5 h-5" />
															</button>
															<button
																onClick={() => setEditingLoreIndex(null)}
																className="text-red-400 hover:text-red-600 mb-24"
																title="Cancel"
															>
																<X className="w-5 h-5" />
															</button>
														</>
													) : (
														<>
															<button
																onClick={() => {
																	setEditingLoreIndex(index);
																	setEditedLore(content);
																}}
																className=" hover:text-blue-600 mt-5"
																title="Edit Lore"
															>
																<SquarePen className="w-5 h-5" />
															</button>
															<button
																onClick={() =>
																	deleteArrayElement("lore", index)
																}
																className=" text-red-400 hover:text-red-600 mt-5"
																title="Delete Lore"
															>
																<Trash2 className="w-5 h-5" />
															</button>
														</>
													)}
												</div>
											</li>
										))}
									</ul>
								) : (
									<p className="text-sm text-gray-400">No lore available.</p>
								)}
							</div>
						</motion.div>
					)}

					{activeTab === "bio" && (
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							className="bg-[#1d1d1d] p-6 rounded-lg shadow-xl"
						>
							<h3 className="text-xl font-semibold text-gray-300 mb-4">
								Available Bio
							</h3>
							<div className="bg-[#121212] p-5 rounded-lg shadow-md border border-gray-600 transition hover:bg-sidebar-accent">
								{bio.length > 0 ? (
									<ul className="space-y-4">
										{bio.map((content, index) => (
											<li key={index} className="group relative">
												{editingBioIndex === index ? (
													<textarea
														value={editedBio}
														onChange={(e) => setEditedBio(e.target.value)}
														className="w-full p-2 rounded-lg bg-gray-600 text-white border border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 whitespace-pre-wrap text-sm"
													/>
												) : (
													<textarea
														value={content}
														disabled
														className="w-full p-2 bg-transparent text-white border-none focus:outline-none whitespace-pre-wrap text-sm"
													/>
												)}
												<div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex space-x-2 opacity-0 group-hover:opacity-100 transition duration-200">
													{editingBioIndex === index ? (
														<>
															<button
																onClick={() => {
																	updateArrayElement("bio", index, editedBio);
																	const updatedBio = [...bio];
																	updatedBio[index] = editedBio;
																	setBio(updatedBio);
																	setEditingBioIndex(null);
																}}
																className="text-green-400 hover:text-green-600 mb-24"
																title="Update Bio"
															>
																<Save className="w-5 h-5" />
															</button>
															<button
																onClick={() => setEditingBioIndex(null)}
																className="text-red-400 hover:text-red-600 mb-24"
																title="Cancel"
															>
																<X className="w-5 h-5" />
															</button>
														</>
													) : (
														<>
															<button
																onClick={() => {
																	setEditingBioIndex(index);
																	setEditedBio(content);
																}}
																className=" hover:text-blue-600 mt-5"
																title="Edit Bio"
															>
																<SquarePen className="w-5 h-5" />
															</button>
															<button
																onClick={() => deleteArrayElement("bio", index)}
																className=" text-red-400 hover:text-red-600 mt-5"
																title="Delete Bio"
															>
																<Trash2 className="w-5 h-5" />
															</button>
														</>
													)}
												</div>
											</li>
										))}
									</ul>
								) : (
									<p className="text-sm text-gray-400">No Bio available.</p>
								)}
							</div>
						</motion.div>
					)}

					{activeTab === "knowledge" && (
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							className="bg-[#1d1d1d] p-6 rounded-lg shadow-xl"
						>
							<h3 className="text-xl font-semibold text-gray-300 mb-4">
								Available Knowledge
							</h3>
							<div className="bg-[#121212] p-5 rounded-lg shadow-md border border-gray-600 transition hover:bg-sidebar-accent">
								{knowledge.length > 0 ? (
									<ul className="space-y-4">
										{knowledge.map((content, index) => (
											<li key={index} className="group relative">
												{editingKnowledgeIndex === index ? (
													<textarea
														value={editedKnowledge}
														onChange={(e) => setEditedKnowledge(e.target.value)}
														className="w-full p-2 rounded-lg bg-gray-600 text-white border border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 whitespace-pre-wrap text-sm"
													/>
												) : (
													<textarea
														value={content}
														disabled
														className="w-full p-2 bg-transparent text-white border-none focus:outline-none whitespace-pre-wrap text-sm"
													/>
												)}
												<div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex space-x-2 opacity-0 group-hover:opacity-100 transition duration-200">
													{editingKnowledgeIndex === index ? (
														<>
															<button
																onClick={() => {
																	updateArrayElement(
																		"knowledge",
																		index,
																		editedKnowledge,
																	);
																	const updatedKnowledge = [...knowledge];
																	updatedKnowledge[index] = editedKnowledge;
																	setKnowledge(updatedKnowledge);
																	setEditingKnowledgeIndex(null);
																}}
																className="text-green-400 hover:text-green-600 mb-24"
																title="Update Knowledge"
															>
																<Save className="w-5 h-5" />
															</button>
															<button
																onClick={() => setEditingKnowledgeIndex(null)}
																className="text-red-400 hover:text-red-600 mb-24"
																title="Cancel"
															>
																<X className="w-5 h-5" />
															</button>
														</>
													) : (
														<>
															<button
																onClick={() => {
																	setEditingKnowledgeIndex(index);
																	setEditedKnowledge(content);
																}}
																className=" hover:text-blue-600 mt-5"
																title="Edit Knowledge"
															>
																<SquarePen className="w-5 h-5" />
															</button>
															<button
																onClick={() =>
																	deleteArrayElement("knowledge", index)
																}
																className=" text-red-400 hover:text-red-600 mt-5"
																title="Delete Knowledge"
															>
																<Trash2 className="w-5 h-5" />
															</button>
														</>
													)}
												</div>
											</li>
										))}
									</ul>
								) : (
									<p className="text-sm text-gray-400">
										No Knowledge available.
									</p>
								)}
							</div>
						</motion.div>
					)}
				</div>
			</div>
		</div>
	);
}

export default MemoryManager;
