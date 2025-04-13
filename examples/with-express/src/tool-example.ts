import { mcpTool } from '../../../src/lib/tools.js'
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
