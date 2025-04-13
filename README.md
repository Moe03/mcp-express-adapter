# DO NOT INSTALL YET.

# MCP Adapter for Express Servers

A lightweight adapter for creating [MCP (Model Context Protocol)](https://github.com/modelcontextprotocol) servers using Express.js.

## Installation

```bash
npm install mcp-express-adapter
# or
yarn add mcp-express-adapter
# or
pnpm add mcp-express-adapter
```

## Quick Start

Here's how to create a simple Express server with an MCP endpoint and a weather tool:

```javascript
import express from 'express'
import cors from 'cors'
import { MCPClient } from 'mcp-express-adapter'

// Create Express app
const app = express()
app.use(cors())

// Define weather tool implementation
const weatherTool = {
  name: 'get_weather',
  description: 'Get the current weather for a location',
  inputSchema: {
    type: 'object',
    properties: {
      location: {
        type: 'string',
        description: 'The location to get weather for',
      },
    },
    required: ['location'],
  },
  handler: async (args) => ({
    content: [
      {
        type: 'text',
        text: `Weather for ${args.location}: Sunny, 72°F`,
      },
    ],
    isError: false,
  }),
}

// Create MCP client
const mcpClient = new MCPClient({
  endpoint: '/mcp',
  tools: [weatherTool],
  serverName: 'my-mcp-server',
  serverVersion: '1.0.0',
})

// Mount MCP router BEFORE global JSON parser
app.use('/mcp', mcpClient.middleware())

// Apply global JSON parser AFTER agent routes
app.use(express.json())

// Start the server
const PORT = 3000
app.listen(PORT, () => {
  console.log(`MCP Server running on port ${PORT}`)
  console.log(`Connect at: http://localhost:${PORT}/mcp/sse`)
})
```

## API Reference

### MCPClient

The main class for creating an MCP endpoint on your Express server.

#### Constructor Options

```typescript
interface MCPClientOptions {
  endpoint: string // The base path for the MCP endpoints
  tools: ToolImpl[] // Array of tool implementations
  serverName?: string // Optional server name (default: 'mcp-server')
  serverVersion?: string // Optional server version (default: '1.0.0')
}
```

#### Tool Implementation

```typescript
interface ToolImpl<T = any> {
  name: string // Tool name
  description: string // Tool description
  inputSchema: {
    // JSON Schema for the tool's input
    type: 'object'
    properties: Record<string, any>
    required?: string[]
  }
  handler: (args: T) => Promise<{
    content: Array<
      | { type: string; text?: string }
      | { type: string; data?: string; mimeType?: string }
    >
    isError?: boolean
  }>
}
```

## Advanced Example

Here's a more advanced example with multiple tools and endpoints:

```javascript
import express from 'express'
import cors from 'cors'
import { MCPClient } from 'mcp-express-adapter'

const app = express()
app.use(cors())

// Define multiple tools
const weatherTool = {
  name: 'get_weather',
  description: 'Get the current weather for a location',
  inputSchema: {
    type: 'object',
    properties: {
      location: { type: 'string', description: 'The location' },
    },
    required: ['location'],
  },
  handler: async (args) => ({
    content: [
      { type: 'text', text: `Weather for ${args.location}: Sunny, 72°F` },
    ],
    isError: false,
  }),
}

const searchTool = {
  name: 'search_web',
  description: 'Search the web for information',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The search query' },
    },
    required: ['query'],
  },
  handler: async (args) => ({
    content: [
      {
        type: 'text',
        text: `Search results for "${args.query}": Results here...`,
      },
    ],
    isError: false,
  }),
}

// Set up multiple MCP Clients on different endpoints
const agent1 = new MCPClient({
  endpoint: '/agent-1',
  tools: [weatherTool, searchTool],
  serverName: 'mcp-server-agent-1',
  serverVersion: '1.0.0',
})

const agent2 = new MCPClient({
  endpoint: '/agent-2',
  tools: [weatherTool], // This agent only has weather tool
  serverName: 'mcp-server-agent-2',
  serverVersion: '1.0.0',
})

// Mount agent routers BEFORE global JSON parser
app.use('/agent-1', agent1.middleware())
app.use('/agent-2', agent2.middleware())

// Apply global JSON parser AFTER agent routes
app.use(express.json())

// Start the server
const PORT = 3000
app.listen(PORT, () => {
  console.log(`MCP Server running on port ${PORT}`)
  console.log(`Agent 1: http://localhost:${PORT}/agent-1/sse`)
  console.log(`Agent 2: http://localhost:${PORT}/agent-2/sse`)
})
```

## Testing Your MCP Server

You can test your MCP server using `curl` to connect to the SSE endpoint:

```bash
curl -N http://localhost:3000/mcp/sse
```

Or use the MCP command-line client:

```bash
npx express-mcp --host http://localhost:3000/mcp
```

## License

MIT
