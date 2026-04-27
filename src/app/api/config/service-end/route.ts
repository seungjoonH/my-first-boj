import { getServiceEndMs } from '@/lib/serviceEndMs';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const endMs = await getServiceEndMs();
  return Response.json({ endMs });
}
