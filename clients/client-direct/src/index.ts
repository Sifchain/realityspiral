import * as fs from "node:fs";
import type http from "node:http";
import * as path from "node:path";
import {
	type AgentRuntime,
	type Character,
	type Client,
	type Content,
	type IAgentRuntime,
	type Media,
	type Memory,
	ModelClass,
	type State,
	elizaLogger,
	generateCaption,
	generateImage,
	generateMessageResponse,
	generateObject,
	getEmbeddingZeroVector,
	messageCompletionFooter,
	settings,
	stringToUuid,
} from "@elizaos/core";
import {
	composeContext,
	getRuntimeInstrumentation,
	Instrumentation,
} from "@realityspiral/plugin-instrumentation";
import type {
	RuntimeInstrumentation,
	RuntimeLike,
} from "@realityspiral/plugin-instrumentation";
import bodyParser from "body-parser";
import cors from "cors";
import express, { type Request as ExpressRequest } from "express";
import multer from "multer";
import OpenAI from "openai";
import { z } from "zod";
import { createApiRouter } from "./api.ts";
import { setupSwagger } from "./config/swagger.ts";
import { createVerifiableLogApiRouter } from "./verifiable-log-api.ts";

const storage = multer.diskStorage({
	destination: (_req, _file, cb) => {
		const uploadDir = path.join(process.cwd(), "data", "uploads");
		// Create the directory if it doesn't exist
		if (!fs.existsSync(uploadDir)) {
			fs.mkdirSync(uploadDir, { recursive: true });
		}
		cb(null, uploadDir);
	},
	filename: (_req, file, cb) => {
		const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
		cb(null, `${uniqueSuffix}-${file.originalname}`);
	},
});

// some people have more memory than disk.io
const upload = multer({ storage /*: multer.memoryStorage() */ });

export const messageHandlerTemplate =
	// {{goals}}
	// "# Action Examples" is already included
	`{{actionExamples}}
(Action examples are for reference only. Do not use the information from them in your response.)

# Knowledge
{{knowledge}}

# Task: Generate dialog and actions for the character {{agentName}}.
About {{agentName}}:
{{bio}}
{{lore}}

{{providers}}

{{attachments}}

# Capabilities
Note that {{agentName}} is capable of reading/seeing/hearing various forms of media, including images, videos, audio, plaintext and PDFs. Recent attachments have been included above under the "Attachments" section.

{{messageDirections}}

{{recentMessages}}

{{actions}}

# Instructions: Write the next message for {{agentName}}.
${messageCompletionFooter}`;

export const hyperfiHandlerTemplate = `{{actionExamples}}
(Action examples are for reference only. Do not use the information from them in your response.)

# Knowledge
{{knowledge}}

# Task: Generate dialog and actions for the character {{agentName}}.
About {{agentName}}:
{{bio}}
{{lore}}

{{providers}}

{{attachments}}

# Capabilities
Note that {{agentName}} is capable of reading/seeing/hearing various forms of media, including images, videos, audio, plaintext and PDFs. Recent attachments have been included above under the "Attachments" section.

{{messageDirections}}

{{recentMessages}}

{{actions}}

# Instructions: Write the next message for {{agentName}}.

Response format should be formatted in a JSON block like this:
\`\`\`json
{ "lookAt": "{{nearby}}" or null, "emote": "{{emotes}}" or null, "say": "string" or null, "actions": (array of strings) or null }
\`\`\`
`;

export class DirectClient {
	public app: express.Application;
	private agents: Map<string, AgentRuntime>; // container management
	private server: http.Server; // Store server instance
	public startAgent: (
		character: Character,
		directClient: DirectClient,
	) => Promise<AgentRuntime>; // Store startAgent functor
	public loadCharacterTryPath: (characterPath: string) => Promise<Character>; // Store loadCharacterTryPath functor
	public jsonToCharacter: (
		filePath: string,
		character: Record<string, unknown>,
	) => Promise<Character>; // Store jsonToCharacter functor
	public instrumentationAttached = false; // Track if instrumentation is attached

