export type AuthCallback =
  /** A PKCE code to exchange for a session. */
  | { kind: 'code'; code: string }
  /** Supabase rejected the link, usually because it expired or was already used. */
  | { kind: 'error' }
  /**
   * A confirmation link that returned tokens instead of a code. Supabase has already confirmed the
   * email by this point. The tokens are deliberately not used: unlike a PKCE code they aren't tied
   * to this device, so a crafted link could otherwise sign the user into someone else's account.
   */
  | { kind: 'email-confirmed' }
  | { kind: 'none' };

export type AuthCallbackParams = Readonly<Record<string, string | string[] | undefined>>;

function parseParams(text: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const pair of text.split('&')) {
    const separator = pair.indexOf('=');
    if (separator <= 0) continue;
    const value = pair.slice(separator + 1).replace(/\+/g, ' ');
    try {
      params[pair.slice(0, separator)] = decodeURIComponent(value);
    } catch {
      params[pair.slice(0, separator)] = value;
    }
  }
  return params;
}

/** Splits by hand so `exp://` and custom-scheme links parse the same way on every runtime. */
function parseUrlParams(url: string | null): Record<string, string> {
  if (!url) return {};
  const hashStart = url.indexOf('#');
  const hash = hashStart === -1 ? '' : url.slice(hashStart + 1);
  const withoutHash = hashStart === -1 ? url : url.slice(0, hashStart);
  const queryStart = withoutHash.indexOf('?');
  const query = queryStart === -1 ? '' : withoutHash.slice(queryStart + 1);
  return { ...parseParams(hash), ...parseParams(query) };
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Reads the auth callback from the router's params and the raw link. The raw link is needed
 * because Expo Router drops the `#fragment`, where Supabase can put errors and tokens.
 */
export function readAuthCallback(
  routeParams: AuthCallbackParams,
  url: string | null,
): AuthCallback {
  const params = parseUrlParams(url);
  const failed =
    single(routeParams.error) ??
    single(routeParams.error_code) ??
    params.error ??
    params.error_code;
  if (failed) return { kind: 'error' };

  const code = single(routeParams.code) ?? params.code;
  if (code) return { kind: 'code', code };

  if (params.access_token && params.type === 'signup') return { kind: 'email-confirmed' };
  return { kind: 'none' };
}
