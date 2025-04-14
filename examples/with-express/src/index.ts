import express from 'express'
import cors from 'cors'
import { MCPClient, mcpTool } from '../../../src/index.js'
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

// Add a protected tool that checks for authentication
const protectedTool = mcpTool({
  name: 'get_passcode',
  description: 'Get the passcode for the user',
  schema: z.object({
    name: z.string().describe('The name of the user'),
  }),
  // Implement authentication check in the handler
  handler: async (args, context) => {
    console.log(`[ProtectedTool] Called with name: ${args.name}`)

    // Check for authorization header
    const authHeader = context?.headers?.authorization || ''
    console.log(context)
    console.log(`[ProtectedTool] Auth header: ${authHeader}`)

    // Check for bearer token that matches "000000"
    const validToken = 'Bearer 000000'
    if (!authHeader || authHeader !== validToken) {
      // Return error for unauthorized access
      throw new Error('Unauthorized: Invalid or missing authentication token')
    }

    // If authorized, return the protected data
    return `Protected data for ID: ${args.name}`
  },
})

// if true will show debug logs, to disable set NODE_ENV=production
const debugMode = process.env.NODE_ENV === 'development'

// Create MCP client
const mcpClient = new MCPClient({
  endpoint: '/mcp',
  tools: [weatherTool, calculatorTool, listTool, greetingTool, protectedTool],
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

  // Get the SSE endpoint URL using the helper method
  const sseEndpoint = mcpClient.getSSEEndpoint(baseUrl)
  console.log(`MCP Client SSE Endpoint: ${sseEndpoint}`)

  console.log(
    `Debug mode: ${debugMode ? 'enabled will show debug logs, to disable set NODE_ENV=production' : 'disabled will not log anything.'}`,
  )
})