	constructor() {
		elizaLogger.log("DirectClient constructor");
		this.app = express();
		this.app.use(cors());
		this.agents = new Map();

		this.app.use(bodyParser.json());
		this.app.use(bodyParser.urlencoded({ extended: true }));

		// Serve both uploads and generated images
		this.app.use(
			"/media/uploads",
			express.static(path.join(process.cwd(), "/data/uploads")),
		);
		this.app.use(
			"/media/generated",
			express.static(path.join(process.cwd(), "/generatedImages")),
		);

		const apiRouter = createApiRouter(this.agents, this);
		this.app.use(apiRouter);

		setupSwagger(this.app);

		const apiLogRouter = createVerifiableLogApiRouter(this.agents);
		this.app.use(apiLogRouter);

		// Define an interface that extends the Express Request interface
		interface CustomRequest extends ExpressRequest {
			file?: Express.Multer.File;
		}

		// Update the route handler to use CustomRequest instead of express.Request
		this.app.post(
			"/:agentId/whisper",
			upload.single("file"),
			async (req: CustomRequest, res: express.Response) => {
				const audioFile = req.file; // Access the uploaded file using req.file
				const agentId = req.params.agentId;

				if (!audioFile) {
					res.status(400).send("No audio file provided");
					return;
				}

				let runtime = this.agents.get(agentId);
				const apiKey = runtime.getSetting("OPENAI_API_KEY");

				// if runtime is null, look for runtime with the same name
				if (!runtime) {
					runtime = Array.from(this.agents.values()).find(
						(a) => a.character.name.toLowerCase() === agentId.toLowerCase(),
					);
				}

				if (!runtime) {
					res.status(404).send("Agent not found");
					return;
				}

				const openai = new OpenAI({
					apiKey,
				});

				const transcription = await openai.audio.transcriptions.create({
					file: fs.createReadStream(audioFile.path),
					model: "whisper-1",
				});

				res.json(transcription);
			},
		);

		/**
		 * @swagger
		 * /{agentId}/message:
		 *   post:
		 *     summary: Send a message to an agent
		 *     description: Send a message to a specific agent and get their response
		 *     parameters:
		 *       - in: path
		 *         name: agentId
		 *         required: true
		 *         schema:
		 *           type: string
		 *         description: ID of the agent to message
		 *     requestBody:
		 *       required: true
		 *       content:
		 *         multipart/form-data:
		 *           schema:
		 *             type: object
		 *             properties:
		 *               text:
		 *                 type: string
		 *                 description: Message text to send
		 *               roomId:
		 *                 type: string
		 *                 description: Optional room ID for the conversation
		 *               userId:
		 *                 type: string
		 *                 description: Optional user ID for the sender
		 *               file:
		 *                 type: string
		 *                 format: binary
		 *                 description: Optional file attachment
		 *     responses:
		 *       200:
		 *         description: Message processed successfully
		 *         content:
		 *           application/json:
		 *             schema:
		 *               type: array
		 *               items:
		 *                 type: object
		 *                 properties:
		 *                   text:
		 *                     type: string
		 *                   action:
		 *                     type: string
		 *                   attachments:
		 *                     type: array
		 *                     items:
		 *                       type: object
		 *       404:
		 *         description: Agent not found
		 *       500:
		 *         description: Server error
		 */
		this.app.post(
			"/:agentId/message",
			upload.single("file"),
			async (req: express.Request, res: express.Response) => {
				const agentId = req.params.agentId;
				const roomId = stringToUuid(
					req.body.roomId ?? `default-room-${agentId}`,
				);
				const userId = stringToUuid(req.body.userId ?? "user");

				let runtime = this.agents.get(agentId);

				// if runtime is null, look for runtime with the same name
				if (!runtime) {
					runtime = Array.from(this.agents.values()).find(
						(a) => a.character.name.toLowerCase() === agentId.toLowerCase(),
					);
				}

				if (!runtime) {
					res.status(404).send("Agent not found");
					return;
				}

				let runtimeInstrumentation: RuntimeInstrumentation;
				let instrumentation: Instrumentation;
				if (process.env.INSTRUMENTATION_ENABLED === "true") {
					runtimeInstrumentation = getRuntimeInstrumentation();
					instrumentation = Instrumentation.getInstance();
				}

				const text = req.body.text;
				// if empty text, directly return
				if (!text) {
					res.json([]);
					return;
				}

				if (process.env.INSTRUMENTATION_ENABLED === "true") {
					// Ensure the runtime has instrumentation attached
					runtimeInstrumentation.attachToRuntime(
						runtime as unknown as RuntimeLike,
					);
				}

				const startTime = Date.now();
				const messageId = stringToUuid(Date.now().toString());

				// Generate a session ID if not available
				const sessionId =
					(runtime as unknown as RuntimeLike).sessionId ||
					`session-${Date.now()}`;

				if (process.env.INSTRUMENTATION_ENABLED === "true") {
					// Log message reception event with detailed context
					instrumentation.logEvent({
						stage: "Chat",
						subStage: "Request",
						event: "chat_message_received",
						data: {
							messageId,
							sessionId,
							agentId: runtime.agentId,
							roomId,
							userId,
							messageText: text,
							characterName: runtime.character?.name || "Unknown",
							timestamp: startTime,
							client: "direct",
							hasAttachments: !!req.file,
						},
					});
				}

				await runtime.ensureConnection(
					userId,
					roomId,
					req.body.userName,
					req.body.name,
					"direct",
				);

				const attachments: Media[] = [];
				if (req.file) {
					const filePath = path.join(
						process.cwd(),
						"data",
						"uploads",
						req.file.filename,
					);
					attachments.push({
						id: Date.now().toString(),
						url: filePath,
						title: req.file.originalname,
						source: "direct",
						description: `Uploaded file: ${req.file.originalname}`,
						text: "",
						contentType: req.file.mimetype,
					});

					// Log attachment processing event
					instrumentation.logEvent({
						stage: "Chat",
						subStage: "Attachment",
						event: "attachment_processed",
						data: {
							messageId,
							sessionId,
							agentId: runtime.agentId,
							roomId,
							userId,
							attachmentType: req.file.mimetype,
							attachmentName: req.file.originalname,
							timestamp: Date.now(),
						},
					});
				}

				const content: Content = {
					text,
					attachments,
					source: "direct",
					inReplyTo: undefined,
				};

				const userMessage = {
					content,
					userId,
					roomId,
					agentId: runtime.agentId,
				};

				const memory: Memory = {
					id: stringToUuid(`${messageId}-${userId}`),
					...userMessage,
					agentId: runtime.agentId,
					userId,
					roomId,
					content,
					createdAt: Date.now(),
				};

				if (process.env.INSTRUMENTATION_ENABLED === "true") {
					// Log memory storage event
					instrumentation.logEvent({
						stage: "Chat",
						subStage: "Memory",
						event: "memory_storage_started",
						data: {
							messageId,
							sessionId,
							agentId: runtime.agentId,
							roomId,
							userId,
							timestamp: Date.now(),
						},
					});
				}

				await runtime.messageManager.addEmbeddingToMemory(memory);
				await runtime.messageManager.createMemory(memory);

				if (process.env.INSTRUMENTATION_ENABLED === "true") {
					// Log memory storage complete event
					instrumentation.logEvent({
						stage: "Chat",
						subStage: "Memory",
						event: "memory_storage_completed",
						data: {
							messageId,
							sessionId,
							agentId: runtime.agentId,
							roomId,
							userId,
							timestamp: Date.now(),
						},
					});

					// Log state composition started
					instrumentation.logEvent({
						stage: "Chat",
						subStage: "State",
						event: "state_composition_started",
						data: {
							messageId,
							sessionId,
							agentId: runtime.agentId,
							roomId,
							userId,
							timestamp: Date.now(),
						},
					});
				}

				let state = await runtime.composeState(userMessage, {
					agentName: runtime.character.name,
				});

				if (process.env.INSTRUMENTATION_ENABLED === "true") {
					// Log response generation started
					instrumentation.logEvent({
						stage: "Chat",
						subStage: "Generation",
						event: "response_generation_started",
						data: {
							messageId,
							sessionId,
							agentId: runtime.agentId,
							roomId,
							userId,
							modelClass: ModelClass.LARGE,
							timestamp: Date.now(),
						},
					});
				}

				const generationStartTime = Date.now();
				const response = await generateMessageResponse({
					runtime: runtime,
					context: composeContext({
						state,
						template: messageHandlerTemplate,
					}),
					modelClass: ModelClass.LARGE,
				});
				const generationEndTime = Date.now();

				if (process.env.INSTRUMENTATION_ENABLED === "true") {
					// Log response generation completed
					instrumentation.logEvent({
						stage: "Chat",
						subStage: "Generation",
						event: "response_generation_completed",
						data: {
							messageId,
							sessionId,
							agentId: runtime.agentId,
							roomId,
							userId,
							generationTime: generationEndTime - generationStartTime,
							responseLength: response ? response.text.length : 0,
							timestamp: generationEndTime,
						},
					});
				}

				if (!response) {
					if (process.env.INSTRUMENTATION_ENABLED === "true") {
						// Log error
						instrumentation.logEvent({
							stage: "Chat",
							subStage: "Error",
							event: "response_generation_failed",
							data: {
								messageId,
								sessionId,
								agentId: runtime.agentId,
								roomId,
								userId,
								error: "No response from generateMessageResponse",
								timestamp: Date.now(),
							},
						});
					}
					res.status(500).send("No response from generateMessageResponse");
					return;
				}

				// save response to memory
				const responseMessage: Memory = {
					id: stringToUuid(`${messageId}-${runtime.agentId}`),
					...userMessage,
					userId,
					content: response,
					embedding: getEmbeddingZeroVector(),
					createdAt: Date.now(),
				};

				await runtime.messageManager.createMemory(responseMessage);

				state = await runtime.updateRecentMessageState(state);

				let message = null as Content | null;

				if (process.env.INSTRUMENTATION_ENABLED === "true") {
					// Log action processing started
					instrumentation.logEvent({
						stage: "Chat",
						subStage: "Actions",
						event: "action_processing_started",
						data: {
							messageId,
							sessionId,
							agentId: runtime.agentId,
							roomId,
							userId,
							actionCount: runtime.actions.length,
							timestamp: Date.now(),
						},
					});
				}

				const actionsStartTime = Date.now();
				await runtime.processActions(
					memory,
					[responseMessage],
					state,
					async (newMessages) => {
						message = newMessages;
						return [memory];
					},
				);
				const actionsEndTime = Date.now();

				if (process.env.INSTRUMENTATION_ENABLED === "true") {
					// Log action processing completed
					instrumentation.logEvent({
						stage: "Chat",
						subStage: "Actions",
						event: "action_processing_completed",
						data: {
							messageId,
							sessionId,
							agentId: runtime.agentId,
							roomId,
							userId,
							processingTime: actionsEndTime - actionsStartTime,
							hasAdditionalMessages: message !== null,
							timestamp: actionsEndTime,
						},
					});
				}

				await runtime.evaluate(memory, state);

				// Check if we should suppress the initial message
				const action = runtime.actions.find((a) => a.name === response.action);
				const shouldSuppressInitialMessage = action?.suppressInitialMessage;

				if (process.env.INSTRUMENTATION_ENABLED === "true") {
					// Log response delivery
					instrumentation.logEvent({
						stage: "Chat",
						subStage: "Response",
						event: "response_delivered",
						data: {
							messageId,
							sessionId,
							agentId: runtime.agentId,
							roomId,
							userId,
							agentResponse: response.text,
							totalProcessingTime: Date.now() - startTime,
							suppressedInitialMessage: !!shouldSuppressInitialMessage,
							hasAdditionalMessages: message !== null,
							timestamp: Date.now(),
						},
					});
				}

				if (!shouldSuppressInitialMessage) {
					if (message) {
						res.json([response, message]);
					} else {
						res.json([response]);
					}
				} else {
					if (message) {
						res.json([message]);
					} else {
						res.json([]);
					}
				}
			},
		);

		this.app.post(
			"/agents/:agentIdOrName/hyperfi/v1",
			async (req: express.Request, res: express.Response) => {
				// get runtime
				const agentId = req.params.agentIdOrName;
				let runtime = this.agents.get(agentId);
				// if runtime is null, look for runtime with the same name
				if (!runtime) {
					runtime = Array.from(this.agents.values()).find(
						(a) => a.character.name.toLowerCase() === agentId.toLowerCase(),
					);
				}
				if (!runtime) {
					res.status(404).send("Agent not found");
					return;
				}

				// can we be in more than one hyperfi world at once
				// but you may want the same context is multiple worlds
				// this is more like an instanceId
				const roomId = stringToUuid(req.body.roomId ?? "hyperfi");

				const body = req.body;

				// hyperfi specific parameters
				let nearby = [];
				let availableEmotes = [];

				if (body.nearby) {
					nearby = body.nearby;
				}
				if (body.messages) {
					// loop on the messages and record the memories
					// might want to do this in parallel
					for (const msg of body.messages) {
						const parts = msg.split(/:\s*/);
						const mUserId = stringToUuid(parts[0]);
						await runtime.ensureConnection(
							mUserId,
							roomId, // where
							parts[0], // username
							parts[0], // userScreeName?
							"hyperfi",
						);
						const content: Content = {
							text: parts[1] || "",
							attachments: [],
							source: "hyperfi",
							inReplyTo: undefined,
						};
						const memory: Memory = {
							id: stringToUuid(msg),
							agentId: runtime.agentId,
							userId: mUserId,
							roomId,
							content,
						};
						await runtime.messageManager.createMemory(memory);
					}
				}
				if (body.availableEmotes) {
					availableEmotes = body.availableEmotes;
				}

				const content: Content = {
					// we need to compose who's near and what emotes are available
					text: JSON.stringify(req.body),
					attachments: [],
					source: "hyperfi",
					inReplyTo: undefined,
				};

				const userId = stringToUuid("hyperfi");
				const userMessage = {
					content,
					userId,
					roomId,
					agentId: runtime.agentId,
				};

				const state = await runtime.composeState(userMessage, {
					agentName: runtime.character.name,
				});

				let template = hyperfiHandlerTemplate;
				template = template.replace("{{emotes}}", availableEmotes.join("|"));
				template = template.replace("{{nearby}}", nearby.join("|"));
				const context = composeContext({
					state,
					template,
				});

				function createHyperfiOutSchema(
					nearby: string[],
					availableEmotes: string[],
				) {
					const lookAtSchema =
						nearby.length > 1
							? z
									.union(
										nearby.map((item) => z.literal(item)) as [
											z.ZodLiteral<string>,
											z.ZodLiteral<string>,
											...z.ZodLiteral<string>[],
										],
									)
									.nullable()
							: nearby.length === 1
								? z.literal(nearby[0]).nullable()
								: z.null(); // Fallback for empty array

					const emoteSchema =
						availableEmotes.length > 1
							? z
									.union(
										availableEmotes.map((item) => z.literal(item)) as [
											z.ZodLiteral<string>,
											z.ZodLiteral<string>,
											...z.ZodLiteral<string>[],
										],
									)
									.nullable()
							: availableEmotes.length === 1
								? z.literal(availableEmotes[0]).nullable()
								: z.null(); // Fallback for empty array

					return z.object({
						lookAt: lookAtSchema,
						emote: emoteSchema,
						say: z.string().nullable(),
						actions: z.array(z.string()).nullable(),
					});
				}

				// Define the schema for the expected output
				const hyperfiOutSchema = createHyperfiOutSchema(
					nearby,
					availableEmotes,
				);

				// Call LLM
				const response = await generateObject({
					runtime,
					context,
					modelClass: ModelClass.SMALL, // 1s processing time on openai small
					schema: hyperfiOutSchema,
				});

				if (!response) {
					res.status(500).send("No response from generateMessageResponse");
					return;
				}

				// biome-ignore lint/suspicious/noImplicitAnyLet: <explanation>
				let hfOut;
				try {
					hfOut = hyperfiOutSchema.parse(response.object);
				} catch {
					elizaLogger.error("cant serialize response", response.object);
					res.status(500).send("Error in LLM response, try again");
					return;
				}

				// do this in the background
				new Promise((resolve) => {
					const contentObj: Content = {
						text: hfOut.say,
					};

					if (hfOut.lookAt !== null || hfOut.emote !== null) {
						contentObj.text += ". Then I ";
						if (hfOut.lookAt !== null) {
							contentObj.text += `looked at ${hfOut.lookAt}`;
							if (hfOut.emote !== null) {
								contentObj.text += " and ";
							}
						}
						if (hfOut.emote !== null) {
							contentObj.text = `emoted ${hfOut.emote}`;
						}
					}

					if (hfOut.actions !== null) {
						// content can only do one action
						contentObj.action = hfOut.actions[0];
					}

					// save response to memory
					const responseMessage = {
						...userMessage,
						userId: runtime.agentId,
						content: contentObj,
					};

					runtime.messageManager.createMemory(responseMessage).then(() => {
						const messageId = stringToUuid(Date.now().toString());
						const memory: Memory = {
							id: messageId,
							agentId: runtime.agentId,
							userId,
							roomId,
							content,
							createdAt: Date.now(),
						};

						// run evaluators (generally can be done in parallel with processActions)
						// can an evaluator modify memory? it could but currently doesn't
						runtime.evaluate(memory, state).then(() => {
							// only need to call if responseMessage.content.action is set
							if (contentObj.action) {
								// pass memory (query) to any actions to call
								runtime.processActions(
									memory,
									[responseMessage],
									state,
									async (_newMessages) => {
										// FIXME: this is supposed override what the LLM said/decided
										// but the promise doesn't make this possible
										//message = newMessages;
										return [memory];
									},
								); // 0.674s
							}
							resolve(true);
						});
					});
				});
				res.json({ response: hfOut });
			},
		);

		this.app.post(
			"/:agentId/image",
			async (req: express.Request, res: express.Response) => {
				const agentId = req.params.agentId;
				const agent = this.agents.get(agentId);
				if (!agent) {
					res.status(404).send("Agent not found");
					return;
				}

				const images = await generateImage({ ...req.body }, agent);
				const imagesRes: { image: string; caption: string }[] = [];
				if (images.data && images.data.length > 0) {
					for (let i = 0; i < images.data.length; i++) {
						const caption = await generateCaption(
							{ imageUrl: images.data[i] },
							agent,
						);
						imagesRes.push({
							image: images.data[i],
							caption: caption.title,
						});
					}
				}
				res.json({ images: imagesRes });
			},
		);

		this.app.post(
			"/fine-tune",
			async (req: express.Request, res: express.Response) => {
				try {
					const response = await fetch("https://api.bageldb.ai/api/v1/asset", {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							"X-API-KEY": `${process.env.BAGEL_API_KEY}`,
						},
						body: JSON.stringify(req.body),
					});

					const data = await response.json();
					res.json(data);
				} catch (error) {
					res.status(500).json({
						error:
							"Please create an account at bakery.bagel.net and get an API key. Then set the BAGEL_API_KEY environment variable.",
						details: error.message,
					});
				}
			},
		);
		this.app.get(
			"/fine-tune/:assetId",
			async (req: express.Request, res: express.Response) => {
				const assetId = req.params.assetId;
				const downloadDir = path.join(process.cwd(), "downloads", assetId);

				elizaLogger.log("Download directory:", downloadDir);

				try {
					elizaLogger.log("Creating directory...");
					await fs.promises.mkdir(downloadDir, { recursive: true });

					elizaLogger.log("Fetching file...");
					const fileResponse = await fetch(
						`https://api.bageldb.ai/api/v1/asset/${assetId}/download`,
						{
							headers: {
								"X-API-KEY": `${process.env.BAGEL_API_KEY}`,
							},
						},
					);

					if (!fileResponse.ok) {
						throw new Error(
							`API responded with status ${fileResponse.status}: ${await fileResponse.text()}`,
						);
					}

					elizaLogger.log("Response headers:", fileResponse.headers);

					const fileName =
						fileResponse.headers
							.get("content-disposition")
							?.split("filename=")[1]
							?.replace(/"/g, /* " */ "") || "default_name.txt";

					elizaLogger.log("Saving as:", fileName);

					const arrayBuffer = await fileResponse.arrayBuffer();
					const buffer = Buffer.from(arrayBuffer);

					const filePath = path.join(downloadDir, fileName);
					elizaLogger.log("Full file path:", filePath);

					await fs.promises.writeFile(filePath, buffer);

					// Verify file was written
					const stats = await fs.promises.stat(filePath);
					elizaLogger.log(
						"File written successfully. Size:",
						stats.size,
						"bytes",
					);

					res.json({
						success: true,
						message: "Single file downloaded successfully",
						downloadPath: downloadDir,
						fileCount: 1,
						fileName: fileName,
						fileSize: stats.size,
					});
				} catch (error) {
					elizaLogger.error("Detailed error:", error);
					res.status(500).json({
						error: "Failed to download files from BagelDB",
						details: error.message,
						stack: error.stack,
					});
				}
			},
		);

