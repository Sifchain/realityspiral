import { elizaLogger } from "@elizaos/core";
import { v4 as uuidv4 } from "uuid";
import { Instrumentation, instrument } from "./instrumentation";

// Initialize logging
elizaLogger.info(`Testing instrumentation system with PostgreSQL...`);

// Generate unique IDs for testing
const sessionId = uuidv4();
const agentId = uuidv4();
const roomId = uuidv4();

// Log the test session start
elizaLogger.info(`Test session initialized with:
  Session ID: ${sessionId}
  Agent ID: ${agentId}
  Room ID: ${roomId}
`);

async function runTest() {
	try {
		// Session start event
		instrument.sessionStart({
			sessionId,
			agentId,
			roomId,
			characterName: "TestCharacter",
			environment: "test",
			platform: "node-test-runner",
		});

		// Short delay to simulate processing time
		await new Promise((resolve) => setTimeout(resolve, 200));

		// Message received event
		const testMessage = "Hello, this is a test message";
		instrument.messageReceived({
			message: testMessage,
			sessionId,
			agentId,
			roomId,
		});

		// Short delay to simulate processing time
		await new Promise((resolve) => setTimeout(resolve, 500));

		// Message processed event
		const messageId = uuidv4();
		instrument.messageProcessed({
			messageId,
			sessionId,
			agentId,
			processingTime: 500,
		});

		// Give some time for async processing to complete
		await new Promise((resolve) => setTimeout(resolve, 1000));

		elizaLogger.info(
			`Test completed successfully! Check PostgreSQL database for logs with session ID: ${sessionId}`,
		);
	} catch (error) {
		elizaLogger.error(`Test failed: ${error.message}`);
		process.exit(1);
	}
}

// Run the test
runTest();
