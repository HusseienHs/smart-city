export type { SmartCityClient } from './client';
export type { Database, Enums, Json, Tables } from './database.types';

export {
  ApiError,
  isApiError,
  type ApiErrorCode,
  type ApiErrorDebugInfo,
  type ApiValidationIssue,
} from './errors/api-error';
export { fromSupabaseError, toApiError, type SupabaseErrorLike } from './errors/to-api-error';

export * from './reference-data/columns';
export * from './reference-data/reference-data';
