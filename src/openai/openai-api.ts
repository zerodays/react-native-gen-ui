import { OPENAI_BASE_PATH } from './constants';
import {
  ChatCompletion,
  ChatCompletionCallbacks,
  ChatCompletionCreateParams,
} from './chat-completion';

export class OpenAIApi {
  apiKey: string;
  basePath: string;
  constructor({ apiKey, basePath }: { apiKey: string; basePath?: string }) {
    this.apiKey = apiKey;
    this.basePath = basePath ?? OPENAI_BASE_PATH;
  }

  public createChatCompletion(
    params: ChatCompletionCreateParams,
    callbacks: ChatCompletionCallbacks,
  ): Promise<ChatCompletion> {
    return new Promise((resolve) => {
      const cc = new ChatCompletion(this, params, callbacks);
      cc.start();
      resolve(cc);
    });
  }
}
