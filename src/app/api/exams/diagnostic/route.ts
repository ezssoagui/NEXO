import { route, uuid } from '@/server/http/handler';
import { createDiagnostic } from '@/server/services/exams';

export const POST = route({ auth: 'student', rateLimit: { bucket: 'diag', limit: 5, windowSeconds: 3600 } }, async ({ user }) => createDiagnostic(user!.id));
