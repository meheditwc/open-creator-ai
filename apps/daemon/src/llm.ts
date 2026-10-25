import type { LlmSettings } from '@open-creator/shared';

/**
 * Minimal OpenAI-compatible client.
 *
 * It speaks to any local router (FreeLLMAPI, Ollama, LM Studio, LiteLLM,
 * vLLM…) as well as hosted OpenAI-compatible endpoints. Nothing is required:
 * when no provider is reachable the studio still works in "local" mode.
 */
export interface LlmResult {
  content: string;
  model: string;
}

export interface LlmProbe {
  reachable: boolean;
  models: string[];
  error?: string;
}

export class LlmClient {
  private readonly settings: LlmSettings;

  constructor(settings: LlmSettings) {
    this.settings = settings;
  }

  private get endpoint(): string {
    return this.settings.baseUrl.replace(/\/$/, '');
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (this.settings.apiKey) headers.authorization = `Bearer ${this.settings.apiKey}`;
    return headers;
  }

  async chat(system: string, user: string, timeoutMs = 45_000): Promise<LlmResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${this.endpoint}/chat/completions`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          model: this.settings.model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          temperature: 0.6,
          stream: false,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`provider responded with ${response.status} ${response.statusText}`);
      }

      const payload = (await response.json()) as {
        model?: string;
        choices?: { message?: { content?: string } }[];
      };
      const content = payload.choices?.[0]?.message?.content?.trim();
      if (!content) throw new Error('provider returned an empty completion');
      return { content, model: payload.model ?? this.settings.model };
    } finally {
      clearTimeout(timer);
    }
  }

  async probe(timeoutMs = 4_000): Promise<LlmProbe> {
    if (!this.settings.baseUrl) {
      return { reachable: false, models: [], error: 'no base URL configured' };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${this.endpoint}/models`, {
        headers: this.headers(),
        signal: controller.signal,
      });
      if (!response.ok) {
        return { reachable: false, models: [], error: `${response.status} ${response.statusText}` };
      }
      const payload = (await response.json()) as { data?: { id?: string }[] };
      const models = (payload.data ?? [])
        .map((model) => model.id)
        .filter((id): id is string => Boolean(id));
      return { reachable: true, models };
    } catch (error) {
      return {
        reachable: false,
        models: [],
        error: error instanceof Error ? error.message : 'unknown error',
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
