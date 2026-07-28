// Postgres RAISE EXCEPTION messages from the quota triggers (see migration
// 20260728080000_enforce_free_plan_quotas.sql) are prefixed "PLAN_LIMIT: ".
// Unlike edge function errors, PostgREST puts this directly on error.message,
// so no unwrapping is needed — just check for the prefix.
export function isPlanLimitError(error: { message?: string } | null | undefined): boolean {
  return !!error?.message?.includes('PLAN_LIMIT');
}
