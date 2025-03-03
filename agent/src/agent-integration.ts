import { AgentRuntime } from './agent-runtime';
import { Instrumentation, instrument } from './instrumentation';
import { elizaLogger } from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';

/**
 * Agent class that wraps AgentRuntime and adds instrumentation
 */
class Agent {
  private runtime: AgentRuntime;
  private agentId: string;
  private sessionId: string;
  private roomId: string;
  private model: string;
  private memory: string[] = [];

  constructor(
    agentId: string = uuidv4(),
    sessionId: string = uuidv4(),
    roomId: string = uuidv4(),
    model: string = 'gpt-4'
  ) {
    this.agentId = agentId;
    this.sessionId = sessionId;
    this.roomId = roomId;
    this.model = model;
    
    // Initialize the runtime
    this.runtime = new AgentRuntime();
    
    // Log agent creation using the instrumentation singleton
    elizaLogger.info(`Agent created: ${this.agentId}`);
    
    // Log session start via instrumentation
    instrument.sessionStart({
      sessionId: this.sessionId,
      agentId: this.agentId,
      roomId: this.roomId,
      characterName: 'Agent',
      environment: process.env.NODE_ENV || 'development',
      platform: 'agent-integration',
    });
    
    elizaLogger.info(`Agent ${this.agentId} created with instrumentation`);
  }

  /**
   * Process a message from the user
   */
  async processMessage(message: string): Promise<string> {
    // Log message received
    instrument.messageReceived({
      message,
      sessionId: this.sessionId,
      agentId: this.agentId,
      roomId: this.roomId
    });

    // Process message with runtime
    const startTime = Date.now();
    const response = await this.runtime.processMessage(message);
    const processingTime = Date.now() - startTime;
    
    // Log message processed
    instrument.messageProcessed({
      messageId: uuidv4(),
      sessionId: this.sessionId,
      agentId: this.agentId,
      processingTime
    });
    
    // Save to memory
    this.saveToMemory(message, response);
    
    return response;
  }

  /**
   * Save messages to memory
   */
  private saveToMemory(userMessage: string, agentResponse: string) {
    const memoryItem = {
      role: 'user',
      content: userMessage
    };
    
    this.memory.push(JSON.stringify(memoryItem));
    
    const responseItem = {
      role: 'assistant',
      content: agentResponse
    };
    
    this.memory.push(JSON.stringify(responseItem));
    
    // Log using standard logger instead of instrumentation
    elizaLogger.debug(`Memory updated for agent ${this.agentId}`);
  }

  /**
   * Get the agent's memory
   */
  getMemory(): string[] {
    return [...this.memory];
  }

  /**
   * Get the agent's IDs
   */
  getIds() {
    return {
      agentId: this.agentId,
      sessionId: this.sessionId,
      roomId: this.roomId
    };
  }
}

/**
 * Run an integration example
 */
async function runIntegrationExample() {
  console.log("Starting agent integration example...");
  
  // Create an agent
  const agent = new Agent();
  console.log(`Created agent with IDs:`, agent.getIds());
  
  // Process some messages
  const messages = [
    "Hello, how are you?",
    "What can you help me with?",
    "Tell me about yourself."
  ];
  
  for (const message of messages) {
    console.log(`\nUser: ${message}`);
    const response = await agent.processMessage(message);
    console.log(`Agent: ${response}`);
  }
  
  console.log("\nAgent memory:");
  console.log(agent.getMemory());
  
  console.log("\nExample completed. Check the logs for instrumentation data.");
}

// Run the example if this file is executed directly
if (require.main === module) {
  runIntegrationExample().catch(console.error);
}

export { Agent }; 