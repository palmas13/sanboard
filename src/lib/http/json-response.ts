export interface JsonApiErrorPayload {
  error?: string;
  message?: string;
}

export async function readJsonResponse<T>(
  response: Response,
  fallbackError: string
): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  const statusError = response.status === 413
    ? `${fallbackError} Fotoğraflar yükleme sınırını aştı. Lütfen görselleri yeniden seçip tekrar deneyin.`
    : `${fallbackError} (HTTP ${response.status})`;

  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error(
      response.ok
        ? fallbackError
        : statusError
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
    throw new Error(errorPayload.error || errorPayload.message || statusError);
  }

  return payload;
}