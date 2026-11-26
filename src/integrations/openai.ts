import { z, type ZodType } from 'zod';
import { env } from '@/config/env';

/**
 * Adaptador OpenAI (Responses API) — somente servidor (15.8).
 * - Saída estruturada via json_schema estrito; validação final sempre com Zod no serviço.
 * - store=false para minimizar retenção no fornecedor (13.4).
 * - Timeout e erros classificados; o retry é decidido pelo serviço (limitado).
 * - Chamadas reais exigem OPENAI_ALLOW_PAID_CALLS=true (autorização dos sócios).
 */
export interface AiRequest {
  model: string;
  system: string;
  user: string;
  schemaName: string;
  jsonSchema: Record<string, unknown>;
  maxOutputTokens: number;
  timeoutMs?: number;
}

export type AiTransportResult =
  | { kind: 'ok'; json: unknown; inputTokens: number; outputTokens: number }
  | { kind: 'invalid_output'; inputTokens: number; outputTokens: number; error: string }
  | { kind: 'provider_error'; status: number; error: string }
  | { kind: 'timeout' };

export type AiTransport = (req: AiRequest) => Promise<AiTransportResult>;

export const openAiTransport: AiTransport = async (req) => {
  const e = env();
  if (!e.OPENAI_API_KEY) return { kind: 'provider_error', status: 0, error: 'missing_api_key' };
  try {
    const res = await fetch(`${e.OPENAI_BASE_URL}/responses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${e.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(req.timeoutMs ?? 90_000),
      body: JSON.stringify({
        model: req.model,
        input: [
          { role: 'developer', content: req.system },
          { role: 'user', content: req.user },
        ],
        text: { format: { type: 'json_schema', name: req.schemaName, schema: req.jsonSchema, strict: true } },
        max_output_tokens: req.maxOutputTokens,
        store: false,
      }),
    });
    if (!res.ok) return { kind: 'provider_error', status: res.status, error: `http_${res.status}` };
    const data = (await res.json()) as {
      status?: string;
      output?: { type: string; content?: { type: string; text?: string }[] }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const inputTokens = data.usage?.input_tokens ?? 0;
    const outputTokens = data.usage?.output_tokens ?? 0;
    const text = data.output?.flatMap((o) => o.content ?? []).find((c) => c.type === 'output_text')?.text;
    if (data.status !== 'completed' || !text) return { kind: 'invalid_output', inputTokens, outputTokens, error: `status_${data.status ?? 'unknown'}` };
    try {
      return { kind: 'ok', json: JSON.parse(text), inputTokens, outputTokens };
    } catch {
      return { kind: 'invalid_output', inputTokens, outputTokens, error: 'json_parse' };
    }
  } catch (err) {
    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) return { kind: 'timeout' };
    return { kind: 'provider_error', status: 0, error: 'network' };
  }
};

/** Embeddings para o índice RAG (custo administrativo). */
export async function createEmbedding(model: string, input: string): Promise<number[] | null> {
  const e = env();
  if (!e.OPENAI_API_KEY || e.OPENAI_ALLOW_PAID_CALLS !== 'true') return null;
  const res = await fetch(`${e.OPENAI_BASE_URL}/embeddings`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${e.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({ model, input }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { data?: { embedding: number[] }[] };
  return data.data?.[0]?.embedding ?? null;
}

/**
 * Converte schema Zod em JSON Schema compatível com o modo estrito:
 * todos os campos obrigatórios, additionalProperties=false e remoção de palavras-chave
 * não suportadas (os limites continuam validados pelo Zod após a resposta).
 */
export function toStrictJsonSchema(schema: ZodType): Record<string, unknown> {
  const raw = z.toJSONSchema(schema, { target: 'draft-7', io: 'output' }) as Record<string, unknown>;
  const DROP = new Set(['$schema', 'minLength', 'maxLength', 'format', 'pattern', 'default']);
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== 'object') return node;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (DROP.has(k)) continue;
      out[k] = walk(v);
    }
    if (out.type === 'object' && out.properties && typeof out.properties === 'object') {
      out.required = Object.keys(out.properties as object);
      out.additionalProperties = false;
    }
    if (Array.isArray(out.anyOf) && out.anyOf.length === 2 && (out.anyOf as { type?: string }[]).some((a) => a.type === 'null')) {
      const other = (out.anyOf as Record<string, unknown>[]).find((a) => a.type !== 'null')!;
      delete out.anyOf;
      Object.assign(out, other, { type: [other.type, 'null'] });
      if (Array.isArray(other.enum)) out.enum = [...(other.enum as unknown[]), null];
    }
    return out;
  };
  return walk(raw) as Record<string, unknown>;
}
