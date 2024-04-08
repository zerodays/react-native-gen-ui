# React Native Generative UI Library

Inspired by Vercel's [Generative UI](https://sdk.vercel.ai/docs/concepts/ai-rsc) for React Server Components. Offering a seamless integration of OpenAI's advanced AI capabilities within React Native applications. Library provides components and helpers for building AI-powered streaming text and chat UIs.

## Features

- React Native (with Expo) type-safe helpers for streaming text responses + components for building chat UIs
- First-class support for [Function calling](https://platform.openai.com/docs/guides/function-calling) with component support that LLM decides to redner for interactive user interfaces
- Easy UI implementation with powerful `useChat` hook
- Support for [OpenAI models](https://platform.openai.com/docs/guides/text-generation)

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

Ensure you have the OpenAI API key and the desired model environment variables set up in your project. These are stored as environment variables (in Expo):

### Initialization

```
EXPO_PUBLIC_OPENAI_API_KEY=sk....           # Required, you can get one in OpenAi dashboard
EXPO_PUBLIC_OPENAI_MODEL=model_name_here    # Optional, model name from OpenAI (defaults to 'gpt-4')
```

### Import

To get started, import `useChat` hook in any React component:

```ts
import { useChat } from 'react-native-gen-ui';
```

### Use the hook

Initialize the `useChat` hook inside your component. You can optionally pass **initial messages**, **success** and **error handlers**, and any tools validators you might need for validating messages.

```ts
const { input, messages, isLoading, handleSubmit, onInputChange } = useChat({
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

```ts
return (
  <View>
    {messages.map((msg, index) => (
      <Text key={index}>{msg.content}</Text>
    ))}
    <TextInput value={input} onChangeText={onInputChange} />
    <Button
      onPress={() => handleSubmit(input)}
      title="Send"
      disabled={isLoading}
    />
  </View>
);
```

Ensure you pass the input state to the TextInput component, onInputChange to handle text changes, and handleSubmit for sending messages.

Congrats :tada: you successfully implemented chat using OpenAI model!

## Function calling (Tools) :wrench:

The `useChat` hook supports the integration of **Tools**, a powerful feature allowing you to incorporate custom functions or external API calls directly into your chat flow.

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
          yield <SearchingLocation />;

          // Call API for current weather
          const weatherData = await fetchWeatherData(args.location);

          return {
            component: (
              // Actual component to render after data fetching is done
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

Tools framework within `useChat` is highly extensible. You can define multiple tools to perform various functions based on your chat application's requirements, enriching the user experience with interactive and dynamic content.

### Guiding AI's response bahvior

The `render` function within each tool in the `useChat` hook provides a powerful mechanism for not just interacting with users through React components, but also for guiding the AI's response behavior.

This is achieved through an **optional** `data` **object** that the function can return alongside the component. `data` object consist of following parameters:

```ts
...
return {
    component: ...,
    // Optional - used for guiding the AI's response behavior
    data: {
        // A hint for the chat model on how to describe the weather data in a conversational manner
        howYouShouldRespond: "You should write a few sentences about the weather based on the data provided.",
        // Example: weather data details
        // provide both the model and the application with specific information about the weather
        // enabling tailored responses and potential follow-up interactions
        current: weatherData[0],
        forecast: weatherData,
        location: args.location,
    },
};
```

By leveraging the data object effectively, you can create more engaging, informative, and interactive chat experiences within their React Native applications.

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
  initialMessages: [], // Initial messages chat messages
  onSuccess: () => {...}, // Called when streaming response is completed
  onError: (error) => {...}, // Called when an error occurs while streaming
  tools: ... // Tools for custom API calls or functions
});
```

## Examples

TODO

## License

Published under MIT License, more details at [LICENSE](LICENSE) file.
