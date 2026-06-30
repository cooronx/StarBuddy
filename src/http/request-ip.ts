export interface RequestWithIp {
  ip?: string;
  socket?: {
    remoteAddress?: string;
  };
  headers: Record<string, string | string[] | undefined>;
}

export function readRequestIp(request: RequestWithIp): string | undefined {
  const forwardedFor = request.headers['x-forwarded-for'];
  const rawForwardedFor = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor;

  return (
    rawForwardedFor?.split(',')[0]?.trim() ??
    request.ip ??
    request.socket?.remoteAddress
  );
}
