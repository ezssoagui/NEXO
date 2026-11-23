import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { z } from 'zod';

/**
 * Abstração de provedor de IA: trocar de provedor = implementar esta interface.
 * As chaves ficam SOMENTE no servidor (variáveis de ambiente); nada é enviado ao navegador.
 */
export interface StructuredRequest<T extends z.ZodType> { system: string; user: string; schema: T; maxTokens?: number; effort?: 'low' | 'medium' | 'high' }
export interface StructuredResult<T> { data: T; usage: { input: number; output: number }; model: string }
export class ProviderError extends Error { constructor(public code: 'not_configured' | 'rate_limited' | 'unavailable' | 'refusal' | 'invalid_output' | 'timeout' | 'bad_request', msg: string, public retryable = false) { super(msg); } }
export interface LLMProvider { name: string; model: string; configured: boolean; structured<T extends z.ZodType>(req: StructuredRequest<T>): Promise<StructuredResult<z.infer<T>>> }

/** Preço por milhão de tokens (US$) para estimar custo. */
export const PRICES: Record<string, { in: number; out: number }> = { 'claude-opus-5-5': { in: 4, out: 20 }, 'claude-sonnet-5-5': { in: 2, out: 10 }, 'claude-haiku-5-5': { in: 0.1, out: 0.5 } };

export class AnthropicProvider implements LLMProvider {
  name = 'anthropic'; configured: boolean; private client?: Anthropic;
  constructor(public model = process.env.NEXO_AI_MODEL || 'claude-opus-5-5') {
    this.configured = !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
    if (this.configured) this.client = new Anthropic({ timeout: 45_000, maxRetries: 2 });
  }
  async structured<T extends z.ZodType>(req: StructuredRequest<T>): Promise<StructuredResult<z.infer<T>>> {
    if (!this.client) throw new ProviderError('not_configured', 'Nenhuma credencial de IA configurada no servidor.');
    try {
      const res = await this.client.messages.parse({
        model: this.model,
        max_tokens: req.maxTokens ?? 4000,
        system: req.system,
        messages: [{ role: 'user', content: req.user }],
        output_config: { effort: req.effort ?? 'low', format: zodOutputFormat(req.schema) },
      });
      if (res.stop_reason === 'refusal') throw new ProviderError('refusal', 'O modelo recusou a solicitação.');
      if (res.stop_reason === 'max_tokens' || !res.parsed_output) throw new ProviderError('invalid_output', 'Resposta incompleta ou fora do formato esperado.', true);
      return { data: res.parsed_output as z.infer<T>, usage: { input: res.usage.input_tokens, output: res.usage.output_tokens }, model: res.model };
    } catch (e) {
      if (e instanceof ProviderError) throw e;
      if (e instanceof Anthropic.RateLimitError) throw new ProviderError('rate_limited', 'Limite de requisições do provedor atingido.', true);
      if (e instanceof Anthropic.APIConnectionTimeoutError) throw new ProviderError('timeout', 'O provedor demorou demais para responder.', true);
      if (e instanceof Anthropic.BadRequestError) throw new ProviderError('bad_request', 'Requisição rejeitada pelo provedor.');
      if (e instanceof Anthropic.APIError) throw new ProviderError('unavailable', `Provedor indisponível (${e.status ?? 'sem status'}).`, true);
      throw new ProviderError('unavailable', 'Falha de conexão com o provedor.', true);
    }
  }
}

/** Provedor de teste: permite simular respostas e falhas sem rede. */
export class MockProvider implements LLMProvider {
  name = 'mock'; model = 'mock'; configured = true;
  constructor(private impl: (req: StructuredRequest<any>) => unknown | Promise<unknown>) {}
  async structured<T extends z.ZodType>(req: StructuredRequest<T>): Promise<StructuredResult<z.infer<T>>> {
    const out = await this.impl(req);
    const parsed = req.schema.safeParse(out);
    if (!parsed.success) throw new ProviderError('invalid_output', 'Saída do provedor não corresponde ao esquema.');
    return { data: parsed.data, usage: { input: 100, output: 50 }, model: 'mock' };
  }
}

export function providerFromEnv(): LLMProvider {
  const p = (process.env.NEXO_AI_PROVIDER || 'anthropic').toLowerCase();
  if (p === 'anthropic') return new AnthropicProvider();
  return { name: 'none', model: '-', configured: false, structured: async () => { throw new ProviderError('not_configured', `Provedor "${p}" não suportado.`); } };
}
