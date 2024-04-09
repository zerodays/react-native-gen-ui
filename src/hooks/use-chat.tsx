import React, { useEffect, useState } from 'react';
import { ChatCompletionMessageParam } from 'openai/resources';
import { z } from 'zod';
import {
  ChatCompletionMessageOrReactElement,
  Tools,
  ValidatorsObject,
} from '../openai/chat-completion';
import { OpenAI } from '../openai/openai';
import { filterOutReactComponents } from '../openai/utils';

interface UseChatParams<V extends ValidatorsObject = {}> {
  // OpenAI instance
  openAi: OpenAI;
  // Initial messages to display
  initialMessages?: ChatCompletionMessageParam[];
  // Called when streaming response is completed
  onSuccess?: (messages: ChatCompletionMessageOrReactElement[]) => void;
  // Called when an error occurs while streaming
  onError?: (error: Error) => void;
  // Tools to integrate custom fucntions
  tools?: Tools<V>;
}

interface UseChatResponse {
  // State of user input (i.e. in TextInput component)
  input: string;
  // Messages of current chat session
  messages: ChatCompletionMessageOrReactElement[];
  // Error that can occur during streaming
  error: Error | undefined;
  // Loading state - true immediately after user message submission
  isLoading: boolean;
  // Streaming state - true while streaming response
  isStreaming: boolean;
  // Updates internal state of user input
  onInputChange: React.Dispatch<React.SetStateAction<string>>;
  // Handles user message submission
  handleSubmit: (msg: string) => Promise<void>;
}

// Hook that handles chat logic for user chat conversation
const useChat: <V extends ValidatorsObject = {}>(
  params: UseChatParams<V>,
) => UseChatResponse = ({
  openAi,
  initialMessages,
  onSuccess,
  onError,
  tools,
}): UseChatResponse => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<
    ChatCompletionMessageOrReactElement[]
  >([]);
  const [error, setError] = useState<Error | undefined>();
  /* Loading states */
  // True as soon as user submits a message
  const [isLoading, setIsLoading] = useState<boolean>(false);
  // True while streaming response
  const [isStreaming, setIsStreaming] = useState<boolean>(false);

  useEffect(() => {
    if (initialMessages) {
      // Set initial messages on mount if provided
      setMessages(initialMessages);
    }
  }, []);

  const handleSubmit = async (msg: string) => {
    // Called on user message submission
    // Start loading
    setIsLoading(true);
    // Clear input on submit
    setInput('');

    const updatedMessages: ChatCompletionMessageOrReactElement[] = [
      ...messages,
      {
        // Append user submitted message to current messages
        content: msg,
        role: 'user',
      },
    ];

    // Also update all messages with new user message
    setMessages(updatedMessages);

    // Call to OpenAI API to get response
    await openAi.createChatCompletion(
      {
        messages: filterOutReactComponents(updatedMessages),
        tools: tools as Tools<{ [name: string]: z.Schema }> | undefined,
      },
      {
        onChunkReceived: (newMessages) => {
          // Streaming started - update streaming state
          setIsStreaming(true);
          // Update messages with streamed message
          setMessages([...updatedMessages, ...newMessages]);
        },
        onError: (error) => {
          // Reset loading and streaming states
          setIsStreaming(false);
          setIsLoading(false);
          // Error while streaming
          setError(error);
          // Call onError callback (if provided)
          onError?.(error);
        },
        onDone: (messages) => {
          // Reset loading and streaming states
          setIsStreaming(false);
          setIsLoading(false);
          // Streaming done - call onSuccess callback
          onSuccess?.(messages);
        },
      },
    );
  };

  return {
    messages,
    input,
    isLoading,
    isStreaming,
    error,
    onInputChange: setInput,
    handleSubmit,
  };
};

export { useChat };
