import { route, uuid } from '@/server/http/handler';
import { asService } from '@/server/db';
import { requiredDocuments } from '@/server/services/account';

export const GET = route({ auth: 'public' }, async () => ({ documents: await asService((tx) => requiredDocuments(tx)) }));
