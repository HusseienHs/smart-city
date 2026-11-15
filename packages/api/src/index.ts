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

export * from './auth/auth';
export * from './auth/auth-callback';
export * from './auth/auth-errors';

export * from './reference-data/columns';
export * from './reference-data/reference-data';

export * from './me/columns';
export * from './me/me';
export * from './me/report-media';

export * from './reports/submission';
export * from './reports/public-reports';

export * from './staff/staff';
export * from './staff/report-columns';
export * from './staff/reports';
export * from './utils/geo';
export * from './staff/directory';
export * from './staff/media';
export * from './staff/workflow';
export * from './auth/staff-sign-up';
export * from './staff/departments';
export * from './staff/staff-admin';
