const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3333';

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  token?: string;
};

export function toQueryString(params: Record<string, string | null | undefined>) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, value);
    }
  });
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers ?? {}),
  };

  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const hasBody = response.status !== 204 && response.status !== 205;
  const isJson = response.headers.get('content-type')?.includes('application/json');

  if (!response.ok) {
    const detail =
      hasBody && isJson ? await response.json().catch(() => undefined) : await response.text();
    const errorMessage =
      typeof detail === 'string'
        ? detail
        : detail?.detail?.[0]?.msg ?? detail?.message ?? 'Request failed. Please try again.';
    throw new Error(errorMessage);
  }

  if (!hasBody) {
    return undefined as T;
  }

  if (!isJson) {
    return null as T;
  }

  return (await response.json()) as T;
}
