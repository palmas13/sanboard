export interface JsonApiErrorPayload {
  error?: string;
  message?: string;
}

export async function readJsonResponse<T>(
  response: Response,
  fallbackError: string
): Promise<T> {
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error(
      response.ok
        ? fallbackError
        : `${fallbackError} (HTTP ${response.status})`
    );
  }

  let payload: T;
  try {
    payload = await response.json() as T;
  } catch {
    throw new Error(`${fallbackError} Sunucu geçersiz bir JSON yanıtı döndürdü.`);
  }

  if (!response.ok) {
    const errorPayload = payload as JsonApiErrorPayload;
    throw new Error(errorPayload.error || errorPayload.message || `${fallbackError} (HTTP ${response.status})`);
  }

  return payload;
}