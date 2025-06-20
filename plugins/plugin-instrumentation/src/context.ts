import {
	type State,
	type TemplateType,
	composeContext as originalComposeContext,
} from "@elizaos/core";
import { Instrumentation } from "./instrumentation";

// Wrap the composeContext method to track context composition
export const composeContext = ({
	state,
	template,
	templatingEngine = "handlebars",
}: {
	state: State;
	template: TemplateType;
	templatingEngine?: "handlebars";
}) => {
	let instrument: Instrumentation;

	if (process.env.INSTRUMENTATION_ENABLED === "true") {
		instrument = Instrumentation.getInstance();
	}

	const startTime = Date.now();
	try {
		// Call the original method
		const output = originalComposeContext({
			state,
			template,
			templatingEngine,
		}) as string;

		if (process.env.INSTRUMENTATION_ENABLED === "true") {
			// Log state composition
			instrument.logEvent({
				stage: "Context",
				subStage: "Composition",
				event: "context_composition_completed",
				data: {
					processingTime: Date.now() - startTime,
					roomId: (state.roomId as string) || "unknown",
					inputState: JSON.stringify(state),
					inputTemplate: template,
					inputTemplatingEngine: templatingEngine,
					output,
				},
			});
		}

		return output;
	} catch (error) {
		if (process.env.INSTRUMENTATION_ENABLED === "true") {
			// Log state composition error
			instrument.logEvent({
				stage: "Context",
				subStage: "Error",
				event: "context_composition_error",
				data: {
					error: (error as Error).message,
					processingTime: Date.now() - startTime,
					roomId: (state.roomId as string) || "unknown",
					inputState: JSON.stringify(state),
				},
			});
		}
		throw error;
	}
};
