import { useEffect, useState } from "react";
import { Label } from "../label";
import { use } from "./hooks";

function Logs() {
    const {
        uniqueAgents,
        traceData,
        loading,
        error,
        fetchUniqueAgents,
        fetchTraceData,
        fetchRoomsByAgent,
        uniqueRooms,
        selectedAgent,
        setSelectedAgent,
        selectedRoom,
        setSelectedRoom,
    } = use();

    // Get today's date in YYYY-MM-DD format
    const getFormattedDate = (daysAgo = 0) => {
        const date = new Date();
        date.setDate(date.getDate() - daysAgo);
        return date.toISOString().split("T")[0];
    };

    // State for filters (start_date is set to 7 days ago, end_date is today)
    const [filters, setFilters] = useState({
        name: "",
        start_date: getFormattedDate(7), // 7 days ago
        end_date: getFormattedDate(0), // Today
    });

    useEffect(() => {
        fetchUniqueAgents();
    }, []);

    return (
        <div className="flex flex-col p-6 h-[100vh]">
            {/* Filter Section at the Top */}
            <div className="p-4 rounded-lg bg-[#161616] shadow-lg sticky top-0">
                <Label className="text-white text-lg font-semibold">
                    Filters
                </Label>
                <div className="grid grid-cols-4 gap-4 mt-2">
                    {/* Agent Dropdown */}
                    <div className="relative">
                        <label className="block text-white text-sm font-medium mb-1">
                            Select Agent
                        </label>
                        <select
                            className="appearance-none w-full p-3 pl-4 pr-10 bg-gray-800 text-white border border-gray-600 rounded-lg shadow-lg
            focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 ease-in-out cursor-pointer"
                            value={
                                selectedAgent ||
                                (uniqueAgents.length > 0 ? uniqueAgents[0] : "")
                            }
                            onChange={(e) => {
                                const agentId = e.target.value;
                                setSelectedAgent(agentId);
                                fetchRoomsByAgent(agentId); // Fetch rooms when agent changes
                            }}
                        >
                            <option value="" disabled className="text-gray-400">
                                Select an Agent
                            </option>
                            {uniqueAgents.map((agent, index) => (
                                <option
                                    key={index}
                                    value={agent}
                                    className="text-gray-900"
                                >
                                    {agent}
                                </option>
                            ))}
                        </select>

                        {/* Dropdown Icon */}
                        <div className="absolute top-10 right-3 transform -translate-y-1/2 pointer-events-none">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-5 w-5 text-gray-400"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                            >
                                <path
                                    fillRule="evenodd"
                                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                                    clipRule="evenodd"
                                />
                            </svg>
                        </div>
                    </div>

                    {/* Start Date */}
                    <div>
                        <label className="block text-white text-sm font-medium mb-1">
                            Start Date
                        </label>
                        <input
                            type="date"
                            className="p-2 rounded-lg bg-gray-800 text-white border border-gray-600 w-full"
                            value={filters.start_date}
                            onChange={(e) =>
                                setFilters({
                                    ...filters,
                                    start_date: e.target.value,
                                })
                            }
                        />
                    </div>

                    {/* End Date */}
                    <div>
                        <label className="block text-white text-sm font-medium mb-1">
                            End Date
                        </label>
                        <input
                            type="date"
                            className="p-2 rounded-lg bg-gray-800 text-white border border-gray-600 w-full"
                            value={filters.end_date}
                            onChange={(e) =>
                                setFilters({
                                    ...filters,
                                    end_date: e.target.value,
                                })
                            }
                        />
                    </div>

                    {/* Apply Filters Button */}
                    <div className="flex items-end">
                        <button
                            className="px-4 mb-2 py-2 w-full bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition"
                            onClick={() =>
                                fetchTraceData(selectedRoom, filters)
                            }
                            disabled={!selectedRoom}
                        >
                            Apply Filters
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex flex-grow h-full overflow-hidden mt-4">
                {/* Left: Unique Room List (Scrollable) */}
                <div className="w-1/3 p-4 rounded-lg shadow-lg overflow-y-auto h-full">
                    <Label className="text-xl font-semibold text-white">
                        Unique Rooms
                    </Label>

                    {loading && (
                        <div className="flex justify-center items-center mt-4">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                        </div>
                    )}

                    {error && (
                        <div className="mt-4 p-3 bg-red-500 text-white text-sm rounded-lg">
                            ❌ Error: {error}
                        </div>
                    )}

                    <div className="mt-4 grid grid-cols-1 gap-4 text-xs">
                        {uniqueRooms.map((room, index) => (
                            <div
                                key={index}
                                onClick={() => {
                                    setSelectedRoom(room);
                                    fetchTraceData(room, filters);
                                }}
                                className={`p-4 bg-gray-800 rounded-lg shadow-md hover:shadow-xl transition duration-300 cursor-pointer ${
                                    selectedRoom === room
                                        ? "border-2 border-blue-500"
                                        : ""
                                }`}
                            >
                                <p className="text-white font-medium">{room}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Trace Details (Scrollable) */}
                {selectedRoom && (
                    <div className="w-2/3 p-4 rounded-lg shadow-lg overflow-y-auto h-full">
                        <Label className="text-xl font-semibold text-white">
                            {`Traces for Room: ${selectedRoom}`}
                        </Label>

                        {loading && (
                            <p className="mt-4 text-white">Loading traces...</p>
                        )}

                        {traceData.length > 0 ? (
                            <ul className="mt-4 space-y-4">
                                {traceData.map((trace, index) => (
                                    <li
                                        key={index}
                                        className="p-4 bg-gray-700 rounded-lg shadow-md"
                                    >
                                        <p className="text-gray-300 font-semibold">
                                            Trace ID:{" "}
                                            <span className="text-white">
                                                {trace.trace_id}
                                            </span>
                                        </p>
                                        <p className="text-gray-300 font-semibold">
                                            Span Name:{" "}
                                            <span className="text-white">
                                                {trace.span_name}
                                            </span>
                                        </p>
                                        <p className="text-gray-300 font-semibold">
                                            Start Time:{" "}
                                            <span className="text-white">
                                                {new Date(
                                                    trace.start_time
                                                ).toLocaleString()}
                                            </span>
                                        </p>
                                        <p className="text-gray-300 font-semibold">
                                            End Time:{" "}
                                            <span className="text-white">
                                                {new Date(
                                                    trace.end_time
                                                ).toLocaleString()}
                                            </span>
                                        </p>
                                        <p className="text-gray-300 font-semibold">
                                            Duration (ms):{" "}
                                            <span className="text-white">
                                                {trace.duration_ms}
                                            </span>
                                        </p>
                                        <p className="text-gray-300 font-semibold">
                                            Agent ID:{" "}
                                            <span className="text-white">
                                                {trace.agent_id}
                                            </span>
                                        </p>
                                        <p className="text-gray-300 font-semibold">
                                            Session ID:{" "}
                                            <span className="text-white">
                                                {trace.session_id}
                                            </span>
                                        </p>
                                        <p className="text-gray-300 font-semibold">
                                            Attributes:
                                        </p>
                                        <pre className="text-white bg-gray-900 p-2 rounded-md overflow-x-auto text-sm">
                                            {JSON.stringify(
                                                trace.attributes,
                                                null,
                                                2
                                            )}
                                        </pre>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="mt-4 text-gray-400">
                                No trace data available.
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default Logs;
