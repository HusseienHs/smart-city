import { isApiError } from '@smart-city/api';
import type { MessageKey } from '@smart-city/shared/i18n';

/**
 * The translated message for a failed @smart-city/api call. ApiError carries its own safe,
 * translatable key; anything else (an unexpected throw) gets the generic server message.
 */
export function apiErrorMessageKey(error: unknown): MessageKey {
  return isApiError(error) ? error.messageKey : 'apiErrors.server';
}
