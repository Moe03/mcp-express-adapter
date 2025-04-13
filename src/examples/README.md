# Multi-Agent MCP Server Example

This example demonstrates how to use the `MCPServer` Express middleware to run multiple MCP (Model Context Protocol) server instances on different endpoints.

## Features

- Run multiple MCP servers on a single Express app
- Each MCP server can have its own set of tools with handlers
- Access different SSE endpoints for each agent (e.g., `/agent-1/sse`, `/agent-2/sse`)

## Usage

### Basic Setup

```javascript
import express from 'express'
import { MCPServer } from '../server/expressMiddleware.js'
import { SAMPLE_TOOL_IMPLS } from '../server/mcpTools.js'

const app = express()

// Create an MCPServer middleware
app.use(
  MCPServer({
    endpoint: '/agent-1', // This will create endpoints at /agent-1/sse and /agent-1/message
    tools: SAMPLE_TOOL_IMPLS, // Array of tool implementations with handlers
    serverName: 'agent-1-mcp',
    serverVersion: '0.1.0',
  }),
)

// Add another MCP server on a different endpoint
app.use(
  MCPServer({
    endpoint: '/agent-2',
    tools: SAMPLE_TOOL_IMPLS.slice(0, 2), // Different set of tools
  }),
)

// Start Express server
app.listen(8000, () => {
  console.log('Server running on port 8000')
})
```

### Creating Custom Tools

Define your tools using the `ToolImplementation` interface which combines a tool definition with its handler:

```javascript
import { ToolImplementation } from '../server/expressMiddleware.js'

// Define the tool
const MY_CUSTOM_TOOL = {
  name: 'my_custom_tool',
  description: 'Does something useful',
  inputSchema: {
    type: 'object',
    properties: {
      param1: {
        type: 'string',
        description: 'First parameter',
      },
    },
    required: ['param1'],
  },
}

// Create a handler function for the tool
async function handleMyCustomTool(args) {
  const { param1 } = args
  // Your implementation here
  return {
    content: [{ type: 'text', text: `Result: ${param1}` }],
    isError: false,
  }
}

// Create a tool implementation
const myToolImpl = {
  definition: MY_CUSTOM_TOOL,
  handler: handleMyCustomTool,
}

// Use it in your MCPServer
app.use(
  MCPServer({
    endpoint: '/my-agent',
    tools: [myToolImpl],
  }),
)
```

## Available Endpoints

For each agent configured with the `MCPServer` middleware:

- `/{endpoint}/sse` - Server-Sent Events endpoint for MCP communication
- `/{endpoint}/message` - POST endpoint for messages

## Running the Example

```bash
# From the project root
npx ts-node src/examples/multi-agent-example.ts
```

Then access:

- http://localhost:8000/agent-1/sse
- http://localhost:8000/agent-2/sse

## Integration with Client Applications

Client applications can connect to the SSE endpoints to interact with the MCP servers. The protocol follows the standard MCP communication flow.
