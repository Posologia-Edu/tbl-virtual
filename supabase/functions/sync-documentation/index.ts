import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders, CORS_HEADERS_SHORT } from "../_shared/cors.ts";
import { DEFAULT_PROVIDER_ORDER, getConfiguredApiKeys, tryExternalProvider, tryLovableAI } from "../_shared/ai-providers.ts";

// Called by .github/workflows/sync-documentation.yml on every push to main.
// No end-user is involved (the caller is CI), so auth is a shared secret
// instead of a Supabase JWT — see DOCS_SYNC_SECRET / verify_jwt=false in
// config.toml. Always responds 200 with changed:false on anything
// inconclusive so it never fails the calling workflow.

const ICON_ALLOWLIST = new Set([
  "Sparkles", "Brain", "Monitor", "BookOpen", "Users", "Target",
  "BarChart3", "GraduationCap", "Award", "MessageSquare", "Eye", "WifiOff",
  "HelpCircle",
]);
const FALLBACK_ICON = "HelpCircle";

interface DocItem { q: string; a: string }
interface DocSection { id: string; icon: string; title: string; items: DocItem[] }

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function validateSection(sec: any): DocSection | null {
  if (!sec || !isNonEmptyString(sec.id) || !isNonEmptyString(sec.title)) return null;
  if (!Array.isArray(sec.items) || sec.items.length === 0) return null;
  const items: DocItem[] = [];
  for (const item of sec.items) {
    if (!isNonEmptyString(item?.q) || !isNonEmptyString(item?.a)) return null;
    items.push({ q: item.q.trim(), a: item.a.trim() });
  }
  const icon = ICON_ALLOWLIST.has(sec.icon) ? sec.icon : FALLBACK_ICON;
  return { id: sec.id.trim(), icon, title: sec.title.trim(), items };
}

