/** Erros de aplicação independentes do framework (usados pelos serviços de domínio). */
export class AppError extends Error {
  constructor(public status: number, public code: string, message?: string, public details?: unknown) {
    super(message ?? code);
  }
}

export const notFound = (what = 'Recurso') => new AppError(404, 'not_found', `${what} não encontrado.`);
export const forbidden = (msg = 'Acesso negado.') => new AppError(403, 'forbidden', msg);
export const badRequest = (msg: string, details?: unknown) => new AppError(400, 'bad_request', msg, details);
export const conflict = (msg: string, code = 'conflict') => new AppError(409, code, msg);