		/**
		 * @swagger
		 * /{agentId}/speak:
		 *   post:
		 *     summary: Convert agent's response to speech
		 *     description: Send a message to an agent and receive an audio response
		 *     parameters:
		 *       - in: path
		 *         name: agentId
		 *         required: true
		 *         schema:
		 *           type: string
		 *         description: ID of the agent
		 *     requestBody:
		 *       required: true
		 *       content:
		 *         application/json:
		 *           schema:
		 *             type: object
		 *             required:
		 *               - text
		 *             properties:
		 *               text:
		 *                 type: string
		 *                 description: Text to convert to speech
		 *               roomId:
		 *                 type: string
		 *               userId:
		 *                 type: string
		 *     responses:
		 *       200:
		 *         description: Audio response
		 *         content:
		 *           audio/mpeg:
		 *             schema:
		 *               type: string
		 *               format: binary
		 *       400:
		 *         description: No text provided
		 *       404:
		 *         description: Agent not found
		 *       500:
		 *         description: Server error or ElevenLabs API error
		 */
		this.app.post("/:agentId/speak", async (req, res) => {
			const agentId = req.params.agentId;
			const roomId = stringToUuid(req.body.roomId ?? `default-room-${agentId}`);
			const userId = stringToUuid(req.body.userId ?? "user");
			const text = req.body.text;

			if (!text) {
				res.status(400).send("No text provided");
				return;
			}

			let runtime = this.agents.get(agentId);

			// if runtime is null, look for runtime with the same name
			if (!runtime) {
				runtime = Array.from(this.agents.values()).find(
					(a) => a.character.name.toLowerCase() === agentId.toLowerCase(),
				);
			}

			if (!runtime) {
				res.status(404).send("Agent not found");
				return;
			}

			try {
				// Process message through agent (same as /message endpoint)
				await runtime.ensureConnection(
					userId,
					roomId,
					req.body.userName,
					req.body.name,
					"direct",
				);

				const messageId = stringToUuid(Date.now().toString());

				const content: Content = {
					text,
					attachments: [],
					source: "direct",
					inReplyTo: undefined,
				};

				const userMessage = {
					content,
					userId,
					roomId,
					agentId: runtime.agentId,
				};

				const memory: Memory = {
					id: messageId,
					agentId: runtime.agentId,
					userId,
					roomId,
					content,
					createdAt: Date.now(),
				};

				await runtime.messageManager.createMemory(memory);

				const state = await runtime.composeState(userMessage, {
					agentName: runtime.character.name,
				});

				const context = composeContext({
					state,
					template: messageHandlerTemplate,
				});

				const response = await generateMessageResponse({
					runtime: runtime,
					context,
					modelClass: ModelClass.LARGE,
				});

				// save response to memory
				const responseMessage = {
					...userMessage,
					userId: runtime.agentId,
					content: response,
				};

				await runtime.messageManager.createMemory(responseMessage);

				if (!response) {
					res.status(500).send("No response from generateMessageResponse");
					return;
				}

				await runtime.evaluate(memory, state);

				const _result = await runtime.processActions(
					memory,
					[responseMessage],
					state,
					async () => {
						return [memory];
					},
				);

				// Get the text to convert to speech
				const textToSpeak = response.text;

				// Convert to speech using ElevenLabs
				const elevenLabsApiUrl = `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}`;
				const apiKey = process.env.ELEVENLABS_XI_API_KEY;

				if (!apiKey) {
					throw new Error("ELEVENLABS_XI_API_KEY not configured");
				}

				const speechResponse = await fetch(elevenLabsApiUrl, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"xi-api-key": apiKey,
					},
					body: JSON.stringify({
						text: textToSpeak,
						model_id:
							process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2",
						voice_settings: {
							stability: Number.parseFloat(
								process.env.ELEVENLABS_VOICE_STABILITY || "0.5",
							),
							similarity_boost: Number.parseFloat(
								process.env.ELEVENLABS_VOICE_SIMILARITY_BOOST || "0.9",
							),
							style: Number.parseFloat(
								process.env.ELEVENLABS_VOICE_STYLE || "0.66",
							),
							use_speaker_boost:
								process.env.ELEVENLABS_VOICE_USE_SPEAKER_BOOST === "true",
						},
					}),
				});

				if (!speechResponse.ok) {
					throw new Error(`ElevenLabs API error: ${speechResponse.statusText}`);
				}

				const audioBuffer = await speechResponse.arrayBuffer();

				// Set appropriate headers for audio streaming
				res.set({
					"Content-Type": "audio/mpeg",
					"Transfer-Encoding": "chunked",
				});

				res.send(Buffer.from(audioBuffer));
			} catch (error) {
				elizaLogger.error(
					"Error processing message or generating speech:",
					error,
				);
				res.status(500).json({
					error: "Error processing message or generating speech",
					details: error.message,
				});
			}
		});

		/**
		 * @swagger
		 * /{agentId}/tts:
		 *   post:
		 *     summary: Text-to-speech conversion
		 *     description: Convert text to speech using ElevenLabs API
		 *     parameters:
		 *       - in: path
		 *         name: agentId
		 *         required: true
		 *         schema:
		 *           type: string
		 *         description: ID of the agent
		 *     requestBody:
		 *       required: true
		 *       content:
		 *         application/json:
		 *           schema:
		 *             type: object
		 *             required:
		 *               - text
		 *             properties:
		 *               text:
		 *                 type: string
		 *                 description: Text to convert to speech
		 *     responses:
		 *       200:
		 *         description: Audio response
		 *         content:
		 *           audio/mpeg:
		 *             schema:
		 *               type: string
		 *               format: binary
		 *       400:
		 *         description: No text provided
		 *       500:
		 *         description: ElevenLabs API error
		 */
		this.app.post("/:agentId/tts", async (req, res) => {
			const text = req.body.text;

			if (!text) {
				res.status(400).send("No text provided");
				return;
			}

			try {
				// Convert to speech using ElevenLabs
				const elevenLabsApiUrl = `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}`;
				const apiKey = process.env.ELEVENLABS_XI_API_KEY;

				if (!apiKey) {
					throw new Error("ELEVENLABS_XI_API_KEY not configured");
				}

				const speechResponse = await fetch(elevenLabsApiUrl, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"xi-api-key": apiKey,
					},
					body: JSON.stringify({
						text,
						model_id:
							process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2",
						voice_settings: {
							stability: Number.parseFloat(
								process.env.ELEVENLABS_VOICE_STABILITY || "0.5",
							),
							similarity_boost: Number.parseFloat(
								process.env.ELEVENLABS_VOICE_SIMILARITY_BOOST || "0.9",
							),
							style: Number.parseFloat(
								process.env.ELEVENLABS_VOICE_STYLE || "0.66",
							),
							use_speaker_boost:
								process.env.ELEVENLABS_VOICE_USE_SPEAKER_BOOST === "true",
						},
					}),
				});

				if (!speechResponse.ok) {
					throw new Error(`ElevenLabs API error: ${speechResponse.statusText}`);
				}

				const audioBuffer = await speechResponse.arrayBuffer();

				res.set({
					"Content-Type": "audio/mpeg",
					"Transfer-Encoding": "chunked",
				});

				res.send(Buffer.from(audioBuffer));
			} catch (error) {
				elizaLogger.error(
					"Error processing message or generating speech:",
					error,
				);
				res.status(500).json({
					error: "Error processing message or generating speech",
					details: error.message,
				});
			}
		});
	}

	// agent/src/index.ts:startAgent calls this
	public registerAgent(runtime: AgentRuntime) {
		// register any plugin endpoints?
		// but once and only once
		this.agents.set(runtime.agentId, runtime);

		// Log the registration for instrumentation purposes
		try {
			const message = {
				content: { text: `Agent registered: ${runtime.character.name}` },
				id: runtime.agentId,
				userId: runtime.agentId,
				roomId: runtime.agentId,
				agentId: runtime.agentId,
				createdAt: Date.now(),
			};

			// If the agent has an evaluate method, try to call it for the registration
			// This will trigger the instrumentation if it's properly set up
			if (runtime.evaluate && typeof runtime.evaluate === "function") {
				const state = { agentId: runtime.agentId };
				runtime.evaluate(message, state as State).catch((err) => {
					elizaLogger.error(
						`Error evaluating agent registration: ${err.message}`,
					);
				});
			}
		} catch (error) {
			elizaLogger.error(
				`Error during agent registration instrumentation: ${error.message}`,
			);
		}
	}

	public unregisterAgent(runtime: AgentRuntime) {
		this.agents.delete(runtime.agentId);
	}

	public start(port: number) {
		this.server = this.app.listen(port, () => {
			elizaLogger.success(
				`REST API bound to 0.0.0.0:${port}. If running locally, access it at http://localhost:${port}.`,
			);
		});

		// Handle graceful shutdown
		const gracefulShutdown = () => {
			elizaLogger.log("Received shutdown signal, closing server...");
			this.server.close(() => {
				elizaLogger.success("Server closed successfully");
				process.exit(0);
			});

			// Force close after 5 seconds if server hasn't closed
			setTimeout(() => {
				elizaLogger.error(
					"Could not close connections in time, forcefully shutting down",
				);
				process.exit(1);
			}, 5000);
		};

		// Handle different shutdown signals
		process.on("SIGTERM", gracefulShutdown);
		process.on("SIGINT", gracefulShutdown);
	}

	public stop() {
		if (this.server) {
			this.server.close(() => {
				elizaLogger.success("Server stopped");
			});
		}
	}
}

export const DirectClientInterface: Client = {
	start: async (_runtime: IAgentRuntime) => {
		elizaLogger.log("DirectClientInterface start");
		const client = new DirectClient();
		const serverPort = Number.parseInt(settings.SERVER_PORT || "3000");
		client.start(serverPort);
		return client;
	},
	stop: async (_runtime: IAgentRuntime, client?: Client) => {
		if (client instanceof DirectClient) {
			client.stop();
		}
	},
};

export default DirectClientInterface;
