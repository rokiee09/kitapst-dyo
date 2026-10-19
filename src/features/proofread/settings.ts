import { invokeCommand, isTauriRuntime } from "@/services/tauri/invoke";

const KEY = "kitap-studiosu-proofread-ai";

export interface ProofreadAiSettings {
  endpoint: string;
  apiKey: string;
  model: string;
}

const EMPTY: ProofreadAiSettings = {
  endpoint: "",
  apiKey: "",
  model: "gpt-4o-mini",
};

export function loadProofreadAiSettings(): ProofreadAiSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<ProofreadAiSettings>;
    return {
      endpoint: typeof parsed.endpoint === "string" ? parsed.endpoint : "",
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
      model: typeof parsed.model === "string" && parsed.model.trim() ? parsed.model : EMPTY.model,
    };
  } catch {
    return { ...EMPTY };
  }
}

export function saveProofreadAiSettings(next: ProofreadAiSettings) {
  localStorage.setItem(KEY, JSON.stringify(next));
  if (isTauriRuntime()) {
    void invokeCommand("save_proofread_settings", {
      payload: {
        endpoint: next.endpoint,
        apiKey: next.apiKey,
        model: next.model || EMPTY.model,
      },
    }).catch(() => undefined);
  }
}

export async function persistProofreadAiSettings(next: ProofreadAiSettings): Promise<ProofreadAiSettings> {
  saveProofreadAiSettings(next);
  if (!isTauriRuntime()) return next;
  try {
    const remote = await invokeCommand<ProofreadAiSettings>("load_proofread_settings");
    const merged = {
      endpoint: next.endpoint.trim() || remote.endpoint || "",
      apiKey: next.apiKey.trim() || remote.apiKey || "",
      model: next.model.trim() || remote.model || EMPTY.model,
    };
    localStorage.setItem(KEY, JSON.stringify(merged));
    return merged;
  } catch {
    return next;
  }
}

export function hasProofreadAi(settings = loadProofreadAiSettings()): boolean {
  return Boolean(settings.endpoint.trim() && settings.apiKey.trim());
}
