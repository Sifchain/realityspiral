import { Request, Response } from "express";
import { db } from "../config/db";

export const getAllTraces = async (req: Request, res: Response) => {
    try {
        const data = await db.query("SELECT * FROM traces");
        res.status(200).json({ total_records: data.rowCount, data: data.rows });
    } catch (error: any) {
        console.error("❌ Error fetching traces:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

export const getUniqueAgentId = async (req: Request, res: Response) => {
    console.log("getUniqueAgentId called");
    try {
        const result = await db.query(
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

export const getUniqueRoomIdByAgent = async (req: Request, res: Response) => {
    try {
        const { agent_id } = req.params;
        if (!agent_id) {
            return res
                .status(400)
                .json({ message: "Missing or invalid Agent ID" });
        }

        // Query to fetch distinct run values where agent_id is provided
        const result = await db.query(
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

export const getTracesByRoom = async (req: Request, res: Response) => {
    try {
        const { roomId } = req.params;
        if (!roomId) {
            return res
                .status(400)
                .json({ message: "Missing or invalid ROOM ID" });
        }

        const { name, start_date, end_date } = req.query;

        let query = "SELECT * FROM traces WHERE room_id = $1";
        const queryParams: any[] = [roomId];

        let paramIndex = 2; // Next index for query placeholders ($2, $3, ...)

        // Optional Filters
        if (name) {
            query += ` AND name ILIKE $${paramIndex}`;
            queryParams.push(`%${name}%`);
            paramIndex++;
        }

        if (start_date && end_date) {
            query += ` AND DATE(start_time) >= $${paramIndex} AND DATE(end_time) <= $${paramIndex + 1}`;
            queryParams.push(start_date, end_date);
            paramIndex += 2;
        }

        // Order results by `start_time`
        query += " ORDER BY start_time DESC";

        const result = await db.query(query, queryParams);

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

export const getUniqueRuns = async (req: Request, res: Response) => {
    try {
        const result = await db.query("SELECT DISTINCT RUN FROM traces");
        res.status(200).json({
            unique_runs: result.rows.map((row) => row.run),
        });
    } catch (error: any) {
        console.error("❌ Error fetching unique RUN values:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

export const getTracesByAgentId = async (req: Request, res: Response) => {
    try {
        const { agentId } = req.params;
        if (!agentId) {
            return res
                .status(400)
                .json({ message: "Missing or invalid Agent ID" });
        }

        const { name, start_date, end_date, page, limit } = req.query;

        let query = 'SELECT * FROM traces WHERE "agentId" = $1';
        const queryParams: any[] = [agentId];

        let paramIndex = 2; // Next index for query placeholders ($2, $3, ...)

        // Optional Filters
        if (name) {
            query += ` AND name ILIKE $${paramIndex}`;
            queryParams.push(`%${name}%`);
            paramIndex++;
        }

        if (start_date && end_date) {
            query += ` AND DATE(time) BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
            queryParams.push(start_date, end_date);
            paramIndex += 2;
        }

        query += " ORDER BY id";

        // Pagination
        const pageNumber = page ? parseInt(page as string, 10) : 1;
        const pageSize = limit ? parseInt(limit as string, 10) : 20;
        const offset = (pageNumber - 1) * pageSize;

        query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        queryParams.push(pageSize, offset);

        const result = await db.query(query, queryParams);

        res.status(200).json({
            agent_id: agentId,
            total_records: result.rowCount ?? 0, // Ensure it always returns a number
            current_page: pageNumber,
            total_pages: Math.ceil((result.rowCount ?? 0) / pageSize),
            data: result.rows,
        });
    } catch (error: any) {
        console.error("❌ Error fetching traces by Agent ID:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};
