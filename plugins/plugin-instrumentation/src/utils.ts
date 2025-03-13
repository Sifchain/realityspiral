import type { State } from "@elizaos/core";
import { Instrumentation } from "./instrumentation";

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export const traceResult = (state: State, result: any) => {
	if (process.env.INSTRUMENTATION_ENABLED !== "true") {
		return result;
	}

	const instrument = Instrumentation.getInstance();

	instrument.logEvent({
		stage: "Result",
		subStage: "Trace",
		event: "trace_result",
		data: {
			roomId: (state.roomId as string) || "unknown",
			result: JSON.stringify(result) || result,
		},
	});

	return result;
};
