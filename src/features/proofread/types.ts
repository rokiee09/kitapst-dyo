export type ProofIssueKind = "spelling" | "grammar" | "meaning" | "simple";

export interface ProofIssue {
  kind: ProofIssueKind;
  excerpt: string;
  message: string;
  source: "local" | "ai";
  chapterId?: string;
  pageTitle?: string;
  blockId?: string;
  suggestion?: string;
}
