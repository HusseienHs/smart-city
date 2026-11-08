import type { SmartCityClient } from '../client';

export interface RecordedCall {
  method: string;
  args: unknown[];
}

export interface FakeResponse {
  data?: unknown;
  /**
   * A PostgREST-style error, or (for storage calls) a StorageApiError-like error with an HTTP
   * `status`/`statusCode` and the `__isStorageError` marker.
   */
  error?: {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
    status?: number;
    statusCode?: string;
    __isStorageError?: true;
  } | null;
  status?: number;
}

export interface FakeClientOptions {
  /** The signed-in user returned by `auth.getSession()`; null/omitted = no session. */
  userId?: string | null;
  /** Makes `auth.getSession()` reject, to simulate a storage or network failure. */
  sessionError?: Error;
}

/**
 * A stand-in for the Supabase query builder: records every chained call, then resolves to the
 * configured response (or rejects, to simulate a thrown failure). Tests only.
 *
 * Pass an array to answer consecutive queries in order (each `await` consumes one response;
 * the last one repeats). `auth.getSession()` reports `options.userId` as the signed-in user.
 * `storage.from(bucket).upload(...)` is recorded as `storage.from` / `storage.upload`.
 */
export function fakeClient(
  response: FakeResponse | Error | readonly (FakeResponse | Error)[],
  options: FakeClientOptions = {},
) {
  const calls: RecordedCall[] = [];
  const responses = Array.isArray(response) ? [...response] : [response];
  let next = 0;
  const settle = () => {
    const current = responses[Math.min(next, responses.length - 1)]!;
    next += 1;
    return current instanceof Error
      ? Promise.reject(current)
      : Promise.resolve({
          data: current.data ?? null,
          error: current.error ?? null,
          status: current.status ?? 200,
        });
  };

  const auth = {
    getSession: () => {
      calls.push({ method: 'auth.getSession', args: [] });
      if (options.sessionError) return Promise.reject(options.sessionError);
      const session = options.userId ? { user: { id: options.userId } } : null;
      return Promise.resolve({ data: { session }, error: null });
    },
  };

  // client.storage.from(bucket).upload(...) — consumes the next response like a query.
  const storage = {
    from: (bucket: string) => {
      calls.push({ method: 'storage.from', args: [bucket] });
      return {
        upload: (...args: unknown[]) => {
          calls.push({ method: 'storage.upload', args });
          return settle();
        },
        // Synchronous and offline, like storage-js: only builds the URL.
        getPublicUrl: (path: string) => {
          calls.push({ method: 'storage.getPublicUrl', args: [path] });
          return {
            data: {
              publicUrl: `https://project.supabase.co/storage/v1/object/public/${bucket}/${path}`,
            },
          };
        },
      };
    },
  };

  const builder: Record<string, unknown> = new Proxy(
    {},
    {
      get(_target, property) {
        if (property === 'auth') return auth;
        if (property === 'storage') return storage;
        if (property === 'then') {
          return (...args: Parameters<Promise<unknown>['then']>) => settle().then(...args);
        }
        return (...args: unknown[]) => {
          calls.push({ method: String(property), args });
          return builder;
        };
      },
    },
  );

  return { client: builder as unknown as SmartCityClient, calls };
}

/** The arguments of every recorded call to `method`, in call order. */
export function callArgs(calls: RecordedCall[], method: string): unknown[][] {
  return calls.filter((call) => call.method === method).map((call) => call.args);
}
