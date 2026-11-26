import { NextResponse } from 'next/server';
import { route, uuid } from '@/server/http/handler';
import { claimsOf } from '@/server/auth';
import { createDataRequest, exportMyData } from '@/server/services/account';

export const GET = route({ auth: 'user', rateLimit: { bucket: 'export', limit: 5, windowSeconds: 3600 } }, async ({ user }) => {
  const data = await exportMyData(claimsOf(user!));
  await createDataRequest(user!.id, 'export');
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': 'attachment; filename="nexo-meus-dados.json"' },
  });
});
