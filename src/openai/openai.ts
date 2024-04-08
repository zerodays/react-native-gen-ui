import {
  ChatCompletionCallbacks,
  ChatCompletionCreateParams,
} from './chat-completion';
import { OpenAIApi } from './openai-api';

// OpenAI API parameters
export type OpenAIApiParams = {
  apiKey: string;
  model: string;
  basePath?: string;
};

// OpenAI class mimics some functionality from the official [OpenAI TypeScript Library](https://github.com/openai/openai-node)
export class OpenAI {
  private api: OpenAIApi;
  private model: string;

  constructor({ apiKey, model, basePath }: OpenAIApiParams) {
    this.api = new OpenAIApi({
      apiKey,
      basePath,
    });
    this.model = model;
  }

  private getApi() {
    return this.api;
  }

  async createChatCompletion(
    params: Omit<
      ChatCompletionCreateParams,
      'model' | 'temperature' | 'stream'
    >,
    callbacks: ChatCompletionCallbacks,
  ) {
    return this.getApi().createChatCompletion(
      {
        ...params,
        model: this.model,
        temperature: 0.3,
        stream: true,
      },
      callbacks,
    );
  }
}
