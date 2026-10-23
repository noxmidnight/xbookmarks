export interface TranslateResult {
  translated: string;
  detectedLanguage: string | null;
  /** True when source is already English (or effectively English). */
  isEnglish: boolean;
}

const cache = new Map<string, TranslateResult>();

const ENGLISH_CODES = new Set(["en", "en-gb", "en-us", "english"]);

function normalizeLang(code: string | null | undefined): string | null {
  if (!code) return null;
  return code.trim().toLowerCase();
}

function isEnglishCode(code: string | null): boolean {
  if (!code) return false;
  const n = normalizeLang(code)!;
  return ENGLISH_CODES.has(n) || n.startsWith("en-");
}

/** Rough check — non-Latin scripts almost never need to stay untranslated. */
export function likelyNonEnglish(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  // CJK, Arabic, Cyrillic, Hebrew, Hangul, Thai, etc.
  if (/[\u0400-\u04FF\u0600-\u06FF\u0590-\u05FF\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF\u0E00-\u0E7F]/.test(t)) {
    return true;
  }
  // Mostly non-ASCII letters
  const letters = t.replace(/[0-9\s\p{P}\p{S}]/gu, "");
  if (!letters) return false;
  const nonAscii = [...letters].filter((c) => c.charCodeAt(0) > 127).length;
  return nonAscii / letters.length > 0.25;
}

async function translateChunk(text: string): Promise<{
  translated: string;
  detected: string | null;
}> {
  const url =
    "https://api.mymemory.translated.net/get?q=" +
    encodeURIComponent(text) +
    "&langpair=" +
    encodeURIComponent("autodetect|en");

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Translate failed (${res.status})`);
  const data = (await res.json()) as {
    responseStatus?: number;
    responseData?: { translatedText?: string; detectedLanguage?: string };
  };
  if (data.responseStatus && data.responseStatus !== 200) {
    throw new Error("Translate API error");
  }
  const translated = data.responseData?.translatedText?.trim() || text;
  const detected = normalizeLang(data.responseData?.detectedLanguage);
  return { translated, detected };
}

function splitChunks(text: string, maxLen = 450): string[] {
  if (text.length <= maxLen) return [text];
  const parts: string[] = [];
  let rest = text;
  while (rest.length > maxLen) {
    let cut = rest.lastIndexOf("\n", maxLen);
    if (cut < maxLen * 0.4) cut = rest.lastIndexOf(" ", maxLen);
    if (cut < maxLen * 0.4) cut = maxLen;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts.filter(Boolean);
}

/**
 * Translate tweet text to English when the source language is not English.
 * Results are cached in-memory for the session.
 */
export async function translateToEnglish(
  text: string,
): Promise<TranslateResult> {
  const trimmed = text.trim();
  if (!trimmed) {
    return { translated: "", detectedLanguage: null, isEnglish: true };
  }

  const cached = cache.get(trimmed);
  if (cached) return cached;

  // Fast path: clearly English ASCII and no foreign scripts
  if (!likelyNonEnglish(trimmed) && /^[\x00-\x7F]*$/.test(trimmed)) {
    // Still might be French/German — only skip API for short pure-ASCII without accented chars
    // Accented Latin is caught by likelyNonEnglish ratio; pure ASCII → treat as English
    const result: TranslateResult = {
      translated: trimmed,
      detectedLanguage: "en",
      isEnglish: true,
    };
    cache.set(trimmed, result);
    return result;
  }

  try {
    const chunks = splitChunks(trimmed);
    const out: string[] = [];
    let detected: string | null = null;
    for (const chunk of chunks) {
      const { translated, detected: d } = await translateChunk(chunk);
      if (!detected && d) detected = d;
      out.push(translated);
      // gentle pacing for free API
      if (chunks.length > 1) await new Promise((r) => setTimeout(r, 120));
    }
    const translated = out.join("\n").trim() || trimmed;
    const isEnglish =
      isEnglishCode(detected) ||
      translated.toLowerCase() === trimmed.toLowerCase();

    const result: TranslateResult = {
      translated: isEnglish ? trimmed : translated,
      detectedLanguage: detected,
      isEnglish,
    };
    cache.set(trimmed, result);
    return result;
  } catch {
    const result: TranslateResult = {
      translated: trimmed,
      detectedLanguage: null,
      isEnglish: !likelyNonEnglish(trimmed),
    };
    cache.set(trimmed, result);
    return result;
  }
}
