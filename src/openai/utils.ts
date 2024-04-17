import {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources';
import React from 'react';
import { ChatCompletionMessageOrReactElement, Tools } from './chat-completion';
import z from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

// Filter out React components from a list of messages
export function filterOutReactComponents(
  messages: ChatCompletionMessageOrReactElement[],
): ChatCompletionMessageParam[] {
  return messages.filter(
    (m) => !React.isValidElement(m),
  ) as ChatCompletionMessageParam[];
}

// Waits a specified number of milliseconds
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Convert a tools object to a JSON schema
export function toolsToJsonSchema(
  tools: Tools<{ [toolName: string]: z.Schema }>,
) {
  const result: Array<ChatCompletionTool> = [];

  for (const [key, value] of Object.entries(tools)) {
    result.push({
      type: 'function',
      function: {
        name: key,
        description: value.description,
        parameters: zodToJsonSchema(value.parameters),
      },
    });
  }

  return result;
}

export function isReactElement(
  message: ChatCompletionMessageOrReactElement,
): message is React.ReactElement {
  return React.isValidElement(message);
}

export function isAsyncGeneratorFunction(fn: unknown): fn is AsyncGenerator {
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncGenerator
  return fn?.constructor?.name === 'AsyncGenerator';
}
