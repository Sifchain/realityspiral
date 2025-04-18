import { getServerUrl } from "@/lib/serverUrl";
import { useState } from "react";

export const use = () => {
	type Room = {
		room_id: string;
		start_time: string;
	};

	const API_BASE_URL = `${getServerUrl()}/traces`;

	const [uniqueAgents, setUniqueAgents] = useState<string[]>([]);
	const [uniqueRooms, setUniqueRooms] = useState<Room[]>([]); // biome-ignore lint/suspicious/noExplicitAny: <explanation>
	const [traceData, setTraceData] = useState<any[]>([]);
	const [loading, setLoading] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);
	const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
	const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

	// Fetch all unique agent IDs
	const fetchUniqueAgents = async () => {
		setLoading(true);
		try {
			const response = await fetch(`${API_BASE_URL}/unique-agent-ids`);
			if (!response.ok)
				throw new Error(`HTTP error! Status: ${response.status}`);
			const data = await response.json();
			setUniqueAgents(data.unique_agent_ids || []);

			fetchRoomsByAgent(data.unique_agent_ids[0]);
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		} catch (err: any) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	};

	// Fetch room IDs by agent ID
	const fetchRoomsByAgent = async (agentId: string) => {
		setLoading(true);
		try {
			const response = await fetch(
				`${API_BASE_URL}/unique-room_id/by-agent/${agentId}`,
			);
			if (!response.ok)
				throw new Error(`HTTP error! Status: ${response.status}`);
			const data = await response.json();
			setUniqueRooms(data.rooms || []);
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		} catch (err: any) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	};

	// Fetch trace data by selected room ID and filters
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	const fetchTraceData = async (roomId: string | null, filters: any) => {
		if (!roomId) return;
		setLoading(true);
		setSelectedRoom(roomId);
		try {
			const queryParams = new URLSearchParams({
				...(filters.name && { name: filters.name }),
				...(filters.start_date && { start_date: filters.start_date }),
				...(filters.end_date && { end_date: filters.end_date }),
			});

			const response = await fetch(
				`${API_BASE_URL}/by-room/${roomId}?${queryParams.toString()}`,
			);
			if (!response.ok)
				throw new Error(`HTTP error! Status: ${response.status}`);
			const data = await response.json();
			setTraceData(data.data || []);
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		} catch (err: any) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	};

	return {
		uniqueAgents,
		uniqueRooms,
		traceData,
		loading,
		error,
		fetchUniqueAgents,
		fetchRoomsByAgent,
		fetchTraceData,
		selectedRoom,
		setSelectedRoom,
		selectedAgent,
		setSelectedAgent,
	};
};
