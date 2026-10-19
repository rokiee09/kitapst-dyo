import type { ProofIssue, ProofIssueKind } from "@/features/proofread/types";
import { hasProofreadAi, loadProofreadAiSettings, persistProofreadAiSettings } from "@/features/proofread/settings";
import { invokeCommand, isTauriRuntime } from "@/services/tauri/invoke";

export async function aiProofread(text: string): Promise<ProofIssue[]> {
  const settings = await persistProofreadAiSettings(loadProofreadAiSettings());
  if (!hasProofreadAi(settings) || !text.trim()) return [];
  const args = {
    endpoint: settings.endpoint.trim(),
    apiKey: settings.apiKey.trim(),
    model: settings.model.trim() || "gpt-4o-mini",
    text: text.slice(0, 8000),
    payload: {
      endpoint: settings.endpoint.trim(),
      apiKey: settings.apiKey.trim(),
      model: settings.model.trim() || "gpt-4o-mini",
      text: text.slice(0, 8000),
    },
  };
  if (!isTauriRuntime()) {
    throw new Error("Yapay zeka yalnızca masaüstü uygulamasında çalışır. npm run tauri dev ile açın.");
  }
  const content = await invokeCommand<string>("proofread_ai", args);
  return parseIssues(content);
}

function parseIssues(content: string): ProofIssue[] {
  const raw = extractJson(content);
  if (!raw) return [];
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { issues?: unknown }).issues)
      ? ((raw as { issues: unknown[] }).issues)
      : [];
  const items: ProofIssue[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const excerpt = typeof record.excerpt === "string" ? record.excerpt.trim() : "";
    const message = typeof record.message === "string" ? record.message.trim() : "";
    const suggestion = typeof record.suggestion === "string" ? record.suggestion.trim() : "";
    if (!excerpt && !message && !suggestion) continue;
    items.push({
      kind: asKind(record.kind),
      excerpt: (excerpt || suggestion).slice(0, 120),
      message: (message || suggestion).slice(0, 240),
      suggestion: suggestion.slice(0, 240) || undefined,
      source: "ai",
    });
  }
  return items.slice(0, 20);
}

function extractJson(content: string): unknown {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced?.[1] ?? trimmed.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)?.[1];
    if (!candidate) return null;
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      return null;
    }
  }
}

function asKind(value: unknown): ProofIssueKind {
  if (value === "spelling" || value === "grammar" || value === "meaning" || value === "simple") {
    return value;
  }
  return "simple";
}
