import { Tool } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { ToolImplementation } from './expressMiddleware.js'

// Sample tools similar to the example provided by the user
export const GET_WEATHER_TOOL: Tool = {
  name: 'get_weather',
  description: 'Gets the current weather.',
  inputSchema: {
    type: 'object',
    properties: {
      location: {
        type: 'string',
        description: 'The location to get weather for (city, address, etc.)',
      },
    },
    required: ['location'],
  },
}

export const ADD_POST_TOOL: Tool = {
  name: 'add_post',
  description: 'Adds a simple text post.',
  inputSchema: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'The text content of the post to add.',
      },
    },
    required: ['content'],
  },
}

export const GET_POSTS_TOOL: Tool = {
  name: 'get_posts',
  description: 'Retrieves all posts.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
}

export const DELETE_POST_TOOL: Tool = {
  name: 'delete_post',
  description: 'Deletes a post by ID.',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'The ID of the post to delete.',
      },
    },
    required: ['id'],
  },
}

// Complete set of sample tools
export const SAMPLE_TOOLS = [
  GET_WEATHER_TOOL,
  ADD_POST_TOOL,
  GET_POSTS_TOOL,
  DELETE_POST_TOOL,
]

// Sample in-memory store for posts
interface Post {
  id: string
  content: string
  timestamp: number
}

const posts: Post[] = []

// Tool handlers - now simple functions accepting the tool arguments

async function handleGetWeather(args: any) {
  const { location } = args

  return {
    content: [
      {
        type: 'text',
        text: `Weather in ${location}: Sunny, 75 degrees Fahrenheit.`,
      },
    ],
    isError: false,
  }
}

async function handleAddPost(args: any) {
  const { content } = args

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return {
      content: [{ type: 'text', text: 'Error: Post content cannot be empty.' }],
      isError: true,
    }
  }

  const newPost: Post = {
    id: Date.now().toString(),
    content,
    timestamp: Date.now(),
  }

  posts.push(newPost)

  return {
    content: [
      { type: 'text', text: `Success! Post added with ID: ${newPost.id}` },
    ],
    isError: false,
  }
}

async function handleGetPosts(args: any) {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(posts, null, 2),
      },
    ],
    isError: false,
  }
}

async function handleDeletePost(args: any) {
  const { id } = args

  const postIndex = posts.findIndex((post) => post.id === id)

  if (postIndex === -1) {
    return {
      content: [{ type: 'text', text: `Error: No post found with ID: ${id}` }],
      isError: true,
    }
  }

  posts.splice(postIndex, 1)

  return {
    content: [{ type: 'text', text: `Success! Post with ID: ${id} deleted.` }],
    isError: false,
  }
}

// Create tool implementations that combine definition and handler
export const weatherToolImpl: ToolImplementation = {
  definition: GET_WEATHER_TOOL,
  handler: handleGetWeather,
}

export const addPostToolImpl: ToolImplementation = {
  definition: ADD_POST_TOOL,
  handler: handleAddPost,
}

export const getPostsToolImpl: ToolImplementation = {
  definition: GET_POSTS_TOOL,
  handler: handleGetPosts,
}

export const deletePostToolImpl: ToolImplementation = {
  definition: DELETE_POST_TOOL,
  handler: handleDeletePost,
}

// Complete set of sample tool implementations
export const SAMPLE_TOOL_IMPLS = [
  weatherToolImpl,
  addPostToolImpl,
  getPostsToolImpl,
  deletePostToolImpl,
]
