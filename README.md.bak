# MCP Middleware Adapter for Express Servers

- A lightweight adapter for creating [MCP (Model Context Protocol)](https://github.com/modelcontextprotocol) servers using Express.js.

- Sponsored by https://tixaeagents.ai create Text/Voice AI agents in seconds, compatible with MCP servers.

## Installation

```bash
npm install mcp-express-adapter@latest
# or
yarn add mcp-express-adapter@latest
# or
pnpm add mcp-express-adapter@latest
```

## Simplest express server running MCP client:

```typescript
// examples/with-express/src/super-simple.ts
import express from 'express'
import cors from 'cors'
import { MCPClient, mcpTool } from 'mcp-express-adapter'
import { z } from 'zod'

// Create Express app
const app = express()
app.use(cors())

// Define a super simple weather tool
const weatherTool = mcpTool({
  name: 'get_weather',
  description: 'Get weather for a location',
  // Define input schema
  schema: z.object({
    location: z.string().describe('The city to get weather for'),
  }),
  // No output schema needed for simple string responses
  handler: async (args) => {
    // Just return a string - mcpTool handles the formatting
    return `Weather for ${args.location}: ☀️ Sunny and 72°F`
  },
})

// Create MCP client
const mcpClient = new MCPClient({
  endpoint: '/mcp',
  tools: [weatherTool],
  serverName: 'demo-server',
  serverVersion: '1.0.0',
})

// Mount MCP router
app.use('/mcp', mcpClient.middleware())

// Apply JSON parser for other routes
app.use(express.json())

// Start the server
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`✨ Super Simple MCP Server running!`)
  console.log(`🔗 Connect at: http://localhost:${PORT}/mcp/sse`)
})
```

## Now use the MCP client in Claude desktop

- settings > developer > edit config file to this:

```json
{
  "mcpServers": {
    "localMcpServer": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-express-adapter",
        "--host",
        "http://localhost:3000/mcp/sse"
      ]
    }
  }
}
```

## Multiple MCP client on same Express server.

```typescript
// examples/with-express/src/multiple-mcp-clients.ts
import express from 'express'
import cors from 'cors'
import { MCPClient, mcpTool } from 'mcp-express-adapter'
import { z } from 'zod'

// Create Express app
const app = express()
app.use(cors())

// Define weather tool using mcpTool helper
const weatherTool = mcpTool({
  name: 'get_weather',
  description: 'Get the current weather for a location',
  schema: z.object({
    location: z.string().describe('The location to get weather for'),
  }),
  // you can define typesafe output schema..
  outputSchema: z.object({
    farenheight: z.number().describe('The temperature in farenheight'),
    celsius: z.number().describe('The temperature in celsius'),
  }),
  handler: async (args) => {
    return {
      farenheight: 72,
      celsius: 22,
    }
  },
})

// Define calculator tool using mcpTool helper
const calculatorTool = mcpTool({
  name: 'calculate',
  description: 'Calculate the result of a mathematical expression',
  schema: z.object({
    expression: z.string().describe('The mathematical expression to evaluate'),
  }),
  handler: async (args) => {
    return `Result: ${eval(args.expression)}`
  },
})

// Define time tool using mcpTool helper
const timeTool = mcpTool({
  name: 'get_time',
  description: 'Get the current time, optionally for a specific timezone',
  schema: z.object({
    timezone: z
      .string()
      .optional()
      .describe('The timezone to get time for (optional)'),
  }),
  handler: async (args) => {
    return `Current time${args.timezone ? ` in ${args.timezone}` : ''}: ${new Date().toLocaleString()}`
  },
})

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

// Add a tool that doesn't specify an outputSchema (will expect string return)
const greetingTool = mcpTool({
  name: 'greeting',
  description: 'Get a personalized greeting',
  schema: z.object({
    name: z.string().describe('The name to greet'),
    formal: z.boolean().optional().describe('Whether to use formal language'),
  }),
  // No outputSchema needed, just return a string
  handler: async (args) => {
    const greeting = args.formal
      ? `Good day, ${args.name}. How may I be of service?`
      : `Hey ${args.name}! How's it going?`

    console.log(
      `[GreetingTool] Generated greeting for ${args.name} (formal: ${args.formal || false})`,
    )
    return greeting
  },
})

// if true will show debug logs, to disable set NODE_ENV=production
const debugMode = process.env.NODE_ENV === 'development'

// Create MCP client
const mcpClient = new MCPClient({
  endpoint: '/mcp',
  tools: [weatherTool, calculatorTool, listTool, greetingTool],
  serverName: 'my-mcp-server',
  serverVersion: '1.0.0',
  debug: debugMode, // Enable debug logs only when --debug flag is passed
})

// Show metadata about the client
const metadata = mcpClient.getMetadata()
console.log('MCP Client created with the following configuration:')
console.log(`- Endpoint: ${metadata.endpoint}`)
console.log(`- Server: ${metadata.serverName} v${metadata.serverVersion}`)
console.log(`- Tools: ${metadata.tools.map((tool) => tool.name).join(', ')}`)

// Mount MCP router
app.use('/mcp', mcpClient.middleware())

// Apply JSON parser for other routes
app.use(express.json())

app.get('/', (req, res) => {
  res.send(`Hello World MCP Express Adapter.`)
})

// Start the server
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000
app.listen(PORT, () => {
  const baseUrl = `http://localhost:${PORT}`
  console.log(`MCP Server running on port ${PORT}`)

  // Get the SSE endpoint URL using the helper method
  const sseEndpoint = mcpClient.getSSEEndpoint(baseUrl)
  console.log(`Connect at: ${sseEndpoint}`)

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

/**
 * Example 1: Tool with an output schema for complex data
 *
 * Use this approach when your tool returns structured data that
 * needs strong type checking.
 */
const weatherTool = mcpTool({
  name: 'get_weather',
  description: 'Get the current weather for a location',
  schema: z.object({
    location: z.string().describe('The location to get weather for'),
  }),
  // Define the output schema for structured data
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

/**
 * Example 2: Tool without an output schema for simple string responses
 *
 * Use this approach when your tool returns simple text responses
 * that don't need complex structure or validation.
 */
const greetingTool = mcpTool({
  name: 'greeting',
  description: 'Get a personalized greeting',
  schema: z.object({
    name: z.string().describe('The name to greet'),
    formal: z.boolean().optional().describe('Whether to use formal language'),
  }),
  // No outputSchema needed for simple string responses
  handler: async (args) => {
    // When no outputSchema is provided, you must return a string
    return args.formal
      ? `Good day, ${args.name}. How may I be of service?`
      : `Hey ${args.name}! How's it going?`
  },
})

// non typesafe tool:
// javascript ready
const nonTypesafeTool = {
  name: 'search_web',
  description: 'Search the web for information',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The search query' },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return',
      },
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

export { weatherTool, greetingTool, nonTypesafeTool }
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

### Common issues

- Make sure to apply exress.json() AFTER the app.use MCP middleware
- Webscokets are not yet tested enough.

### Why

- Default way of deploying MCP servers is annoying, this is trying to simplify it for NodeJS applications

## License

MIT
