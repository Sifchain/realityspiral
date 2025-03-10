import type { Request, Response } from "express";
import pkg from "pg";

const { Pool } = pkg;

const pool = new Pool({
	connectionString:
		process.env.POSTGRES_URL ||
		"postgresql://user@localhost:5432/tracing_database",
});

export const getAllTraces = async (_req: Request, res: Response) => {
	try {
		const { rows } = await pool.query("SELECT * FROM traces");
		res.status(200).json(rows);
	} catch (error: unknown) {
		console.error("Error fetching traces:", error);
		res.status(500).json({ error: "Failed to fetch traces" });
	}
};

export const getUniqueAgentId = async (_req: Request, res: Response) => {
	console.log("getUniqueAgentId called");
	try {
		const result = await pool.query(
			"SELECT DISTINCT agent_id FROM traces WHERE agent_id IS NOT NULL",
		);
		res.status(200).json({
			unique_agent_ids: result.rows.map((row) => row.agent_id),
		});
	} catch (error: unknown) {
		console.error("❌ Error fetching unique agent IDs:", error);
		res
			.status(500)
			.json({ message: "Server Error", error: (error as Error).message });
	}
};

export const getUniqueRoomIdByAgent = async (req: Request, res: Response) => {
	try {
		const { agent_id } = req.params;
		if (!agent_id) {
			return res.status(400).json({ message: "Missing or invalid Agent ID" });
		}

		const result = await pool.query(
			`SELECT DISTINCT ON ("room_id") "room_id", "start_time" 
      FROM traces 
      WHERE "agent_id" = $1 AND "room_id" IS NOT NULL AND "room_id" != 'unknown'
      ORDER BY "room_id", "start_time" DESC`,
			[agent_id],
		);

		res.status(200).json({
			agent_id,
			rooms: result.rows.map((row) => ({
				room_id: row.room_id,
				start_time: row.start_time,
			})),
		});
	} catch (error: unknown) {
		console.error("❌ Error fetching unique rooms by Agent ID:", error);
		res
			.status(500)
			.json({ message: "Server Error", error: (error as Error).message });
	}
};

export const getTracesByRoom = async (req: Request, res: Response) => {
	try {
		const { roomId } = req.params;
		if (!roomId) {
			return res.status(400).json({ message: "Missing or invalid ROOM ID" });
		}

		const { name, start_date, end_date } = req.query;

		let query = "SELECT * FROM traces WHERE room_id = $1";
		const queryParams: unknown[] = [roomId];

		let paramIndex = 2; // Next index for query placeholders ($2, $3, ...)

		// Optional Filters
		if (typeof name === "string") {
			query += ` AND name ILIKE $${paramIndex}`;
			queryParams.push(`%${name}%`);
			paramIndex++;
		}

		if (typeof start_date === "string" && typeof end_date === "string") {
			query += ` AND DATE(start_time) >= $${paramIndex} AND DATE(end_time) <= $${paramIndex + 1}`;
			queryParams.push(start_date, end_date);
			paramIndex += 2;
		}

		// Order results by `start_time`
		query += " ORDER BY start_time ASC";

		const result = await pool.query(query, queryParams);

		res.status(200).json({
			room_id: roomId,
			total_records: result.rowCount ?? 0,
			data: result.rows,
		});
	} catch (error: unknown) {
		console.error("❌ Error fetching traces by ROOM:", error);
		res
			.status(500)
			.json({ message: "Server Error", error: (error as Error).message });
	}
};

export const getUniqueRuns = async (_req: Request, res: Response) => {
	try {
		const result = await pool.query("SELECT DISTINCT run FROM traces");
		res.status(200).json({
			unique_runs: result.rows.map((row) => row.run),
		});
	} catch (error: unknown) {
		console.error("❌ Error fetching unique RUN values:", error);
		res
			.status(500)
			.json({ message: "Server Error", error: (error as Error).message });
	}
};

export const getTracesByAgentId = async (req: Request, res: Response) => {
	try {
		const { agentId } = req.params;
		if (!agentId) {
			return res.status(400).json({ message: "Missing or invalid Agent ID" });
		}

		const result = await pool.query(
			"SELECT * FROM traces WHERE agent_id = $1",
			[agentId],
		);

		res.status(200).json({
			agent_id: agentId,
			total_records: result.rowCount ?? 0,
			data: result.rows,
		});
	} catch (error: unknown) {
		console.error("❌ Error fetching traces by Agent ID:", error);
		res
			.status(500)
			.json({ message: "Server Error", error: (error as Error).message });
	}
};
