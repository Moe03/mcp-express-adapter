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

## Multiple MCP Clients

Here's how to create a simple Express server with an MCP endpoint and a weather tool:

```typescript
// examples/with-express/src/multiple-mcp-clients.ts
import express from 'express'
import cors from 'cors'
import { MCPClient, ToolImpl } from 'mcp-express-adapter'

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

### Basic Example with Type-Safe Tools

Here's a complete example using the `mcpTool` helper for creating type-safe MCP tools with Zod schemas:

```typescript
// examples/with-express/src/index.ts
import express from 'express'
import cors from 'cors'
import { MCPClient, mcpTool } from 'mcp-express-adapter'
import { z } from 'zod'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

// Create Express app
const app = express()
app.use(cors())

// Define weather tool using the enhanced mcpTool helper
const weatherTool = mcpTool({
  name: 'get_weather',
  description: 'Get the current weather for a location',
  schema: z.object({
    location: z.string().describe('The location to get weather for'),
  }),
  // Define the output schema
  outputSchema: z
    .object({
      temperature: z.number().describe('Current temperature in °F'),
      condition: z.string().describe('Weather condition (e.g., Sunny, Rainy)'),
      humidity: z.number().describe('Humidity percentage'),
      location: z.string().describe('The location this weather is for'),
    })
    .describe('Weather information for the requested location'),
  // Simply return the data - mcpTool handles the MCP formatting
  handler: async (args) => {
    console.log(`[WeatherTool] Called with location: ${args.location}`)
    // Return an object matching our output schema
    return {
      temperature: 72,
      condition: 'Sunny',
      humidity: 45,
      location: args.location,
    }
  },
})

// Add a calculator tool with a simple numeric output
const calculatorTool = mcpTool({
  name: 'calculator',
  description: 'Calculate the sum of two numbers',
  schema: z.object({
    a: z.number().describe('First number'),
    b: z.number().describe('Second number'),
  }),
  // Output is just a number
  outputSchema: z.number().describe('The sum of the two input numbers'),
  // Simply return the sum - no need to format for MCP
  handler: async (args) => {
    console.log(`[CalculatorTool] Called with: ${args.a}, ${args.b}`)
    return args.a + args.b
  },
})

// Add a tool that returns an array
const listTool = mcpTool({
  name: 'generate_list',
  description: 'Generate a list of items based on a category',
  schema: z.object({
    category: z
      .string()
      .describe('Category to generate items for (e.g., fruits, colors)'),
    count: z
      .number()
      .optional()
      .describe('Number of items to generate (default: 3)'),
  }),
  // Output is an array of strings
  outputSchema: z
    .array(z.string())
    .describe('List of generated items in the category'),
  handler: async (args) => {
    const count = args.count || 3
    console.log(
      `[ListTool] Generating ${count} items for category: ${args.category}`,
    )

    // Sample data based on category
    const items: Record<string, string[]> = {
      fruits: ['apple', 'banana', 'orange', 'grape', 'strawberry'],
      colors: ['red', 'blue', 'green', 'yellow', 'purple'],
      animals: ['dog', 'cat', 'elephant', 'tiger', 'penguin'],
    }

    const categoryItems = items[args.category.toLowerCase()] || [
      'item1',
      'item2',
      'item3',
      'item4',
      'item5',
    ]
    return categoryItems.slice(0, count)
  },
})

// if true will show debug logs, to disable set NODE_ENV=production
const debugMode = process.env.NODE_ENV === 'development'

// Create MCP client
const mcpClient = new MCPClient({
  endpoint: '/mcp',
  tools: [weatherTool, calculatorTool, listTool],
  serverName: 'my-mcp-server',
  serverVersion: '1.0.0',
  debug: debugMode, // Enable debug logs only when --debug flag is passed
})

// Mount MCP router
app.use('/mcp', mcpClient.middleware())

// Apply JSON parser for other routes
app.use(express.json())

// Start the server
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000
app.listen(PORT, () => {
  console.log(`MCP Server running on port ${PORT}`)
  console.log(`Connect at: http://localhost:${PORT}/mcp/sse`)
  console.log(
    `Debug mode: ${debugMode ? 'enabled will show debug logs, to disable set NODE_ENV=production' : 'disabled will not log anything.'}`,
  )
})
```

You can run this example with:

```bash
# From the root of the repo
pnpm install
pnpm test-express
```

### Tool Implementation Example

Here's how to create a simple tool with the `mcpTool` helper:

```typescript
// examples/with-express/src/tool-example.ts
import { mcpTool } from 'mcp-express-adapter'
import { z } from 'zod'

// This is a demo tool implementation
// Define a weather tool with a Zod schema for input and output
const weatherTool = mcpTool({
  name: 'get_weather',
  description: 'Get the current weather for a location',
  schema: z.object({
    location: z.string().describe('The location to get weather for'),
  }),
  outputSchema: z
    .object({
      temperature: z.number().describe('Current temperature in °F'),
      condition: z.string().describe('Weather condition (e.g., Sunny, Rainy)'),
      humidity: z.number().describe('Humidity percentage'),
      location: z.string().describe('The location this weather is for'),
    })
    .describe('Weather information for the requested location'),
  handler: async (args) => {
    // args.location is fully typed as string
    return {
      temperature: 72,
      condition: 'Sunny',
      humidity: 45,
      location: args.location,
    }
  },
})

export default weatherTool
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
