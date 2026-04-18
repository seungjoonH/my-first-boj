import 'server-only';

export function getAdminUuid(): string {
  const raw = process.env.CHAT_ADMIN_UUID?.trim();
  if (!raw) throw new Error('CHAT_ADMIN_UUID is required');
  return raw;
}

export function isReservedChatUuid(uuid: string): boolean {
  return uuid === getAdminUuid();
}
