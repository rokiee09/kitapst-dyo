import { describe, expect, it } from "vitest";
import { localProofread } from "@/features/proofread/localProofread";

describe("localProofread", () => {
  it("finds a known misspelling", () => {
    const issues = localProofread("Herkes değil herkez geldi.");
    expect(issues.some((item) => item.kind === "spelling" && item.excerpt.toLocaleLowerCase("tr-TR").includes("herkez"))).toBe(true);
  });

  it("finds repeated words", () => {
    const issues = localProofread("Bu bu cümle bozuk.");
    expect(issues.some((item) => item.message.includes("Üst üste"))).toBe(true);
  });

  it("does not demand a period on headings", () => {
    const issues = localProofread("Giriş Bölümü", "heading");
    expect(issues.some((item) => item.message.includes("noktalama"))).toBe(false);
  });

  it("does not demand a period on list items", () => {
    const issues = localProofread("• İlk madde\n• İkinci madde", "list");
    expect(issues.some((item) => item.message.includes("noktalama"))).toBe(false);
  });
});
