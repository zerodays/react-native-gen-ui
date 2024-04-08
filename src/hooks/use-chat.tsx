import React, { useEffect, useState } from "react";
import {
  ChatCompletionMessageOrReactComponent,
  OpenAI,
  Tools,
  ValidatorsObject,
  filterOutReactComponents,
} from "../utils/openai";
import { ChatCompletionMessageParam } from "openai/resources";
import { z } from "zod";

interface UseChatParams<V extends ValidatorsObject = {}> {
  // Initial messages to display
  initialMessages?: ChatCompletionMessageParam[];
  // Called when streaming response is completed
  onSuccess?: (messages: ChatCompletionMessageOrReactComponent[]) => void;
  // Called when an error occurs while streaming
  onError?: (error: Error) => void;
  tools?: Tools<V>;
}

interface UseChatResponse {
  // State of user input (i.e. in TextInput component)
  input: string;
  // Messages of current chat session
  messages: ChatCompletionMessageOrReactComponent[];
  // Error that can occur during streaming
  error: Error | undefined;
  // Loading state - true immediately after user message submission
  isLoading: boolean;
  // Streaming state - true while streaming response
  isStreaming: boolean;
  // Updates internal state of user input
  onInputChange: React.Dispatch<React.SetStateAction<string>>;
  // Handles user message submission
  handleSubmit: (msg: string) => void;
}

const openAi = new OpenAI({
  // OpenAI instance initialization
  apiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? "",
  model: "gpt-4-0125-preview",
});

export const wait = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Hook that handles chat logic for user chat conversation
const useChat: <V extends ValidatorsObject = {}>(
  params: UseChatParams<V>
) => UseChatResponse = ({
  initialMessages,
  onSuccess,
  onError,
  tools,
} = {}): UseChatResponse => {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<
    ChatCompletionMessageOrReactComponent[]
  >([]);
  const [error, setError] = useState<Error | undefined>();
  // Loading states
  const [isLoading, setIsLoading] = useState<boolean>(false);
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
    setInput("");

    const updatedMessages: ChatCompletionMessageOrReactComponent[] = [
      ...messages,
      // Append user submitted message to current messages
      {
        content: msg,
        role: "user",
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
          onError?.(error);
        },
        onDone: (messages) => {
          // Reset loading and streaming states
          setIsStreaming(false);
          setIsLoading(false);
          // Streaming done - call onSuccess callback
          onSuccess?.(messages);
        },
      }
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

export {useChat};
