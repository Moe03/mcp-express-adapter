import { mcpTool } from '../../../src/index.js'
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
