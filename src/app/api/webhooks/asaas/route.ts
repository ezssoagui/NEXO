import { NextResponse, type NextRequest } from 'next/server';
import { handleAsaasWebhook } from '@/server/services/commerce';
import { AppError } from '@/server/http/errors';

/** Webhook Asaas: autenticado por token, persistido e processado de forma idempotente (15.9). */
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const r = await handleAsaasWebhook(req.headers.get('asaas-access-token'), payload);
    return NextResponse.json(r);
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: err.code }, { status: err.status });
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
