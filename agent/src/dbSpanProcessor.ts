import { elizaLogger } from "@elizaos/core";
import type {
	ReadableSpan,
	SpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import pg from "pg";

// Get PostgreSQL connection string
const postgresUrl =
	process.env.POSTGRES_URL ||
	"postgresql://user@localhost:5432/tracing_database";

// PostgreSQL database connection
let pgClient: pg.Client | null = null;

async function connectToDB() {
	try {
		pgClient = new pg.Client({ connectionString: postgresUrl });
		await pgClient.connect();
		elizaLogger.info(`✅ Connected to PostgreSQL database at ${postgresUrl}`);
		await createTracesTable(); // Ensure table exists before inserting spans
	} catch (error) {
		elizaLogger.error(`❌ Failed to connect to PostgreSQL database: ${error}`);
		throw error;
	}
}

// Create the traces table if it doesn't exist
async function createTracesTable(): Promise<void> {
	if (!pgClient) return;
	const createTableQuery = `
      CREATE TABLE IF NOT EXISTS traces (
        id SERIAL PRIMARY KEY,
        trace_id TEXT NOT NULL,
        span_id TEXT NOT NULL,
        parent_span_id TEXT,
        trace_state TEXT,
        span_name TEXT NOT NULL,
        span_kind INTEGER,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        duration_ms INTEGER NOT NULL,
        status_code INTEGER,
        status_message TEXT,
        attributes JSONB,
        events JSONB,
        links JSONB,
        resource JSONB,
        agent_id TEXT,
        session_id TEXT,
        environment TEXT,
        room_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(trace_id, span_id)
      );
    `;

	try {
		await pgClient.query(createTableQuery);
		elizaLogger.info("✅ PostgreSQL traces table created or already exists");
	} catch (error) {
		elizaLogger.error("❌ Error creating traces table in PostgreSQL:", error);
		throw error;
	}
}

interface SpanData {
	trace_id: string;
	span_id: string;
	parent_span_id?: string | null;
	trace_state?: string | null;
	span_name: string;
	span_kind: number;
	start_time: string;
	end_time: string;
	duration_ms: number;
	status_code: number;
	status_message?: string | null;
	attributes?: Record<string, unknown>;
	events?: unknown[];
	links?: unknown[];
	resource?: Record<string, unknown>;
	agent_id?: string | null;
	session_id?: string | null;
	environment?: string | null;
	room_id?: string | null;
}

// Inserts a span record into the database
async function insertTrace(spanData: SpanData): Promise<void> {
	if (!pgClient) {
		elizaLogger.error("❌ Database connection is not initialized.");
		return;
	}

	const query = `
      INSERT INTO traces (
        trace_id,
        span_id,
        parent_span_id,
        trace_state,
        span_name,
        span_kind,
        start_time,
        end_time,
        duration_ms,
        status_code,
        status_message,
        attributes,
        events,
        links,
        resource,
        agent_id,
        session_id,
        environment,
        room_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      ON CONFLICT (trace_id, span_id) DO NOTHING;
    `;

	try {
		await pgClient.query(query, [
			spanData.trace_id,
			spanData.span_id,
			spanData.parent_span_id ?? null,
			spanData.trace_state ?? null,
			spanData.span_name,
			spanData.span_kind,
			spanData.start_time,
			spanData.end_time,
			spanData.duration_ms,
			spanData.status_code,
			spanData.status_message ?? null,
			JSON.stringify(spanData.attributes || {}),
			JSON.stringify(spanData.events || []),
			JSON.stringify(spanData.links || []),
			JSON.stringify(spanData.resource || {}),
			spanData.agent_id ?? null,
			spanData.session_id ?? null,
			spanData.environment ?? null,
			spanData.room_id ?? null,
		]);

		elizaLogger.info(
			"✅ Span inserted successfully into PostgreSQL:",
			spanData.span_name,
		);
	} catch (error) {
		elizaLogger.error("❌ Error inserting span into PostgreSQL DB:", error);
	}
}

export class DBSpanProcessor implements SpanProcessor {
	constructor() {
		connectToDB();
	}

	onStart(span: ReadableSpan): void {
		elizaLogger.debug("🟢 Span started:", span.name);
	}

	onEnd(span: ReadableSpan): void {
		const spanContext = span.spanContext();
		const startTimeMs = span.startTime[0] * 1000 + span.startTime[1] / 1e6;
		const endTimeMs = span.endTime[0] * 1000 + span.endTime[1] / 1e6;
		const durationMs = Math.floor(endTimeMs - startTimeMs);

		const attributes = span.attributes || {};
		const resource = span.resource?.attributes || {};

		const safeTrim = (value: unknown): string | null => {
			if (typeof value !== "string") return null;
			const trimmed = value.trim();
			return trimmed.length > 0 ? trimmed : null;
		};

		const spanData: SpanData = {
			trace_id: spanContext.traceId,
			span_id: spanContext.spanId,
			parent_span_id: span.parentSpanId || null,
			span_name: span.name,
			span_kind: span.kind,
			start_time: new Date(startTimeMs).toISOString(),
			end_time: new Date(endTimeMs).toISOString(),
			duration_ms: durationMs,
			status_code: span.status.code,
			status_message: span.status.message || null,
			attributes: attributes,
			events: span.events || [],
			links: span.links || [],
			resource: resource,
			agent_id:
				safeTrim(attributes["agent.id"]) || safeTrim(attributes.agentId),
			session_id:
				safeTrim(attributes["session.id"]) || safeTrim(attributes.sessionId),
			environment:
				safeTrim(attributes.environment) ||
				safeTrim(resource["deployment.environment"]) ||
				process.env.NODE_ENV ||
				"development",
			room_id: safeTrim(attributes["room.id"]) || safeTrim(attributes.roomId),
		};

		if (!spanData.agent_id && !spanData.session_id && !spanData.room_id) {
			elizaLogger.debug("⚠️ Skipping span with no context IDs:", span.name);
			return;
		}

		elizaLogger.debug("🟡 Span ended, inserting:", span.name);
		insertTrace(spanData);
	}

	async shutdown(): Promise<void> {
		if (pgClient) {
			await pgClient.end();
			elizaLogger.info("✅ PostgreSQL database connection closed");
		}
	}

	forceFlush(): Promise<void> {
		return Promise.resolve();
	}
}
