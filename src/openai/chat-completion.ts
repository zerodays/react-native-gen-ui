import {
  ChatCompletionChunk,
  ChatCompletionCreateParamsStreaming,
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
} from 'openai/resources';
import z from 'zod';
import { OpenAIApi } from './openai-api';
import React from 'react';
import { filterOutReactComponents, sleep, toolsToJsonSchema } from './utils';
import EventSource, { EventSourceEvent } from 'react-native-sse';

// Includes a few different types.
// A component type that can be returned from a tool's render function.
export type Component = React.ReactNode | JSX.Element | Element;

// Tool's render function can return either data or a component
export type ChatCompletionMessageOrReactComponent =
  | ChatCompletionMessageParam
  | Component;

// Tool definition
// Takes a description (visible to model)
// Parameters (zod schema), that are converted to json schema and then sent to the model
// Render function that takes the parameters and returns a generator that yields components, then returns both data and a component to display
interface Tool<Z extends z.Schema> {
  description: string;
  parameters: Z;
  render: (args: z.infer<Z>) => ToolRenderReturnType;
}

// A generic type that allows for use of type-safe validators
export type ValidatorsObject = {
  [name: string]: z.Schema;
};

// Generic tools type definition
export type Tools<V extends ValidatorsObject = {}> = {
  [name in keyof V]: Tool<V[name]>;
};

// Chat completion parameters have a different, type safe definition
export type ChatCompletionCreateParams = Omit<
  ChatCompletionCreateParamsStreaming,
  'tools'
> & {
  tools?: Tools<{ [toolName: string]: z.Schema }>;
};

type ToolGeneratorReturn = { component: Component; data: object };

// A generator that will yield some (0 or more) React components and then finish with an object, containing both the data and the component to display.
export type ToolRenderReturnType = AsyncGenerator<
  Component,
  ToolGeneratorReturn,
  unknown
>;

// Chat completion callbacks, utilized by the caller
export interface ChatCompletionCallbacks {
  onChunkReceived?: (messages: ChatCompletionMessageOrReactComponent[]) => void;
  onDone?: (messages: ChatCompletionMessageOrReactComponent[]) => void;
  onError?: (error: Error) => void;
}

export class ChatCompletion {
  private eventSource: EventSource | null = null;
  private api: OpenAIApi;
  private callbacks: ChatCompletionCallbacks;
  private params: ChatCompletionCreateParams;

  private newMessage: string = '';
  // TODO: handle parallel tool calls
  private newToolCall: ChatCompletionMessageToolCall.Function = {
    name: '',
    arguments: '',
  };
  private toolCallResult: any = null;
  private toolRenderResult: Component | null = null;
  private finished = false;

  constructor(
    api: OpenAIApi,
    params: ChatCompletionCreateParams,
    callbacks: ChatCompletionCallbacks,
  ) {
    this.api = api;
    this.params = params;
    this.callbacks = callbacks;
  }

