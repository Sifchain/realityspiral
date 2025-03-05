import fs from "node:fs";
import path from "node:path";
import bodyParser from "body-parser";
import cors from "cors";
import express from "express";
import type { Router } from "express";

import {
	type AgentRuntime,
	type Character,
	ServiceType,
	type UUID,
	elizaLogger,
	getEnvVariable,
	stringToUuid,
	validateCharacterConfig,
} from "@elizaos/core";

import { validateUuid } from "@elizaos/core";
import type { TeeLogQuery, TeeLogService } from "@elizaos/plugin-tee-log";
import type { WebhookEvent } from "@realityspiral/client-coinbase";
import { REST, Routes } from "discord.js";
import type { DirectClient } from ".";
import {
	addTemplate,
	batchUpdateCharacterData,
	deleteCharacterArrayElement,
	deleteTemplate,
	getCharacterData,
	getCharacters,
	getTemplates,
	updateCharacterArrayElement,
	updateTemplate,
} from "./controllers/templateController";
import {
	getAllTraces,
	getTracesByAgentId,
	getTracesByRoom,
	getUniqueAgentId,
	getUniqueRoomIdByAgent,
	getUniqueRuns,
} from "./controllers/tracesController.ts";

const GITHUB_REPO_URL = "https://github.com/Sifchain/realityspiral";

interface UUIDParams {
	agentId: UUID;
	roomId?: UUID;
	userId?: UUID;
}

function validateUUIDParams(
	params: {
		agentId: string;
		roomId?: string;
		userId?: string;
	},
	res: express.Response,
): UUIDParams | null {
	const agentId = validateUuid(params.agentId);
	if (!agentId) {
		res.status(400).json({
			error:
				"Invalid AgentId format. Expected to be a UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
		});
		return null;
	}

	if (params.roomId) {
		const roomId = validateUuid(params.roomId);
		if (!roomId) {
			res.status(400).json({
				error:
					"Invalid RoomId format. Expected to be a UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
			});
			return null;
		}
		return { agentId, roomId };
	}

	if (params.userId) {
		const userId = validateUuid(params.userId);
		if (!userId) {
			res.status(400).json({
				error:
					"Invalid SessionId format. Expected to be a UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
			});
			return null;
		}
		return { agentId, userId };
	}

	return { agentId };
}

