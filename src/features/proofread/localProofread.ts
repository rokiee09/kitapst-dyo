import type { ProofIssue } from "@/features/proofread/types";

const COMMON_MISSPELLINGS: Record<string, string> = {
  herkez: "herkes",
  yanlız: "yalnız",
  yapcak: "yapacak",
  gelicek: "gelecek",
  gidicek: "gidecek",
  biliyom: "biliyorum",
  yapıyom: "yapıyorum",
  değilde: "değil de",
  sora: "sonra",
  tamma: "tamam",
  tşk: "teşekkürler",
  merhabaa: "merhaba",
  selamlarrrr: "selamlar",
  cunku: "çünkü",
  cünki: "çünkü",
  cünkü: "çünkü",
  iliskili: "ilişkili",
  dusunmek: "düşünmek",
  ogrenci: "öğrenci",
};

const STOPWORDS = new Set([
  "ve", "ile", "bir", "bu", "şu", "o", "da", "de", "ki", "mi", "mı", "mu", "mü",
  "için", "gibi", "daha", "çok", "ama", "fakat", "çünkü", "veya", "ya", "en",
  "ne", "var", "yok", "olan", "olarak", "sonra", "önce", "kadar", "ben", "sen",
  "biz", "siz", "onlar", "her", "hiç", "zaten", "ise", "eğer",
]);

const VOWELS = /[aeıioöuüAEIİOÖUÜ]/g;

export type ProofreadRole = "heading" | "list" | "text";

export function localProofread(text: string, role: ProofreadRole = "text"): ProofIssue[] {
  const issues: ProofIssue[] = [];
  const normalized = text.replace(/\r/g, "").trim();
  if (!normalized) return issues;

  const sentences = splitSentences(normalized);
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (trimmed.length < 2) continue;
    const lineRole = looksLikeListItem(trimmed) ? "list" : role;

    const words = tokenize(trimmed);
    for (const word of words) {
      const key = fold(word);
      const suggestion = COMMON_MISSPELLINGS[key];
      if (suggestion) {
        issues.push({
          kind: "spelling",
          excerpt: word,
          message: `Yazım: “${word}” yerine “${suggestion}” olabilir.`,
          source: "local",
        });
      }
      if (/(.)\1{2,}/u.test(word) && word.length > 3) {
        issues.push({
          kind: "spelling",
          excerpt: word,
          message: `Aynı harf art arda tekrarlanmış: “${word}”.`,
          source: "local",
        });
      }
    }

    for (let index = 0; index < words.length - 1; index += 1) {
      if (fold(words[index]) === fold(words[index + 1]) && fold(words[index]).length > 1) {
        issues.push({
          kind: "simple",
          excerpt: `${words[index]} ${words[index + 1]}`,
          message: `Üst üste aynı sözcük: “${words[index]} ${words[index + 1]}”.`,
          source: "local",
        });
      }
    }

    if (/\s{3,}/.test(trimmed)) {
      issues.push({
        kind: "simple",
        excerpt: trimmed.slice(0, 48),
        message: "Cümlede fazla boşluk var.",
        source: "local",
      });
    }

    if (
      lineRole === "text" &&
      trimmed.length > 28 &&
      !/[.!?…:]$/.test(trimmed) &&
      !trimmed.includes("\n") &&
      !looksLikeListItem(trimmed)
    ) {
      issues.push({
        kind: "simple",
        excerpt: clip(trimmed),
        message: "Uzun cümle noktalama ile bitmemiş olabilir.",
        source: "local",
      });
    }

    if (looksMeaningless(trimmed, words, lineRole)) {
      issues.push({
        kind: "meaning",
        excerpt: clip(trimmed),
        message: "Anlamsız veya bozuk duran bir cümle gibi görünüyor. Kontrol edin.",
        source: "local",
      });
    }
  }

  return dedupe(issues).slice(0, 40);
}

function looksLikeListItem(line: string): boolean {
  return /^(\s*)([•●○■▪▸►★✦✓❖–—→*·]|(\d{1,3}[.)])|([a-zA-Z][.)])|([ivxlcdmIVXLCDM]+[.)]))(\s+|$)/u.test(
    line,
  );
}

function looksMeaningless(sentence: string, words: string[], role: ProofreadRole): boolean {
  if (role === "heading" || role === "list" || looksLikeListItem(sentence)) return false;
  const letters = sentence.replace(/[^A-Za-zÇĞİÖŞÜçğıöşü]/g, "");
  if (letters.length >= 10) {
    const vowels = letters.match(VOWELS)?.length ?? 0;
    if (vowels / letters.length < 0.18) return true;
  }
  if (words.length >= 7) {
    const hasStop = words.some((word) => STOPWORDS.has(fold(word)));
    if (!hasStop) return true;
  }
  if (words.length >= 4 && words.every((word) => word.length <= 2)) return true;
  return false;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function tokenize(sentence: string): string[] {
  return sentence.match(/[A-Za-zÇĞİÖŞÜçğıöşü0-9'-]+/g) ?? [];
}

function fold(value: string): string {
  return value.toLocaleLowerCase("tr-TR");
}

function clip(value: string): string {
  const compact = value.replace(/\s+/g, " ");
  return compact.length > 72 ? `${compact.slice(0, 69)}…` : compact;
}

function dedupe(issues: ProofIssue[]): ProofIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.kind}:${issue.excerpt}:${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
