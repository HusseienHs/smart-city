import { translate } from '@smart-city/shared/i18n';
import { describe, expect, it } from 'vitest';

import { ApiError, isApiError, type ApiErrorCode } from './api-error';
import { fromSupabaseError, toApiError } from './to-api-error';

describe('fromSupabaseError', () => {
  const cases: [string, { code?: string; hint?: string }, number | undefined, ApiErrorCode][] = [
    ['RLS / uniform denial', { code: '42501' }, 403, 'forbidden'],
    ['permission denied without a session', { code: '42501' }, 401, 'unauthorized'],
    ['RPC validation', { code: '22023' }, 400, 'validation'],
    ['check constraint', { code: '23514' }, 400, 'validation'],
    ['malformed uuid', { code: '22P02' }, 400, 'validation'],
    ['unique violation', { code: '23505' }, 409, 'conflict'],
    ['no rows from .single()', { code: 'PGRST116' }, 406, 'not_found'],
    ['expired JWT', { code: 'PGRST301' }, 401, 'unauthorized'],
    ['RPC rate limit', { code: 'P0001', hint: 'rate_limited' }, 400, 'rate_limited'],
    ['other raised exception', { code: 'P0001' }, 400, 'server'],
    ['failed fetch', { code: '' }, 0, 'network'],
    ['HTTP 429 without a code', {}, 429, 'rate_limited'],
    ['HTTP 403 without a code', {}, 403, 'forbidden'],
    ['unknown database error', { code: 'XX000' }, 500, 'server'],
    ['nothing known', {}, undefined, 'server'],
  ];

  it.each(cases)('classifies %s', (_label, error, status, expected) => {
    expect(fromSupabaseError(error, status).code).toBe(expected);
  });
});

describe('ApiError safety', () => {
  const internal = {
    code: '42501',
    message: 'permission denied for table reports',
    details: 'column reporter_id',
    hint: 'Grant the required privileges with: GRANT SELECT ON public.reports TO anon;',
  };

  it('never exposes database internals through its message', () => {
    const error = fromSupabaseError(internal, 403);
    expect(error.message).toBe('Not found or access denied');
    expect(error.message).not.toContain('reports');
  });

  it('keeps internals available for debugging, but out of serialized output', () => {
    const error = fromSupabaseError(internal, 403);
    expect(error.debug).toEqual({ ...internal, status: 403 });

    const serialized = JSON.stringify(error);
    for (const secret of ['GRANT', 'reporter_id', 'permission denied']) {
      expect(serialized).not.toContain(secret);
    }
    expect(Object.keys(error)).not.toContain('debug');
  });

  it('provides a translated message for every error code, in every language', () => {
    const codes: ApiErrorCode[] = [
      'validation',
      'unauthorized',
      'forbidden',
      'not_found',
      'conflict',
      'rate_limited',
      'network',
      'server',
    ];
    for (const code of codes) {
      const { messageKey } = new ApiError(code);
      for (const locale of ['he', 'ar', 'en'] as const) {
        expect(translate(locale, messageKey)).not.toBe(messageKey);
      }
    }
  });

  it('marks only transient failures as retryable', () => {
    expect(new ApiError('network').retryable).toBe(true);
    expect(new ApiError('server').retryable).toBe(true);
    expect(new ApiError('rate_limited').retryable).toBe(true);
    expect(new ApiError('forbidden').retryable).toBe(false);
    expect(new ApiError('validation').retryable).toBe(false);
  });
});

describe('toApiError', () => {
  it('passes ApiErrors through unchanged', () => {
    const original = new ApiError('conflict');
    expect(toApiError(original)).toBe(original);
  });

  it('treats a fetch TypeError as a network failure', () => {
    const error = toApiError(new TypeError('Failed to fetch'));
    expect(error.code).toBe('network');
    expect(error.debug.message).toBe('Failed to fetch');
    expect(error.message).not.toContain('fetch failed');
  });

  it('hides anything else behind a generic server error', () => {
    for (const thrown of [new Error('secret stack detail'), 'a string', null]) {
      const error = toApiError(thrown);
      expect(isApiError(error)).toBe(true);
      expect(error.code).toBe('server');
      expect(error.message).not.toContain('secret');
    }
  });
});
