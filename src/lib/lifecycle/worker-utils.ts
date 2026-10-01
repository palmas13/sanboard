export interface RpcClient {
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message?: string } | null }>;
}

export function rows(value: unknown): Record<string, any>[] {
  if (Array.isArray(value)) return value as Record<string, any>[];
  return value && typeof value === 'object' ? [value as Record<string, any>] : [];
}

export async function rpc(client: RpcClient, name: string, args: Record<string, unknown> = {}) {
  const result = await client.rpc(name, args);
  if (result.error) throw new Error(`${name}: ${result.error.message || 'RPC failed'}`);
  return result.data;
}

export function errorMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.slice(0, 1000);
}
