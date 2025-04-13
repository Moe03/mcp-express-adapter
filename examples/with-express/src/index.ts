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
