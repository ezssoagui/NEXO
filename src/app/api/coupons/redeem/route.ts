import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { redeemCoupon } from '@/server/services/commerce';

export const POST = route({ auth: 'student', body: z.object({ code: z.string().trim().min(3).max(32) }), rateLimit: { bucket: 'coupon', limit: 10, windowSeconds: 3600 } }, async ({ user, body }) => redeemCoupon(user!.id, body.code));
