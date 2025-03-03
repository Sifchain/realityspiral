import { elizaLogger } from "@elizaos/core";
import pg from "pg";

// Get PostgreSQL connection string
const postgresUrl =
	process.env.POSTGRES_URL ||
	"postgresql://user@localhost:5432/tracing_database";

async function checkTraceLogs() {
	let pgClient: pg.Client | null = null;

	try {
		// Connect to PostgreSQL
		pgClient = new pg.Client({
			connectionString: postgresUrl,
		});
		await pgClient.connect();
		elizaLogger.info(`✅ Connected to PostgreSQL database at ${postgresUrl}`);

		// Check if traces table exists
		const tableCheckQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'traces'
      );
    `;
		const tableExists = await pgClient.query(tableCheckQuery);

		if (tableExists.rows[0].exists) {
			elizaLogger.info("✅ Traces table exists in the PostgreSQL database");

			// Query recent traces with proper JSONB extraction
			const tracesQuery = `
        SELECT 
          trace_id, 
          span_id, 
          span_name, 
          start_time, 
          end_time, 
          duration_ms,
          attributes->>'session_id' as session_id,
          attributes->>'agent_id' as agent_id
        FROM traces 
        ORDER BY start_time DESC 
        LIMIT 20;
      `;

			const traces = await pgClient.query(tracesQuery);

			elizaLogger.info(
				`Found ${traces.rows.length} trace records in the database.`,
			);

			// Display the traces
			if (traces.rows.length > 0) {
				traces.rows.forEach((trace, index) => {
					const timestamp = new Date(trace.start_time).toISOString();
					elizaLogger.info(
						`Trace ${index + 1}: ${trace.span_name} - Session: ${trace.session_id || "unknown"} - Agent: ${trace.agent_id || "unknown"} - Time: ${timestamp}`,
					);
				});
			} else {
				elizaLogger.warn("No traces found in the database.");
			}
		} else {
			elizaLogger.error(
				"❌ Traces table does not exist in the PostgreSQL database",
			);
		}
	} catch (error) {
		elizaLogger.error(`❌ Error checking trace logs: ${error}`);
	} finally {
		// Close the PostgreSQL connection
		if (pgClient) {
			await pgClient.end();
			elizaLogger.info("PostgreSQL database connection closed.");
		}
	}
}

// Run the check
checkTraceLogs();
