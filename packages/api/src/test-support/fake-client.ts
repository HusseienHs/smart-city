import type { SmartCityClient } from '../client';

export interface RecordedCall {
  method: string;
  args: unknown[];
}

export interface FakeResponse {
  data?: unknown;
  error?: { code?: string; message?: string; details?: string; hint?: string } | null;
  status?: number;
}

/**
 * A stand-in for the Supabase query builder: records every chained call, then resolves to the
 * configured response (or rejects, to simulate a thrown failure). Tests only.
 */
export function fakeClient(response: FakeResponse | Error) {
  const calls: RecordedCall[] = [];
  const settle = () =>
    response instanceof Error
      ? Promise.reject(response)
      : Promise.resolve({
          data: response.data ?? null,
          error: response.error ?? null,
          status: response.status ?? 200,
        });

  const builder: Record<string, unknown> = new Proxy(
    {},
    {
      get(_target, property) {
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