function extractJson(text: string): any {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;
  return JSON.parse(candidate);
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req, CORS_HEADERS_SHORT);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
  const respond = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), { status, headers: jsonHeaders });

  const expectedSecret = Deno.env.get("DOCS_SYNC_SECRET");
  const providedSecret = req.headers.get("x-docs-sync-secret");
  if (!expectedSecret || !providedSecret || providedSecret !== expectedSecret) {
    return respond({ ok: false, error: "Unauthorized" }, 401);
  }

  let body: { commitSha?: string; commitMessage?: string; diff?: string };
  try {
    body = await req.json();
  } catch {
    return respond({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const commitSha = isNonEmptyString(body.commitSha) ? body.commitSha : "unknown";
  const commitMessage = isNonEmptyString(body.commitMessage) ? body.commitMessage : "";
  const diff = isNonEmptyString(body.diff) ? body.diff : "";

  if (!diff) {
    return respond({ ok: true, changed: false, reason: "empty diff" });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  const { data: docRow, error: docError } = await admin
    .from("app_documentation")
    .select("sections")
    .eq("id", "main")
    .maybeSingle();

  if (docError || !docRow) {
    console.error("[DOCS-SYNC] Failed to load app_documentation:", docError);
    return respond({ ok: true, changed: false, reason: "could not load current documentation" });
  }

  const currentSections: DocSection[] = Array.isArray(docRow.sections) ? docRow.sections : [];

  const systemPrompt = `Você mantém a documentação funcional (FAQ) de um sistema de TBL (Team-Based Learning) para professores e alunos.

Você recebe: (1) a lista atual de seções da documentação em JSON, (2) um diff de código de um novo deploy (commit "${commitSha}": "${commitMessage}").

Sua tarefa: decidir se esse diff representa uma mudança de funcionalidade ou uso visível para o usuário final que torna alguma seção da documentação desatualizada, e se sim, atualizar APENAS as seções realmente afetadas.

Regras estritas:
- NÃO reescreva seções que o diff não afeta. Se nada relevante mudou, responda {"changed": false, "changedSectionIds": [], "sections": [], "changelogEntry": null}.
- Mudanças internas (refactor, testes, estilo, correção de bug interno sem efeito percebido pelo usuário) NÃO justificam atualização de documentação nem changelog.
- Ao atualizar uma seção existente, preserve o máximo possível do conteúdo original, ajustando só o que de fato mudou.
- Você pode adicionar uma seção nova (id novo) se o diff introduzir uma funcionalidade inteiramente nova, mas NUNCA remova uma seção existente.
- "icon" deve ser um destes nomes exatos: ${Array.from(ICON_ALLOWLIST).join(", ")}.
- "changelogEntry" só deve ser preenchido se a mudança for algo que valha anunciar para o usuário final (nova funcionalidade ou melhoria perceptível); caso contrário, null. "category" deve ser "feature", "improvement" ou "fix".

Responda APENAS em JSON no formato:
{
  "changed": boolean,
  "changedSectionIds": ["id-da-secao-alterada", ...],
  "sections": [ { "id": "...", "icon": "...", "title": "...", "items": [ { "q": "...", "a": "..." } ] }, ... apenas as seções de changedSectionIds, novas ou existentes ... ],
  "changelogEntry": { "title": "...", "description": "...", "category": "feature" } | null
}`;

  const userPrompt = `SEÇÕES ATUAIS:\n${JSON.stringify(currentSections)}\n\nDIFF DO COMMIT:\n${diff.slice(0, 15000)}`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  let aiContent: string | null = null;
  try {
    const apiKeys = await getConfiguredApiKeys(admin);
    for (const providerName of DEFAULT_PROVIDER_ORDER) {
      const keyRow = apiKeys.find((k) => k.provider === providerName);
      if (!keyRow) continue;
      const result = await tryExternalProvider(providerName, keyRow.api_key, messages, { jsonMode: true });
      if (result) {
        aiContent = result.content;
        console.log(`[DOCS-SYNC] Used provider: ${providerName}`);
        break;
      }
    }
    if (!aiContent) {
      const result = await tryLovableAI(messages, { jsonMode: true });
      aiContent = result.content;
      console.log("[DOCS-SYNC] Used Lovable AI fallback");
    }
  } catch (e) {
    console.error("[DOCS-SYNC] AI call failed:", e);
    return respond({ ok: true, changed: false, reason: "AI call failed" });
  }

  let parsed: any;
  try {
    parsed = extractJson(aiContent || "{}");
  } catch (e) {
    console.error("[DOCS-SYNC] Failed to parse AI response:", e, aiContent?.slice(0, 500));
    return respond({ ok: true, changed: false, reason: "invalid AI response" });
  }

  if (!parsed?.changed || !Array.isArray(parsed.changedSectionIds) || parsed.changedSectionIds.length === 0) {
    return respond({ ok: true, changed: false, reason: "AI reported no relevant change" });
  }

  const changedIds = new Set<string>(parsed.changedSectionIds.filter(isNonEmptyString));
  const candidateSections: any[] = Array.isArray(parsed.sections) ? parsed.sections : [];
  const validatedById = new Map<string, DocSection>();
  for (const candidate of candidateSections) {
    if (!candidate || !changedIds.has(candidate.id)) continue;
    const validated = validateSection(candidate);
    if (validated) validatedById.set(validated.id, validated);
  }

  if (validatedById.size === 0) {
    return respond({ ok: true, changed: false, reason: "no valid section changes after validation" });
  }

  // Merge: existing sections keep their stored content unless the AI both
  // flagged them changed and produced a structurally valid replacement.
  const merged: DocSection[] = currentSections.map((existing) =>
    validatedById.has(existing.id) ? validatedById.get(existing.id)! : existing
  );
  const existingIds = new Set(currentSections.map((s) => s.id));
  for (const [id, section] of validatedById) {
    if (!existingIds.has(id)) merged.push(section);
  }

  const appliedIds = [...validatedById.keys()];

  const { error: updateError } = await admin
    .from("app_documentation")
    .update({
      sections: merged,
      previous_sections: currentSections,
      version: commitSha,
      updated_at: new Date().toISOString(),
      updated_by: "ci",
    })
    .eq("id", "main");

  if (updateError) {
    console.error("[DOCS-SYNC] Failed to update app_documentation:", updateError);
    return respond({ ok: true, changed: false, reason: "database update failed" });
  }

  let changelogInserted = false;
  const entry = parsed.changelogEntry;
  if (entry && isNonEmptyString(entry.title) && isNonEmptyString(entry.description)) {
    const category = ["feature", "improvement", "fix"].includes(entry.category) ? entry.category : "improvement";
    const { error: changelogError } = await admin.from("system_updates").insert({
      title: entry.title.trim(),
      description: entry.description.trim(),
      category,
      status: "done",
      tags: ["auto"],
      implemented_at: new Date().toISOString(),
      version: commitSha,
      notes: commitMessage || null,
    });
    if (changelogError) {
      console.error("[DOCS-SYNC] Failed to insert changelog entry:", changelogError);
    } else {
      changelogInserted = true;
    }
  }

  console.log(`[DOCS-SYNC] Updated sections: ${appliedIds.join(", ")} | changelog: ${changelogInserted}`);
  return respond({ ok: true, changed: true, sectionsUpdated: appliedIds, changelogInserted });
});
