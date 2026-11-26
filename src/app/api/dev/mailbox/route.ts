import { route, uuid } from '@/server/http/handler';
import { env } from '@/config/env';
import { devMailbox } from '@/server/auth/local-provider';
import { AppError } from '@/server/http/errors';

/** Caixa de e-mails de DESENVOLVIMENTO (provedor local). Indisponível em produção/homologação. */
export const GET = route({ auth: 'public' }, async () => {
  if (env().NEXO_ENV === 'production' || env().NEXO_ENV === 'staging' || env().NEXO_AUTH_PROVIDER !== 'local') throw new AppError(404, 'not_found', 'Não encontrado.');
  return { messages: devMailbox().slice(-50) };
});
