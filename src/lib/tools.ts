import { z, ZodType } from 'zod'
import { Tool } from '@modelcontextprotocol/sdk/types.js'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { ToolImpl } from './mcp-client.js'

// Type for MCP content item
type McpContentItem =
  | { type: string; text?: string }
  | { type: string; data?: string; mimeType?: string }

// Type for MCP response
type McpResponse = {
  content: McpContentItem[]
  isError?: boolean
}

// Type for context parameter
type ToolContext = {
  headers?: Record<string, string>
  [key: string]: any
}

/**
 * Creates a type-safe MCP tool with input and output validation using Zod schemas.
 *
 * @param options Tool configuration with input/output schemas and simplified handler
 * @returns A tool implementation compatible with MCPClient
 */
export function mcpTool<
  TInput extends ZodType,
  TOutput extends ZodType | undefined = undefined,
>({
  name,
  description,
  schema,
  outputSchema,
  handler,
}: {
  name: string
  description: string
  schema: TInput
  outputSchema?: TOutput
  handler: (
    args: z.infer<TInput>,
    context?: ToolContext,
  ) => Promise<TOutput extends ZodType ? z.infer<TOutput> : string>
}): {
  name: string
  description: string
  inputSchema: Tool['inputSchema']
  handler: (
    args: z.infer<TInput>,
    context?: ToolContext,
  ) => Promise<McpResponse>
} {
  // Convert input Zod schema to JSON Schema
  const inputJsonSchema = zodToJsonSchema(schema, {
    target: 'jsonSchema7',
    $refStrategy: 'none',
  })

  // Remove $schema property that might be added by zod-to-json-schema
  delete (inputJsonSchema as any).$schema

  // Process output schema if provided
  let outputJsonSchema: any = null
  if (outputSchema) {
    outputJsonSchema = zodToJsonSchema(outputSchema, {
      target: 'jsonSchema7',
      $refStrategy: 'none',
    })
    delete (outputJsonSchema as any).$schema
  }

  // Enhance the inputSchema with outputSchema metadata if available
  const enhancedInputSchema = { ...inputJsonSchema } as any
  if (outputJsonSchema) {
    enhancedInputSchema['x-output-schema'] = outputJsonSchema
  }

  // Create tool implementation with proper type inference
  return {
    name,
    description,
    inputSchema: enhancedInputSchema as Tool['inputSchema'],
    handler: async (args, context) => {
      // Validate args against schema before passing to handler
      try {
        const validatedArgs = schema.parse(args)

        // Call the handler with validated args and context
        const result = await handler(validatedArgs, context)

        // Validate output if schema provided
        if (outputSchema) {
          try {
            outputSchema.parse(result)
          } catch (error) {
            if (error instanceof z.ZodError) {
              const errorMessage = error.errors
                .map((e) => `${e.path.join('.')}: ${e.message}`)
                .join(', ')

              return {
                content: [
                  {
                    type: 'text',
                    text: `Output validation error: ${errorMessage}`,
                  },
                ],
                isError: true,
              }
            }
            throw error
          }
        } else if (typeof result !== 'string') {
          // When no output schema is provided, we expect a string
          return {
            content: [
              {
                type: 'text',
                text: `Handler returned non-string value, but no output schema was provided. Value: ${JSON.stringify(result)}`,
              },
            ],
            isError: true,
          }
        }

        // Format the output according to MCP protocol
        return formatOutput(result)
      } catch (error) {
        if (error instanceof z.ZodError) {
          // Format validation errors
          const errorMessage = error.errors
            .map((e) => `${e.path.join('.')}: ${e.message}`)
            .join(', ')

          return {
            content: [
              { type: 'text', text: `Input validation error: ${errorMessage}` },
            ],
            isError: true,
          }
        }
        throw error
      }
    },
  }
}

/**
 * Formats any value into the expected MCP response format
 * Always using 'text' type for maximum compatibility
 */
function formatOutput(output: any): McpResponse {
  // If output is already in MCP format (has content array), return as is
  if (output && typeof output === 'object' && Array.isArray(output.content)) {
    return output
  }

  // Handle different output types
  if (typeof output === 'string') {
    // Plain text - pass through directly
    return { content: [{ type: 'text', text: output }] }
  } else if (output === null || output === undefined) {
    // Empty response
    return { content: [{ type: 'text', text: '' }] }
  } else if (typeof output === 'object' || Array.isArray(output)) {
    // JSON objects or arrays - stringify them
    return {
      content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
    }
  } else {
    // Numbers, booleans, etc. - convert to string
    return { content: [{ type: 'text', text: String(output) }] }
  }
}
