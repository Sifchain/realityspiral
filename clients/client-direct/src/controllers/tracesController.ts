import { Request, Response } from "express";
import pkg from "pg";

const { Pool } = pkg;

const pool = new Pool({
	connectionString:
		process.env.POSTGRES_URL ||
		"postgresql://softwareengineer-frontend@localhost:5432/tracing_database",
});


export const getAllTraces = async (req: Request, res: Response) => {
    try {
        const { rows } = await pool.query("SELECT * FROM traces");
        res.status(200).json(rows);
    } catch (error) {
        console.error("Error fetching traces:", error);
        res.status(500).json({ error: "Failed to fetch traces" });
    }
};

/**
 * @swagger
 * /traces/unique-agent-ids:
 *   get:
 *     summary: Get unique agent IDs
 *     description: Retrieves a list of unique agent IDs from traces.
 *     responses:
 *       200:
 *         description: Successfully retrieved unique agent IDs
 *       500:
 *         description: Server error
 */
export const getUniqueAgentId = async (req: Request, res: Response) => {
    console.log("getUniqueAgentId called");
    try {
        const result = await pool.query(
            "SELECT DISTINCT agent_id FROM traces WHERE agent_id IS NOT NULL"
        );
        res.status(200).json({
            unique_agent_ids: result.rows.map((row) => row.agent_id),
        });
    } catch (error: any) {
        console.error("❌ Error fetching unique agent IDs:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

/**
 * @swagger
 * /traces/unique-room_id/by-agent/{agent_id}:
 *   get:
 *     summary: Get unique room IDs by Agent ID
 *     description: Retrieves unique room IDs associated with a specific agent ID.
 *     parameters:
 *       - in: path
 *         name: agent_id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the agent
 *     responses:
 *       200:
 *         description: Successfully retrieved unique room IDs
 *       400:
 *         description: Missing or invalid Agent ID
 *       500:
 *         description: Server error
 */
export const getUniqueRoomIdByAgent = async (req: Request, res: Response) => {
    try {
        const { agent_id } = req.params;
        if (!agent_id) {
            return res.status(400).json({ message: "Missing or invalid Agent ID" });
        }

        const result = await pool.query(
            'SELECT DISTINCT "room_id" FROM traces WHERE "agent_id" = $1 AND "room_id" IS NOT NULL',
            [agent_id]
        );

        res.status(200).json({
            agent_id: agent_id,
            unique_room_ids: result.rows.map((row) => row.room_id),
        });
    } catch (error: any) {
        console.error("❌ Error fetching unique runs by Agent ID:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

/**
 * @swagger
 * /traces/by-room/{roomId}:
 *   get:
 *     summary: Get traces by Room ID
 *     description: Retrieves all traces associated with a given Room ID.
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *         description: The Room ID
 *     responses:
 *       200:
 *         description: Successfully retrieved traces
 *       400:
 *         description: Missing or invalid ROOM ID
 *       500:
 *         description: Server error
 */
export const getTracesByRoom = async (req: Request, res: Response) => {
    try {
        const { roomId } = req.params;
        if (!roomId) {
            return res.status(400).json({ message: "Missing or invalid ROOM ID" });
        }

        const result = await pool.query("SELECT * FROM traces WHERE room_id = $1", [roomId]);

        res.status(200).json({
            room_id: roomId,
            total_records: result.rowCount ?? 0,
            data: result.rows,
        });
    } catch (error: any) {
        console.error("❌ Error fetching traces by ROOM:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

/**
 * @swagger
 * /traces/unique-runs:
 *   get:
 *     summary: Get unique run values
 *     description: Retrieves all unique run values from traces.
 *     responses:
 *       200:
 *         description: Successfully retrieved unique run values
 *       500:
 *         description: Server error
 */
export const getUniqueRuns = async (req: Request, res: Response) => {
    try {
        const result = await pool.query("SELECT DISTINCT RUN FROM traces");
        res.status(200).json({
            unique_runs: result.rows.map((row) => row.run),
        });
    } catch (error: any) {
        console.error("❌ Error fetching unique RUN values:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

/**
 * @swagger
 * /traces/by-agent/{agentId}:
 *   get:
 *     summary: Get traces by Agent ID
 *     description: Retrieves traces associated with a given Agent ID.
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the agent
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Optional filter by trace name
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date filter
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *         description: End date filter
 *     responses:
 *       200:
 *         description: Successfully retrieved traces
 *       400:
 *         description: Missing or invalid Agent ID
 *       500:
 *         description: Server error
 */
export const getTracesByAgentId = async (req: Request, res: Response) => {
    try {
        const { agentId } = req.params;
        if (!agentId) {
            return res.status(400).json({ message: "Missing or invalid Agent ID" });
        }

        const result = await pool.query('SELECT * FROM traces WHERE "agentId" = $1', [agentId]);

        res.status(200).json({
            agent_id: agentId,
            total_records: result.rowCount ?? 0,
            data: result.rows,
        });
    } catch (error: any) {
        console.error("❌ Error fetching traces by Agent ID:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};