export function createApiRouter(
	agents: Map<string, AgentRuntime>,
	directClient: DirectClient,
): Router {
	const router = express.Router();
	router.use(cors());
	router.use(bodyParser.json());
	router.use(bodyParser.urlencoded({ extended: true }));
	router.use(
		express.json({
			limit: getEnvVariable("EXPRESS_MAX_PAYLOAD") || "100kb",
		}),
	);

	/**
	 * @swagger
	 * /webhook/coinbase/health:
	 *   get:
	 *     summary: Check Coinbase webhook health
	 *     description: Returns health status of the Coinbase webhook endpoint
	 *     responses:
	 *       200:
	 *         description: Health check successful
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 status:
	 *                   type: string
	 *                   example: ok
	 */
	router.get("/webhook/coinbase/health", (_req, res) => {
		elizaLogger.info("Health check received");
		res.status(200).json({ status: "ok" });
	});

	/**
	 * @swagger
	 * /webhook/coinbase/{agentId}:
	 *   post:
	 *     summary: Handle Coinbase webhook events
	 *     description: Processes incoming Coinbase webhook events for a specific agent
	 *     parameters:
	 *       - in: path
	 *         name: agentId
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: ID of the agent to handle the webhook
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required:
	 *               - event
	 *               - ticker
	 *               - timestamp
	 *               - price
	 *             properties:
	 *               event:
	 *                 type: string
	 *                 enum: [buy, sell]
	 *               ticker:
	 *                 type: string
	 *               timestamp:
	 *                 type: string
	 *               price:
	 *                 type: number
	 *     responses:
	 *       200:
	 *         description: Webhook processed successfully
	 *       400:
	 *         description: Invalid webhook payload or agent not configured
	 *       404:
	 *         description: Agent not found
	 *       500:
	 *         description: Internal server error
	 */
	router.post("/webhook/coinbase/:agentId", async (req, res) => {
		elizaLogger.info("Webhook received for agent:", req.params.agentId);
		const agentId = req.params.agentId;
		const runtime = agents.get(agentId);

		if (!runtime) {
			res.status(404).json({ error: "Agent not found" });
			return;
		}

		// Validate the webhook payload
		const event = req.body as WebhookEvent;
		if (!event.event || !event.ticker || !event.timestamp || !event.price) {
			res.status(400).json({ error: "Invalid webhook payload" });
			return;
		}
		if (event.event !== "buy" && event.event !== "sell") {
			res.status(400).json({ error: "Invalid event type" });
			return;
		}

		try {
			// Access the coinbase client through the runtime
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			const coinbaseClient = runtime.clients.coinbase as any;
			if (!coinbaseClient) {
				res
					.status(400)
					.json({ error: "Coinbase client not initialized for this agent" });
				return;
			}

			// Forward the webhook event to the client's handleWebhookEvent method
			await coinbaseClient.handleWebhookEvent(event);
			res.status(200).json({ status: "success" });
		} catch (error) {
			elizaLogger.error("Error processing Coinbase webhook:", error);
			res.status(500).json({ error: "Internal Server Error" });
		}
	});

	/**
	 * @swagger
	 * /:
	 *   get:
	 *     summary: Welcome message
	 *     description: Returns a welcome message
	 *     responses:
	 *       200:
	 *         description: Welcome message
	 */
	router.get("/", (_req, res) => {
		res.send("Welcome, this is the REST API!");
	});

	/**
	 * @swagger
	 * /hello:
	 *   get:
	 *     summary: Hello World
	 *     description: Returns a hello world message
	 *     responses:
	 *       200:
	 *         description: Hello World
	 */
	router.get("/hello", (_req, res) => {
		res.json({ message: "Hello World!" });
	});

	/**
	 * @swagger
	 * /version:
	 *   get:
	 *     summary: Get the version of the application
	 *     description: Returns the version of the application
	 *     responses:
	 *       200:
	 *         description: Version of the application
	 */
	router.get("/version", (_req, res) => {
		if (!process.env.VERSION) {
			res.json({
				version: "unknown",
				url: GITHUB_REPO_URL,
			});
			return;
		}
		const version = process.env.VERSION;
		const url = version?.startsWith("v")
			? `${GITHUB_REPO_URL}/releases/${version}`
			: `${GITHUB_REPO_URL}/commit/${version}`;
		res.json({ version, url });
	});

	/**
	 * @swagger
	 * /agents:
	 *   get:
	 *     summary: Get all agents
	 *     description: Returns a list of all registered agents and their basic information
	 *     responses:
	 *       200:
	 *         description: List of agents retrieved successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 agents:
	 *                   type: array
	 *                   items:
	 *                     type: object
	 *                     properties:
	 *                       id:
	 *                         type: string
	 *                         description: Agent's unique identifier
	 *                       name:
	 *                         type: string
	 *                         description: Agent's name
	 *                       clients:
	 *                         type: array
	 *                         items:
	 *                           type: string
	 *                         description: List of client types connected to the agent
	 */
	router.get("/agents", (_req, res) => {
		const agentsList = Array.from(agents.values()).map((agent) => ({
			id: agent.agentId,
			name: agent.character.name,
			clients: Object.keys(agent.clients),
		}));
		res.json({ agents: agentsList });
	});

	/**
	 * @swagger
	 * /storage:
	 *   get:
	 *     summary: Get all stored characters
	 *     description: Returns a list of all stored characters
	 *     responses:
	 *       200:
	 *         description: List of stored characters
	 */
	router.get("/storage", async (_req, res) => {
		try {
			const uploadDir = path.join(process.cwd(), "data", "characters");
			const files = await fs.promises.readdir(uploadDir);
			res.json({ files });
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	});

	/**
	 * @swagger
	 * /agents/{agentId}:
	 *   get:
	 *     summary: Get an agent by ID
	 *     description: Returns the agent with the specified ID
	 *     responses:
	 *       200:
	 *         description: Agent details
	 */
	router.get("/agents/:agentId", (req, res) => {
		const { agentId } = validateUUIDParams(req.params, res) ?? {
			agentId: null,
		};
		if (!agentId) return;

		const agent = agents.get(agentId);

		if (!agent) {
			res.status(404).json({ error: "Agent not found" });
			return;
		}

		const character = agent?.character;
		if (character?.settings?.secrets) {
			character.settings.secrets = undefined;
		}

		res.json({
			id: agent.agentId,
			character: agent.character,
		});
	});

	/**
	 * @swagger
	 * /agents/{agentId}:
	 *   delete:
	 *     summary: Delete an agent by ID
	 *     description: Deletes the agent with the specified ID
	 *     responses:
	 *       204:
	 *         description: Agent deleted successfully
	 */
	router.delete("/agents/:agentId", async (req, res) => {
		const { agentId } = validateUUIDParams(req.params, res) ?? {
			agentId: null,
		};
		if (!agentId) return;

		const agent: AgentRuntime = agents.get(agentId);

		if (agent) {
			agent.stop();
			directClient.unregisterAgent(agent);
			res.status(204).json({ success: true });
		} else {
			res.status(404).json({ error: "Agent not found" });
		}
	});

	/**
	 * @swagger
	 * /agents/{agentId}/set:
	 *   post:
	 *     summary: Set an agent by ID
	 *     description: Sets the agent with the specified ID
	 *     responses:
	 *       200:
	 *         description: Agent set successfully
	 */
	router.post("/agents/:agentId/set", async (req, res) => {
		const { agentId } = validateUUIDParams(req.params, res) ?? {
			agentId: null,
		};
		if (!agentId) return;

		let agent: AgentRuntime = agents.get(agentId);

		// update character
		if (agent) {
			// stop agent
			agent.stop();
			directClient.unregisterAgent(agent);
			// if it has a different name, the agentId will change
		}

		// stores the json data before it is modified with added data
		const characterJson = { ...req.body };

		// load character from body
		const character = req.body;
		try {
			validateCharacterConfig(character);
		} catch (e) {
			elizaLogger.error(`Error parsing character: ${e}`);
			res.status(400).json({
				success: false,
				message: e.message,
			});
			return;
		}

		// start it up (and register it)
		try {
			agent = await directClient.startAgent(character);
			elizaLogger.log(`${character.name} started`);
		} catch (e) {
			elizaLogger.error(`Error starting agent: ${e}`);
			res.status(500).json({
				success: false,
				message: e.message,
			});
			return;
		}

		if (process.env.USE_CHARACTER_STORAGE === "true") {
			try {
				const filename = `${agent.agentId}.json`;
				const uploadDir = path.join(process.cwd(), "data", "characters");
				const filepath = path.join(uploadDir, filename);
				await fs.promises.mkdir(uploadDir, { recursive: true });
				await fs.promises.writeFile(
					filepath,
					JSON.stringify({ ...characterJson, id: agent.agentId }, null, 2),
				);
				elizaLogger.info(`Character stored successfully at ${filepath}`);
			} catch (error) {
				elizaLogger.error(`Failed to store character: ${error.message}`);
			}
		}

		res.json({
			id: character.id,
			character: character,
		});
	});

	/**
	 * @swagger
	 * /agents/{agentId}/channels:
	 *   get:
	 *     summary: Get channels for an agent
	 *     description: Returns a list of channels for the specified agent
	 *     responses:
	 *       200:
	 *         description: List of channels
	 */
	router.get("/agents/:agentId/channels", async (req, res) => {
		const { agentId } = validateUUIDParams(req.params, res) ?? {
			agentId: null,
		};
		if (!agentId) return;

		const runtime = agents.get(agentId);

		if (!runtime) {
			res.status(404).json({ error: "Runtime not found" });
			return;
		}

		const API_TOKEN = runtime.getSetting("DISCORD_API_TOKEN") as string;
		const rest = new REST({ version: "10" }).setToken(API_TOKEN);

		try {
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			const guilds = (await rest.get(Routes.userGuilds())) as Array<any>;

			res.json({
				id: runtime.agentId,
				guilds: guilds,
				serverCount: guilds.length,
			});
		} catch (error) {
			console.error("Error fetching guilds:", error);
			res.status(500).json({ error: "Failed to fetch guilds" });
		}
	});

	const getMemories = async (
		agentId: UUID,
		roomId: UUID,
		userId: UUID | null,
		_req,
		res,
	) => {
		let runtime = agents.get(agentId);

		// if runtime is null, look for runtime with the same name
		if (!runtime) {
			runtime = Array.from(agents.values()).find(
				(a) => a.character.name.toLowerCase() === agentId.toLowerCase(),
			);
		}

		if (!runtime) {
			res.status(404).send("Agent not found");
			return;
		}

		try {
			const memories = await runtime.messageManager.getMemories({
				roomId,
				count: 1000,
			});

			const filteredMemories = memories.filter(
				(memory) =>
					// biome-ignore lint/suspicious/noExplicitAny: <explanation>
					(memory.content.metadata as any)?.type !== "file" &&
					memory.content?.source !== "direct",
			);

			const response = {
				agentId,
				roomId,
				userId,
				memories: filteredMemories.map((memory) => ({
					id: memory.id,
					userId: memory.userId,
					agentId: memory.agentId,
					createdAt: memory.createdAt,
					content: {
						text: memory.content.text,
						action: memory.content.action,
						source: memory.content.source,
						url: memory.content.url,
						inReplyTo: memory.content.inReplyTo,
						attachments: memory.content.attachments?.map((attachment) => ({
							id: attachment.id,
							url: attachment.url,
							title: attachment.title,
							source: attachment.source,
							description: attachment.description,
							text: attachment.text,
							contentType: attachment.contentType,
						})),
					},
					embedding: memory.embedding,
					roomId: memory.roomId,
					unique: memory.unique,
					similarity: memory.similarity,
				})),
			};

			res.json(response);
		} catch (error) {
			console.error("Error fetching memories:", error);
			res.status(500).json({ error: "Failed to fetch memories" });
		}
	};

	/**
	 * @swagger
	 * /agents/{agentId}/{roomId}/memories:
	 *   get:
	 *     summary: Get memories for an agent in a room
	 *     description: Returns a list of memories for the specified agent in the specified room
	 *     responses:
	 *       200:
	 *         description: List of memories
	 */
	router.get("/agents/:agentId/:roomId/memories", async (req, res) => {
		const { agentId, roomId } = validateUUIDParams(req.params, res) ?? {
			agentId: null,
			roomId: null,
		};
		if (!agentId || !roomId) return;

		await getMemories(agentId, roomId, null, req, res);
	});

	/**
	 * @swagger
	 * /agents/{agentId}/memories/{userId}:
	 *   get:
	 *     summary: Get memories for an agent in a room
	 *     description: Returns a list of memories for the specified agent in the specified room
	 *     responses:
	 *       200:
	 *         description: List of memories
	 */
	router.get("/agents/:agentId/memories/:userId", async (req, res) => {
		const { agentId, userId } = validateUUIDParams(req.params, res) ?? {
			agentId: null,
			userId: null,
		};
		if (!agentId || !userId) return;

		const roomId = stringToUuid(
			(req.query.roomId as string) ?? `default-room-${agentId}`,
		);

		await getMemories(agentId, roomId, userId, req, res);
	});

	/**
	 * @swagger
	 * /tee/agents:
	 *   get:
	 *     summary: Get all TEE agents
	 *     description: Returns a list of all TEE agents
	 *     responses:
	 *       200:
	 *         description: List of TEE agents
	 */
	router.get("/tee/agents", async (_req, res) => {
		try {
			const allAgents = [];

			for (const agentRuntime of agents.values()) {
				const teeLogService = agentRuntime
					.getService<TeeLogService>(ServiceType.TEE_LOG)
					.getInstance();

				const agents = await teeLogService.getAllAgents();
				allAgents.push(...agents);
			}

			const runtime: AgentRuntime = agents.values().next().value;
			const teeLogService = runtime
				.getService<TeeLogService>(ServiceType.TEE_LOG)
				.getInstance();
			const attestation = await teeLogService.generateAttestation(
				JSON.stringify(allAgents),
			);
			res.json({ agents: allAgents, attestation: attestation });
		} catch (error) {
			elizaLogger.error("Failed to get TEE agents:", error);
			res.status(500).json({
				error: "Failed to get TEE agents",
			});
		}
	});

	/**
	 * @swagger
	 * /tee/agents/{agentId}:
	 *   get:
	 *     summary: Get a TEE agent by ID
	 *     description: Returns the agent with the specified ID
	 *     responses:
	 *       200:
	 *         description: Agent details
	 */
	router.get("/tee/agents/:agentId", async (req, res) => {
		try {
			const agentId = req.params.agentId;
			const agentRuntime = agents.get(agentId);
			if (!agentRuntime) {
				res.status(404).json({ error: "Agent not found" });
				return;
			}

			const teeLogService = agentRuntime
				.getService<TeeLogService>(ServiceType.TEE_LOG)
				.getInstance();

			const teeAgent = await teeLogService.getAgent(agentId);
			const attestation = await teeLogService.generateAttestation(
				JSON.stringify(teeAgent),
			);
			res.json({ agent: teeAgent, attestation: attestation });
		} catch (error) {
			elizaLogger.error("Failed to get TEE agent:", error);
			res.status(500).json({
				error: "Failed to get TEE agent",
			});
		}
	});

	/**
	 * @swagger
	 * /tee/logs:
	 *   post:
	 *     summary: Get logs for an agent
	 *     description: Returns a list of logs for the specified agent
	 *     responses:
	 *       200:
	 *         description: List of logs
	 */
	router.post(
		"/tee/logs",
		async (req: express.Request, res: express.Response) => {
			try {
				const query = req.body.query || {};
				const page = Number.parseInt(req.body.page) || 1;
				const pageSize = Number.parseInt(req.body.pageSize) || 10;

				const teeLogQuery: TeeLogQuery = {
					agentId: query.agentId || "",
					roomId: query.roomId || "",
					userId: query.userId || "",
					type: query.type || "",
					containsContent: query.containsContent || "",
					startTimestamp: query.startTimestamp || undefined,
					endTimestamp: query.endTimestamp || undefined,
				};
				const agentRuntime: AgentRuntime = agents.values().next().value;
				const teeLogService = agentRuntime
					.getService<TeeLogService>(ServiceType.TEE_LOG)
					.getInstance();
				const pageQuery = await teeLogService.getLogs(
					teeLogQuery,
					page,
					pageSize,
				);
				const attestation = await teeLogService.generateAttestation(
					JSON.stringify(pageQuery),
				);
				res.json({
					logs: pageQuery,
					attestation: attestation,
				});
			} catch (error) {
				elizaLogger.error("Failed to get TEE logs:", error);
				res.status(500).json({
					error: "Failed to get TEE logs",
				});
			}
		},
	);

	/**
	 * @swagger
	 * /agent/start:
	 *   post:
	 *     summary: Start an agent
	 *     description: Starts the agent with the specified character
	 *     responses:
	 *       200:
	 *         description: Agent started successfully
	 */
	router.post("/agent/start", async (req, res) => {
		const { characterPath, characterJson } = req.body;
		console.log("characterPath:", characterPath);
		console.log("characterJson:", characterJson);
		try {
			let character: Character;
			if (characterJson) {
				character = await directClient.jsonToCharacter(
					characterPath,
					characterJson,
				);
			} else if (characterPath) {
				character = await directClient.loadCharacterTryPath(characterPath);
			} else {
				throw new Error("No character path or JSON provided");
			}
			await directClient.startAgent(character);
			elizaLogger.log(`${character.name} started`);

			res.json({
				id: character.id,
				character: character,
			});
		} catch (e) {
			elizaLogger.error(`Error parsing character: ${e}`);
			res.status(400).json({
				error: e.message,
			});
			return;
		}
	});

	/**
	 * @swagger
	 * /agents/{agentId}/stop:
	 *   post:
	 *     summary: Stop an agent
	 *     description: Stops the agent with the specified ID
	 *     responses:
	 *       200:
	 *         description: Agent stopped successfully
	 */
	router.post("/agents/:agentId/stop", async (req, res) => {
		const agentId = req.params.agentId;
		console.log("agentId", agentId);
		const agent: AgentRuntime = agents.get(agentId);

		// update character
		if (agent) {
			// stop agent
			agent.stop();
			directClient.unregisterAgent(agent);
			// if it has a different name, the agentId will change
			res.json({ success: true });
		} else {
			res.status(404).json({ error: "Agent not found" });
		}
	});

	/**
	 * @swagger
	 * /traces:
	 *   get:
	 *     summary: Fetch all traces
	 *     description: Retrieves all traces from the database.
	 *     responses:
	 *       200:
	 *         description: A JSON array of traces.
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 total_records:
	 *                   type: integer
	 *                 data:
	 *                   type: array
	 *                   items:
	 *                     type: object
	 *       500:
	 *         description: Server error
	 */
	router.get("/traces", async (req, res) => {
		getAllTraces(req, res);
	});

	/**
	 * @swagger
	 * /traces/unique-agent-ids:
	 *   get:
	 *     summary: Fetch all unique AgentId values
	 *     description: Retrieves a list of all unique agentId values from the traces table.
	 *     responses:
	 *       200:
	 *         description: A JSON array of unique agentId values.
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 unique_agentId:
	 *                   type: array
	 *                   items:
	 *                     type: string
	 *       500:
	 *         description: Server error
	 */
	router.get("/traces/unique-agent-ids", async (req, res) => {
		getUniqueAgentId(req, res);
	});

	/**
	 * @swagger
	 * /traces/unique-room_id/by-agent/{agent_id}:
	 *   get:
	 *     summary: Fetch unique RoomId values for a specific Agent ID
	 *     description: Retrieves a list of distinct RoomId values where the given agent_id exists in the traces table.
	 *     parameters:
	 *       - in: path
	 *         name: agent_id
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: The Agent ID to filter unique room_id.
	 *     responses:
	 *       200:
	 *         description: A JSON array of unique RUN values linked to the given agent_id.
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 agent_id:
	 *                   type: string
	 *                 unique_room_id:
	 *                   type: array
	 *                   items:
	 *                     type: string
	 *       400:
	 *         description: Missing or invalid Agent ID
	 *       500:
	 *         description: Server error
	 */
	router.get("/traces/unique-room_id/by-agent/:agent_id", async (req, res) => {
		getUniqueRoomIdByAgent(req, res);
	});

	/**
	 * @swagger
	 * /traces/by-room/{roomId}:
	 *   get:
	 *     summary: Fetch traces by ROOM ID
	 *     description: Retrieves traces filtered by a specific ROOM ID.
	 *     parameters:
	 *       - in: path
	 *         name: roomId
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: The ROOM ID to filter traces.
	 *       - in: query
	 *         name: name
	 *         schema:
	 *           type: string
	 *         description: Filter by name field (optional).
	 *       - in: query
	 *         name: start_date
	 *         schema:
	 *           type: string
	 *           format: date
	 *         description: Filter by start date (YYYY-MM-DD) (optional).
	 *       - in: query
	 *         name: end_date
	 *         schema:
	 *           type: string
	 *           format: date
	 *         description: Filter by end date (YYYY-MM-DD) (optional).
	 *     responses:
	 *       200:
	 *         description: A JSON array of traces for the specified ROOM ID.
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 room_id:
	 *                   type: string
	 *                 total_records:
	 *                   type: integer
	 *                 data:
	 *                   type: array
	 *                   items:
	 *                     type: object
	 *                     properties:
	 *                       id:
	 *                         type: integer
	 *                         description: Unique ID of the trace.
	 *                       room_id:
	 *                         type: string
	 *                         description: UUID of the ROOM.
	 *                       start_time:
	 *                         type: string
	 *                         format: date-time
	 *                         description: Start time of the trace event (YYYY-MM-DD HH:MM:SS).
	 *                       end_time:
	 *                         type: string
	 *                         format: date-time
	 *                         description: End time of the trace event (YYYY-MM-DD HH:MM:SS).
	 *                       name:
	 *                         type: string
	 *                         description: Name of the trace event.
	 *                       data:
	 *                         type: object
	 *                         description: JSON data associated with the trace event.
	 *       400:
	 *         description: Missing or invalid ROOM ID.
	 *       500:
	 *         description: Server error.
	 */
	router.get("/traces/by-room/:roomId", async (req, res) => {
		getTracesByRoom(req, res);
	});

	/**
	 * @swagger
	 * /traces/unique-runs:
	 *   get:
	 *     summary: Fetch all unique RUN values
	 *     description: Retrieves a list of all unique RUN values from the traces table.
	 *     responses:
	 *       200:
	 *         description: A JSON array of unique RUN values.
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 unique_room_ids:
	 *                   type: array
	 *                   items:
	 *                     type: string
	 *       500:
	 *         description: Server error
	 */
	router.get("/traces/unique-runs", async (req, res) => {
		getUniqueRuns(req, res);
	});

	/**
	 * @swagger
	 * /traces/by-agent/{agentId}:
	 *   get:
	 *     summary: Fetch traces by Agent ID
	 *     description: Retrieves traces filtered by a specific Agent ID with optional filters.
	 *     parameters:
	 *       - in: path
	 *         name: agentId
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: The Agent ID to filter traces.
	 *       - in: query
	 *         name: name
	 *         schema:
	 *           type: string
	 *         description: Filter by trace name (optional).
	 *       - in: query
	 *         name: start_date
	 *         schema:
	 *           type: string
	 *           format: date
	 *         description: Filter by start date (YYYY-MM-DD) (optional).
	 *       - in: query
	 *         name: end_date
	 *         schema:
	 *           type: string
	 *           format: date
	 *         description: Filter by end date (YYYY-MM-DD) (optional).
	 *     responses:
	 *       200:
	 *         description: A JSON array of traces for the specified Agent ID.
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 agent_id:
	 *                   type: string
	 *                   description: The Agent ID used for filtering.
	 *                 total_records:
	 *                   type: integer
	 *                   description: Total number of matching records.
	 *                 data:
	 *                   type: array
	 *                   items:
	 *                     type: object
	 *                     properties:
	 *                       id:
	 *                         type: integer
	 *                         description: Unique ID of the trace.
	 *                       run:
	 *                         type: string
	 *                         description: UUID of the RUN.
	 *                       time:
	 *                         type: string
	 *                         format: date-time
	 *                         description: Timestamp of the trace event.
	 *                       name:
	 *                         type: string
	 *                         description: Name of the trace event.
	 *                       data:
	 *                         type: object
	 *                         description: JSON data associated with the trace event.
	 *                       agentId:
	 *                         type: string
	 *                         nullable: true
	 *                         description: The agent ID associated with the trace.
	 *                       roomId:
	 *                         type: string
	 *                         nullable: true
	 *                         description: The room ID associated with the trace (optional).
	 *       400:
	 *         description: Missing or invalid Agent ID.
	 *       500:
	 *         description: Server error.
	 */
	router.get("/traces/by-agent/:agentId", async (req, res) => {
		getTracesByAgentId(req, res);
	});

	/**
	 * @swagger
	 * /templates/characters:
	 *   get:
	 *     summary: Fetch all characters
	 *     description: Retrieves a list of all characters.
	 */
	router.get("/templates/characters", async (req, res) => {
		getCharacters(req, res);
	});

	/**
	 * @swagger
	 * /templates/{characterName}:
	 *   get:
	 *     summary: Get all prompt templates for a character
	 *     description: Retrieves all saved prompt templates for the specified character.
	 *     parameters:
	 *       - in: path
	 *         name: characterName
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: The name of the character.
	 *     responses:
	 *       200:
	 *         description: Returns a list of all templates.
	 *       404:
	 *         description: Character not found.
	 */
	router.get("/templates/:characterName", async (req, res) => {
		console.log("get template called with request", req);
		getTemplates(req, res);
	});

	/**
	 * @swagger
	 * /templates/{characterName}:
	 *   post:
	 *     summary: Add a new prompt template
	 *     description: Creates a new prompt template and stores it in the character's JSON file.
	 *     parameters:
	 *       - in: path
	 *         name: characterName
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: The name of the character.
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             properties:
	 *               templateName:
	 *                 type: string
	 *               content:
	 *                 type: string
	 *     responses:
	 *       201:
	 *         description: Template added successfully.
	 *       400:
	 *         description: Invalid request body.
	 *       404:
	 *         description: Character not found.
	 */
	router.post("/templates/:characterName", async (req, res) => {
		addTemplate(req, res);
	});

	/**
	 * @swagger
	 * /templates/{characterName}:
	 *   put:
	 *     summary: Update an existing template
	 *     description: Modifies an existing template in the character JSON file.
	 *     parameters:
	 *       - in: path
	 *         name: characterName
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: The name of the character.
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             properties:
	 *               templateName:
	 *                 type: string
	 *               content:
	 *                 type: string
	 *     responses:
	 *       200:
	 *         description: Template updated successfully.
	 *       404:
	 *         description: Template or character not found.
	 */
	router.put("/templates/:characterName", async (req, res) => {
		updateTemplate(req, res);
	});

	/**
	 * @swagger
	 * /templates/{characterName}/{templateName}:
	 *   delete:
	 *     summary: Delete a template
	 *     description: Removes a prompt template from the character's JSON file.
	 *     parameters:
	 *       - in: path
	 *         name: characterName
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: The name of the character.
	 *       - in: path
	 *         name: templateName
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: The name of the template to delete.
	 *     responses:
	 *       200:
	 *         description: Template deleted successfully.
	 *       404:
	 *         description: Template or character not found.
	 */
	router.delete("/templates/:characterName/:templateName", async (req, res) => {
		deleteTemplate(req, res);
	});

	/**
	 * @swagger
	 * /templates/{characterName}/batch-update:
	 *   post:
	 *     summary: Batch update character data
	 *     description: Updates templates, lore, bio, and knowledge in a single API call.
	 *     parameters:
	 *       - in: path
	 *         name: characterName
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: The name of the character.
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             properties:
	 *               templates:
	 *                 type: object
	 *                 description: Templates to add or update.
	 *               lore:
	 *                 type: array
	 *                 items:
	 *                   type: string
	 *                 description: Lore entries to append.
	 *               bio:
	 *                 type: array
	 *                 items:
	 *                   type: string
	 *                 description: Bio entries to append.
	 *               knowledge:
	 *                 type: array
	 *                 items:
	 *                   type: string
	 *                 description: Knowledge entries to append.
	 *     responses:
	 *       200:
	 *         description: Character data updated successfully.
	 *       400:
	 *         description: No valid updates provided.
	 *       404:
	 *         description: Character not found.
	 */
	router.post("/templates/:characterName/batch-update", async (req, res) => {
		batchUpdateCharacterData(req, res);
	});

	/**
	 * @swagger
	 * /templates/{characterName}/batch-get:
	 *   get:
	 *     summary: Get all prompt templates for a character
	 *     description: Retrieves all saved prompt templates for the specified character.
	 *     parameters:
	 *       - in: path
	 *         name: characterName
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: The name of the character.
	 *     responses:
	 *       200:
	 *         description: Returns a list of all templates.
	 *       404:
	 *         description: Character not found.
	 */
	router.get("/templates/:characterName/batch-get", async (req, res) => {
		getCharacterData(req, res);
	});

	/**
	 * @swagger
	 * /templates/{characterName}/array-update/{arrayName}/{index}:
	 *   put:
	 *     summary: Update an element in a specific character array field.
	 *     description: Replace an element in one of the character's array fields (e.g., lore, bio, knowledge) with new text at the specified index.
	 *     tags:
	 *       - Character Data
	 *     parameters:
	 *       - in: path
	 *         name: characterName
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: The name of the character.
	 *       - in: path
	 *         name: arrayName
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: The name of the array field to update (e.g., "lore", "bio", "knowledge").
	 *       - in: path
	 *         name: index
	 *         required: true
	 *         schema:
	 *           type: integer
	 *           format: int32
	 *         description: The index of the element in the array to update.
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             properties:
	 *               newText:
	 *                 type: string
	 *                 description: The new text to replace the existing element.
	 *             required:
	 *               - newText
	 *     responses:
	 *       200:
	 *         description: Array element updated successfully.
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 message:
	 *                   type: string
	 *                 updatedArray:
	 *                   type: array
	 *                   items:
	 *                     type: string
	 *       400:
	 *         description: Invalid request parameters or input.
	 *       404:
	 *         description: Character not found or specified array field not found.
	 */
	router.put(
		"/templates/:characterName/array-update/:arrayName/:index",
		async (req, res) => {
			updateCharacterArrayElement(req, res);
		},
	);

	/**
	 * @swagger
	 * /templates/{characterName}/array-delete/{arrayName}/{index}:
	 *   delete:
	 *     summary: Delete an element from a specific character array field.
	 *     description: Remove an element from one of the character's array fields (e.g., "lore", "bio", or "knowledge") at the specified index.
	 *     tags:
	 *       - Character Data
	 *     parameters:
	 *       - in: path
	 *         name: characterName
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: The name of the character.
	 *       - in: path
	 *         name: arrayName
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: The name of the array field from which to delete the element (e.g., "lore", "bio", "knowledge").
	 *       - in: path
	 *         name: index
	 *         required: true
	 *         schema:
	 *           type: integer
	 *           format: int32
	 *         description: The index of the element in the array to delete.
	 *     responses:
	 *       200:
	 *         description: Array element deleted successfully.
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 message:
	 *                   type: string
	 *                 updatedArray:
	 *                   type: array
	 *                   items:
	 *                     type: string
	 *                 removedElement:
	 *                   type: array
	 *                   items:
	 *                     type: string
	 *       400:
	 *         description: Invalid request parameters or input.
	 *       404:
	 *         description: Character not found or specified array field not found.
	 */
	router.delete(
		"/templates/:characterName/array-delete/:arrayName/:index",
		async (req, res) => {
			deleteCharacterArrayElement(req, res);
		},
	);

	return router;
}
