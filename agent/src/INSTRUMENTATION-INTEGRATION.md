# Integrating Instrumentation with Agent Runtime

This guide explains how to integrate the instrumentation system with your actual agent runtime to capture real-time events and store them in PostgreSQL.

## Setup

1. Ensure your PostgreSQL database is running and that you have the correct connection string in your `.env` file:

```
# Use PostgreSQL for instrumentation
USE_SQLITE=false
POSTGRES_URL=postgresql://username:password@localhost:5432/database_name
```

2. Make sure all required dependencies are installed:

```bash
pnpm add pg @types/pg @opentelemetry/api @opentelemetry/sdk-trace-base @opentelemetry/sdk-trace-node @opentelemetry/resources @opentelemetry/semantic-conventions
```

## Integration with Your Agent Runtime

There are two ways to integrate the instrumentation with your agent runtime:

### Option 1: Direct Integration in Your Code

In your agent's initialization code, add the following:

```typescript
import { getRuntimeInstrumentation } from './runtime-instrumentation';

// Create your agent runtime instance
const runtime = new AgentRuntime({
  // Your runtime configuration
});

// Get the runtime instrumentation singleton
const runtimeInstrumentation = getRuntimeInstrumentation();

// Attach instrumentation to the runtime
runtimeInstrumentation.attachToRuntime(runtime);

// Continue with your application logic
```

### Option 2: Create an Instrumented Agent Factory

If you create multiple agent instances, you can create a factory function:

```typescript
import { getRuntimeInstrumentation } from './runtime-instrumentation';

export function createInstrumentedAgent(config: AgentRuntimeConfig) {
  // Create the agent runtime
  const runtime = new AgentRuntime(config);
  
  // Get the runtime instrumentation singleton
  const runtimeInstrumentation = getRuntimeInstrumentation();
  
  // Attach instrumentation to the runtime
  runtimeInstrumentation.attachToRuntime(runtime);
  
  return runtime;
}
```

Then use it in your application:

```typescript
const agent = createInstrumentedAgent({
  // Your agent configuration
});
```

## Tracked Events

The instrumentation system captures the following events:

1. **Session Start**: Logged when the agent runtime is initialized
2. **Runtime Initialized**: Logged after the runtime's initialize method completes
3. **Message Received**: Logged when a message is processed by the evaluate method
4. **Message Processed**: Logged when a message has been processed
5. **Actions Processing**: Tracks when actions are started and completed
6. **Runtime Stopped**: Logged when the runtime is stopped

## Viewing the Logs

You can view the logs in the PostgreSQL database by directly querying the database using the `psql` command-line tool or any PostgreSQL GUI client.

Example SQL queries:

```sql
-- Get all logs for a specific session
SELECT * FROM traces WHERE attributes->>'session_id' = 'your-session-id' ORDER BY start_time;

-- Get all logs for a specific agent
SELECT * FROM traces WHERE attributes->>'agent_id' = 'your-agent-id' ORDER BY start_time;

-- Get specific event types
SELECT * FROM traces WHERE span_name = 'message_processed' ORDER BY start_time DESC LIMIT 10;
```

## Custom Events

You can also log custom events by accessing the instrumentation instance directly:

```typescript
import { Instrumentation } from './instrumentation';

const instrumentation = Instrumentation.getInstance();

// Log a custom event
instrumentation.logEvent({
  stage: 'Custom',
  subStage: 'Event',
  event: 'custom_event_name',
  data: {
    sessionId: 'your-session-id',
    agentId: 'your-agent-id',
    customField1: 'value1',
    customField2: 'value2',
  },
});
```

## Troubleshooting

If you encounter any issues with the instrumentation:

1. **Database Connection**: Make sure your PostgreSQL credentials are correct and the database is running
2. **Table Creation**: Check that the `traces` table has been created in your database
3. **Runtime Integration**: Ensure that you're attaching the instrumentation before using the runtime methods

You can check the application logs for error messages from the instrumentation system.

## Performance Considerations

The instrumentation system is designed to have minimal impact on performance, but in high-volume scenarios, you may want to monitor its impact. Consider enabling the instrumentation only in development or staging environments, or for specific debug sessions. 