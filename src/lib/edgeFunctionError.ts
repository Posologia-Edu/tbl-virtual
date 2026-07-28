// supabase.functions.invoke() throws a generic "Edge Function returned a
// non-2xx status code" message for any non-2xx response — the actual JSON
// body (e.g. { error: "PLAN_LIMIT", message, used, limit }) only lives on
// error.context, a raw Response. This unwraps it so callers can branch on
// the real error code (PLAN_LIMIT, etc.) instead of parsing error.message.
export interface EdgeFunctionErrorBody {
  code?: string;
  message?: string;
}

export async function parseEdgeFunctionError(error: unknown): Promise<EdgeFunctionErrorBody | null> {
  const context = (error as { context?: unknown } | null | undefined)?.context;
  if (!context || typeof context !== 'object' || !('json' in context)) return null;
  try {
    const body = await (context as Response).clone().json();
    return { code: body?.error, message: body?.message };
  } catch {
    return null;
  }
}