  start() {
    this.eventSource = new EventSource<string>(
      `${this.api.basePath}/chat/completions`,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.api.apiKey}`,
        },
        // Do not poll, just connect once
        pollingInterval: 0,
        method: 'POST',
        body: this.serializeParams(),
      },
    );

    this.eventSource.addEventListener(
      'message',
      this.handleNewMessage.bind(this),
    );

    this.eventSource.addEventListener('error', (event) => {
      if (event.type === 'error') {
        console.error('Connection error:', event.message);
        this.callbacks.onError?.(new Error(event.message));
      } else if (event.type === 'exception') {
        console.error('Error:', event.message, event.error);
        this.callbacks.onError?.(new Error(event.message));
      }
    });
  }

  private handleNewMessage(event: EventSourceEvent<'message'>) {
    // If [DONE], close the connection and mark as done
    if (event.data === '[DONE]') {
      this.eventSource?.close();
      return;
    }

    if (!event.data) {
      console.error('Empty message received.');
      this.callbacks.onError?.(new Error('Empty message received.'));
      return;
    }

    const e = JSON.parse(event.data) as ChatCompletionChunk;

    if (e.choices == null || e.choices.length === 0) {
      return;
    }

    const firstChoice = e.choices[0];

    // TODO: function calls
    if (firstChoice.finish_reason === 'tool_calls') {
      void this.handleToolCall();
      return;
    }

    // Handle stop
    if (firstChoice.finish_reason === 'stop') {
      // Call onDone
      this.callbacks.onDone?.([
        {
          content: this.newMessage,
          role: 'assistant',
        },
      ]);
      this.finished = true;
      return;
    }

    // Handle normal text token delta
    if (firstChoice.delta.content != null) {
      this.newMessage += firstChoice.delta.content;
      this.notifyChunksReceived();
      return;
    }

    // Handle tool calls
    if (
      firstChoice.delta.tool_calls != null &&
      firstChoice.delta.tool_calls.length > 0
    ) {
      // TODO: can there be more than one tool call?
      const firstToolCall = firstChoice.delta.tool_calls[0];

      // Append name if available
      if (firstToolCall.function?.name) {
        this.newToolCall.name += firstToolCall.function.name;
      }

      // Append arguments if available
      if (firstToolCall.function?.arguments) {
        this.newToolCall.arguments += firstToolCall.function.arguments;
      }

      return;
    }

    // TODO: handle finish reason `length`
    console.error('Unknown message received:', event.data);
    this.callbacks.onError?.(new Error('Unknown message received.'));
  }

  serializeParams() {
    const tools = toolsToJsonSchema(this.params.tools ?? {});

    return JSON.stringify({
      ...this.params,
      tools,
    });
  }

  private async handleToolCall() {
    if (this.newToolCall.name === '') {
      console.error('Tool call received without a name.');
      this.callbacks.onError?.(new Error('Tool call received without a name.'));
      return;
    }

    if (
      this.params.tools == null ||
      !Object.keys(this.params.tools).includes(this.newToolCall.name)
    ) {
      console.error('Tool call received for unknown tool:', this.newToolCall);
      this.callbacks.onError?.(
        new Error('Tool call received for unknown tool.'),
      );
      return;
    }

    const chosenTool = this.params.tools[this.newToolCall.name];

    if (chosenTool == null) {
      console.error('Tool call received for unknown tool:', this.newToolCall);
      this.callbacks.onError?.(
        new Error('Tool call received for unknown tool.'),
      );
      return;
    }

    const args = JSON.parse(this.newToolCall.arguments);

    // Verify that the arguments are valid by parsing them with the zod schema
    try {
      chosenTool.parameters.parse(args);
    } catch (e) {
      console.error('Invalid arguments received:', e);
      this.callbacks.onError?.(new Error('Invalid arguments received.'));
      return;
    }

    // Call the tool and iterate over results
    // Use while to access the last value of the generator (what it returns too rather then only what it yields)
    const generator = chosenTool.render(args);

    let next = null;
    while (next == null || !next.done) {
      next = await generator.next();
      const value = next.value;

      // If the value is contains data and component, save both
      // TODO: do better
      if (
        value != null &&
        Object.keys(value).includes('data') &&
        Object.keys(value).includes('component')
      ) {
        const v = value as { data: any; component: Component };
        this.toolRenderResult = v.component;
        this.toolCallResult = v.data;
      } else if (React.isValidElement(value)) {
        this.toolRenderResult = value;
      }

      this.notifyChunksReceived();

      if (next.done) {
        console.log('Function call done', {
          name: this.newToolCall.name,
          result: this.toolCallResult,
        });
        break;
      }
    }

    // Call recursive streaming
    // TODO: handle max recursion depth
    await this.streamRecursiveAfterToolCall();
    this.finished = true;
  }

  private async streamRecursiveAfterToolCall() {
    // Create a new completion and stream up messages from this one and any from the recursive ones
    const newCompletion = new ChatCompletion(
      this.api,
      {
        ...this.params,
        messages: [
          ...this.params.messages,
          ...filterOutReactComponents(this.getMessages()),
        ],
      },
      {
        ...this.callbacks,
        onChunkReceived: (messages) => {
          this.callbacks.onChunkReceived?.([
            ...this.getMessages(),
            ...messages,
          ]);
        },
        onDone: (messages) => {
          this.callbacks.onDone?.([...this.getMessages(), ...messages]);
        },
      },
    );

    newCompletion.start();

    // Wait until the new completion is finished
    while (!newCompletion.finished) {
      await sleep(100);
    }
  }

  private notifyChunksReceived() {
    if (!this.callbacks.onChunkReceived) {
      return;
    }

    const messages = this.getMessages();
    this.callbacks.onChunkReceived(messages);
  }

  private getMessages() {
    const messages: ChatCompletionMessageOrReactComponent[] = [];

    if (this.newMessage != null && this.newMessage !== '') {
      messages.push({
        role: 'assistant',
        content: this.newMessage,
      });
    }

    if (this.toolRenderResult != null) {
      messages.push(this.toolRenderResult);
    }

    if (this.toolCallResult != null) {
      messages.push({
        role: 'function',
        name: this.newToolCall.name,
        content: JSON.stringify(this.toolCallResult),
      });
    }

    return messages;
  }
}
