# DO NOT INSTALL YET.

# MCP Adapter for Express Servers

A lightweight adapter for creating [MCP (Model Context Protocol)](https://github.com/modelcontextprotocol) servers using Express.js.

## Installation

```bash
npm install mcp-express-middleware
# or
yarn add mcp-express-middleware
# or
pnpm add mcp-express-middleware
```

## Multiple MCP Clients

Here's how to create a simple Express server with an MCP endpoint and a weather tool:

```typescript
import express from 'express'
import cors from 'cors'
import { MCPClient, ToolImpl } from 'mcp-express-middleware'

// Create Express app
const app = express()
app.use(cors())

// Define weather tool implementation
const weatherTool: ToolImpl<{ location: string }> = {
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

// Define calculator tool implementation
const calculatorTool: ToolImpl<{ expression: string }> = {
  name: 'calculate',
  description: 'Calculate the result of a mathematical expression',
  inputSchema: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'The mathematical expression to evaluate',
      },
    },
    required: ['expression'],
  },
  handler: async (args) => ({
    content: [
      {
        type: 'text',
        text: `Result: ${eval(args.expression)}`,
      },
    ],
    isError: false,
  }),
}

// Define time tool implementation
const timeTool: ToolImpl<{ timezone?: string }> = {
  name: 'get_time',
  description: 'Get the current time, optionally for a specific timezone',
  inputSchema: {
    type: 'object',
    properties: {
      timezone: {
        type: 'string',
        description: 'The timezone to get time for (optional)',
      },
    },
  },
  handler: async (args) => ({
    content: [
      {
        type: 'text',
        text: `Current time${args.timezone ? ` in ${args.timezone}` : ''}: ${new Date().toLocaleString()}`,
      },
    ],
    isError: false,
  }),
}

// Create first MCP client with weather tool
const weatherClient = new MCPClient({
  endpoint: '/weather-mcp',
  tools: [weatherTool],
  serverName: 'weather-mcp-server',
  serverVersion: '1.0.0',
})

// Create second MCP client with calculator tool
const calculatorClient = new MCPClient({
  endpoint: '/calculator-mcp',
  tools: [calculatorTool],
  serverName: 'calculator-mcp-server',
  serverVersion: '1.0.0',
})

// Create third MCP client with time tool
const timeClient = new MCPClient({
  endpoint: '/time-mcp',
  tools: [timeTool],
  serverName: 'time-mcp-server',
  serverVersion: '1.0.0',
})

// Mount MCP routers BEFORE global JSON parser
app.use('/weather-mcp', weatherClient.middleware())
app.use('/calculator-mcp', calculatorClient.middleware())
app.use('/time-mcp', timeClient.middleware())

// Apply global JSON parser AFTER agent routes
app.use(express.json())

// Start the server
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000
app.listen(PORT, () => {
  console.log(`Multiple MCP Servers running on port ${PORT}`)
  console.log(`Weather MCP: http://localhost:${PORT}/weather-mcp/sse`)
  console.log(`Calculator MCP: http://localhost:${PORT}/calculator-mcp/sse`)
  console.log(`Time MCP: http://localhost:${PORT}/time-mcp/sse`)
})
```

## Common issues

- Make sure to apply exress.json() AFTER the app.use MCP middleware

## Examples

For a complete working example, check out the [Express Server Example](./examples/express-server) in the examples directory. You can run it with:

```bash
# From the root of the repo
pnpm install
cd examples/express-server
pnpm dev
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
import { MCPClient } from 'mcp-express-middleware'

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
