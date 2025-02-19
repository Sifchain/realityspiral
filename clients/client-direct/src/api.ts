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
import { setupSwagger } from "./config/swagger.ts";
import {
	addTemplate,
	batchUpdateCharacterData,
	deleteTemplate,
	getTemplates,
	updateTemplate,
} from "./controllers/templateController";
import {
	getAllTraces,
	getTracesByAgentId,
	getTracesByRoom,
	getUniqueAgentId,
	getUniqueRoomIdByAgent,
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

	router.get("/webhook/coinbase/health", (_req, res) => {
		elizaLogger.info("Health check received");
		res.status(200).json({ status: "ok" });
	});

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

	router.get("/", (_req, res) => {
		res.send("Welcome, this is the REST API!");
	});

	router.get("/hello", (_req, res) => {
		res.json({ message: "Hello World!" });
	});

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

	router.get("/agents", (_req, res) => {
		const agentsList = Array.from(agents.values()).map((agent) => ({
			id: agent.agentId,
			name: agent.character.name,
			clients: Object.keys(agent.clients),
		}));
		res.json({ agents: agentsList });
	});

	router.get("/storage", async (_req, res) => {
		try {
			const uploadDir = path.join(process.cwd(), "data", "characters");
			const files = await fs.promises.readdir(uploadDir);
			res.json({ files });
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	});

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

	router.get("/agents/:agentId/:roomId/memories", async (req, res) => {
		const { agentId, roomId } = validateUUIDParams(req.params, res) ?? {
			agentId: null,
			roomId: null,
		};
		if (!agentId || !roomId) return;

		await getMemories(agentId, roomId, null, req, res);
	});

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

	router.get("/traces", async (req, res) => {
		getAllTraces(req, res);
	});

	router.get("/traces/unique-agent-ids", async (req, res) => {
		getUniqueAgentId(req, res);
	});

	router.get("/traces/unique-room_id/by-agent/:agent_id", async (req, res) => {
		getUniqueRoomIdByAgent(req, res);
	});

	router.get("/traces/by-room/:roomId", async (req, res) => {
		getTracesByRoom(req, res);
	});

	router.get("/traces/by-agent/:agentId", async (req, res) => {
		getTracesByAgentId(req, res);
	});

	router.get("/templates/:characterName", async (req, res) => {
		console.log("get template called with request", req);
		getTemplates(req, res);
	});

	router.post("/templates/:characterName", async (req, res) => {
		addTemplate(req, res);
	});

	router.put("/templates/:characterName", async (req, res) => {
		updateTemplate(req, res);
	});

	router.delete("/templates/:characterName/:templateName", async (req, res) => {
		deleteTemplate(req, res);
	});

	router.post("/templates/:characterName/batch-update", async (req, res) => {
		batchUpdateCharacterData(req, res);
	});

	return router;
}
