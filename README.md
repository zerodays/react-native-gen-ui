# React Native Generative UI Library

Inspired by Vercel's [Generative UI](https://sdk.vercel.ai/docs/concepts/ai-rsc) for React Server Components.

Offers a seamless integration of OpenAI's advanced AI capabilities within React Native applications. Library provides components and helpers for building AI-powered streaming text and chat UIs.

![Example Gif](assets/example.gif)

## Features

- React Native (with Expo) type-safe helpers for streaming text responses + components for building chat UIs
- First-class support for [Function calling](https://platform.openai.com/docs/guides/function-calling) with component support that LLM decides to render for interactive user interfaces
- Easy UI implementation with powerful `useChat` hook
- Support for [OpenAI models](https://platform.openai.com/docs/guides/text-generation)
- Streaming responses (only streaming is supported ATM).
- Supports OpenAI's [Chat completions](https://platform.openai.com/docs/guides/text-generation/chat-completions-api) API.

## Installation :rocket:

It's easy to get started - just install package with your favorite package manager:

### Yarn

```bash
yarn add react-native-gen-ui
```

### NPM

```bash
npm install react-native-gen-ui
```

## Basic usage :tada:

### Import

To get started, import `useChat` hook in any React component:

```ts
import { OpenAI, isReactElement, useChat } from 'react-native-gen-ui';
```

### Initialize the OpenAI instance

```ts
const openAi = new OpenAI({
  apiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY!,
  model: 'gpt-4',
  // You can even set a custom basePath of your SSE server
});
```

Ensure you have the OpenAI API key and the desired model environment variables set up in your project. These are stored as environment variables (in Expo):

```
EXPO_PUBLIC_OPENAI_API_KEY=sk....           # Required, you can get one in OpenAi dashboard
EXPO_PUBLIC_OPENAI_MODEL=model_name_here    # Optional, model name from OpenAI (defaults to 'gpt-4')
```

**🚨 Note:** This kind of implementation where you access OpenAI directly from the client device exposes your OpenAI API key to the public. The documentation here is just an example, for production use make sure to point `basePath` to your proxy server that forwards server sent events from OpenAI back to the client.

### Use the hook

Initialize the `useChat` hook inside your component. You can optionally pass **initial messages**, **success** and **error handlers**, and any tools the model will have access to.

```ts
const { input, messages, isLoading, handleSubmit } = useChat({
  openAi,
  // Optional initial messages
  initialMessages: [
    { content: 'Hi! How can I help you today?', role: 'system' },
  ],
  // Optional success handler
  onSuccess: (messages) => console.log('Chat success:', messages),
  // Optional error handler
  onError: (error) => console.error('Chat error:', error),
});
```

Create the UI for your chat interface that includes input, submit button and a view to display the chat messages.

```tsx
return (
  <View>
    {messages.map((msg, index) => {
      // Message can be react component or string (see function calling section for more details)
      if (isReactElement(msg)) {
        return msg;
      }
      switch (msg.role) {
        case 'user':
          return (
            <Text
              style={{
                color: 'blue',
              }}
              key={index}>
              {msg.content?.toString()}
            </Text>
          );
        case 'assistant':
          return <Text key={index}>{msg.content?.toString()}</Text>;
        default:
          // This includes tool calls, tool results and system messages
          // Those are visible to the model, but here we hide them to the user
          return null;
      }
    })}
    <TextInput value={input} onChangeText={onInputChange} />
    <Button
      onPress={() => handleSubmit(input)}
      title="Send"
      disabled={isLoading}
    />
  </View>
);
```

Ensure you pass the input state to the `TextInput` component, `onInputChange` to handle text changes, and `handleSubmit` for sending messages.

Congrats :tada: you successfully implemented chat using OpenAI model!

## Function calling (Tools) :wrench:

The `useChat` hook supports the integration of [Tools](https://platform.openai.com/docs/api-reference/chat/create#chat-create-tools), a powerful feature allowing you to incorporate custom functions or external API calls directly into your chat flow.

### Defining a Tool

Tools are defined as part of the `tools` parameter when initializing the `useChat` hook. Parameters are validated using [zod schema](https://zod.dev/). Below is example of weather forecast defined as tool:

```ts
const { input, messages, isLoading, handleSubmit, onInputChange } = useChat({
     ...
     tools: {
      getWeather: {
        description: "Get weather for a location",
        // Validate tool parameters using zod
        parameters: z.object({
          // In this case, tool accepts date and location for weather
          date: z.date().default(() => new Date()),
          location: z.string(),
        }),
        // Render component for weather - can yield loading state
        render: async function* (args) {
          // With 'yield' we can show loading  while fetching weather data
          yield <Spinner />;

          // Call API for current weather
          const weatherData = await fetchWeatherData(args.location);

          // We can yield again to replace the loading component at any time.
          // This can be useful for showing progress or intermediate states.
          yield <Loading />

          // Return the final result
          return {
            // The data will be seen by the model
            data: weatherData,
            // The component will be rendered to the user
            component: (
              <Weather
                location={args.location}
                current={weatherData[0]}
                forecast={weatherData}
              />
            ),
          };
        }
      }
    }
});
```

Tools framework within `useChat` is highly extensible. You can define multiple tools to perform various functions based on your chat application's requirements.

## Reference

```ts
const {
  input, // State of user input (i.e. in TextInput component)
  messages, // List of all messages for current chat session
  error, // Error that can occur during streaming
  isLoading, // Loading state - true immediately after user message submission
  isStreaming, // Streaming state - true while streaming response
  onInputChange, // Updates internal state of user input
  handleSubmit, // Handles user message submission
} = useChat({
  openAi: OpenAI, // OpenAI instance (imported from 'react-native-gen-ui')
  initialMessages: [], // Initial messages chat messages
  onSuccess: () => {...}, // Called when streaming response is completed
  onError: (error) => {...}, // Called when an error occurs while streaming
  tools: ... // Tools for custom API calls or functions
});
```

## Examples

- Minimal: https://github.com/zerodays/react-native-gen-ui-minimal-example
- Location & Weather: https://github.com/zerodays/react-native-gen-ui-weather-example

## License

Published under MIT License, more details at [LICENSE](LICENSE) file.
