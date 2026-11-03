// Deterministic normalisation of shop speech before intent parsing and during named-product lookup.
import type { ActionKind, Intent, IntentAction } from "./types";

const SW_NUMBERS: Readonly<Record<string, number>> = {
  moja: 1,
  mmoja: 1,
  kimoja: 1,
  limoja: 1,
  mbili: 2,
  wili: 2,
  viwili: 2,
  wawili: 2,
  mawili: 2,
  pili: 2,
  tatu: 3,
  vitatu: 3,
  watatu: 3,
  matatu: 3,
  nne: 4,
  vinne: 4,
  wanne: 4,
  manne: 4,
  tano: 5,
  vitano: 5,
  watano: 5,
  matano: 5,
  sita: 6,
  visita: 6,
  saba: 7,
  visaba: 7,
  nane: 8,
  vinane: 8,
  tisa: 9,
  vitisa: 9,
  kumi: 10,
  ishirini: 20,
  thelathini: 30,
};

const EN_NUMBERS: Readonly<Record<string, number>> = {
  one: 1,
  wani: 1,
  two: 2,
  three: 3,
  thri: 3,
  firi: 3,
  four: 4,
  five: 5,
  faiv: 5,
  faivu: 5,
  six: 6,
  siksi: 6,
  seven: 7,
  seveni: 7,
  eight: 8,
  eiti: 8,
  nine: 9,
  naini: 9,
  ten: 10,
  teni: 10,
  eleven: 11,
  twelve: 12,
  twenty: 20,
};

const PHONETIC_NUMBER_MAP: Readonly<Record<string, string>> = {
  wani: "one",
  thri: "three",
  firi: "three",
  faiv: "five",
  faivu: "five",
  siksi: "six",
  seveni: "seven",
  eiti: "eight",
  naini: "nine",
  teni: "ten",
};

const RESERVED_WORDS = new Set<string>([
  ...Object.keys(SW_NUMBERS),
  ...Object.keys(EN_NUMBERS),
  "nipe",
  "naomba",
  "nataka",
  "ongeza",
  "leta",
  "ondoa",
  "toa",
  "punguza",
  "weka",
  "ziwe",
  "iwe",
  "hii",
  "hiki",
  "hizi",
  "ile",
  "kile",
  "zile",
  "hiyo",
  "hizo",
  "hilo",
  "hapa",
  "hapana",
  "kisha",
  "halafu",
  "basi",
  "sawa",
  "asante",
  "mambo",
  "habari",
  "bei",
  "gani",
  "kwa",
  "na",
  "au",
  "tu",
  "give",
  "me",
  "want",
  "add",
  "remove",
  "take",
  "off",
  "make",
  "that",
  "change",
  "this",
  "these",
  "those",
  "here",
  "it",
  "of",
  "and",
  "no",
  "please",
  "how",
  "much",
]);

export function parseSpokenNumber(word: string): number | null {
  const clean = word.trim().toLowerCase();
  if (!clean) return null;
  if (/^\d+$/.test(clean)) {
    const parsed = Number.parseInt(clean, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  if (clean === "tu") return 2;
  return SW_NUMBERS[clean] ?? EN_NUMBERS[clean] ?? null;
}

function cleanToken(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Generates singular/plural stems in Kiswahili (ki/vi, ch/vy, m/mi) and English (-s, -es, -ies). */
export function wordForms(word: string): string[] {
  const w = cleanToken(word);
  const forms = new Set<string>([w]);
  if (w.startsWith("ki") && w.length > 4) forms.add(`vi${w.slice(2)}`);
  if (w.startsWith("vi") && w.length > 4) forms.add(`ki${w.slice(2)}`);
  if (w.startsWith("ch") && w.length > 4) forms.add(`vy${w.slice(2)}`);
  if (w.startsWith("vy") && w.length > 4) forms.add(`ch${w.slice(2)}`);
  if (w.startsWith("m") && !w.startsWith("mi") && !w.startsWith("ma") && w.length > 4) {
    forms.add(`mi${w.slice(1)}`);
  }
  if (w.startsWith("mi") && w.length > 4) forms.add(`m${w.slice(2)}`);
  if (w.endsWith("ies") && w.length > 4) forms.add(`${w.slice(0, -3)}y`);
  if (w.endsWith("y") && w.length > 3) forms.add(`${w.slice(0, -1)}ies`);
  if (w.endsWith("es") && w.length > 4) forms.add(w.slice(0, -2));
  if (w.endsWith("s") && !w.endsWith("ss") && w.length > 3) forms.add(w.slice(0, -1));
  if (!w.endsWith("s") && w.length > 2) {
    forms.add(`${w}s`);
    forms.add(`${w}es`);
  }
  return [...forms];
}

function editDistanceAtMostOne(a: string, b: string): boolean {
  if (a === b) return true;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;

  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < la && j < lb) {
    if (a[i] === b[j]) {
      i++;
      j++;
    } else {
      edits++;
      if (edits > 1) return false;
      if (la > lb) i++;
      else if (lb > la) j++;
      else {
        i++;
        j++;
      }
    }
  }
  if (i < la || j < lb) edits++;
  return edits <= 1;
}

/** Checks whether a spoken term matches a catalogue term by exact, singular/plural, or close phonetic spelling. */
export function termsMatch(spoken: string, catalogueTerm: string): boolean {
  const s = cleanToken(spoken);
  const c = cleanToken(catalogueTerm);
  if (!s || !c) return false;

  const sForms = wordForms(s);
  const cForms = wordForms(c);
  for (const sf of sForms) {
    if (cForms.includes(sf)) return true;
  }

  // Allow a single-character mishearing only on words of at least 5 characters that share the first letter.
  if (s.length >= 5 && c.length >= 5 && s[0] === c[0]) {
    for (const sf of sForms) {
      for (const cf of cForms) {
        if (editDistanceAtMostOne(sf, cf)) return true;
      }
    }
  }

  return false;
}

function resolveCatalogueToken(token: string, catalogueTerms: string[]): string | null {
  const lower = cleanToken(token);
  if (!lower || RESERVED_WORDS.has(lower)) return null;

  const exact = catalogueTerms.find((term) => cleanToken(term) === lower);
  if (exact) return exact;

  const matches = catalogueTerms.filter((term) => termsMatch(lower, term));
  const uniqueCanonical = new Set(matches.map((m) => cleanToken(m)));
  if (uniqueCanonical.size === 1) {
    return matches[0];
  }
  return null;
}

/**
 * Normalises a speech transcript deterministically before sending it to the intent parser:
 * - Fixes common speech-to-text mishearings ("Hiipe" -> "Nipe", "namba" -> "naomba", "hapana zile" -> "hapana ziwe").
 * - Collapses stuttered demonstratives ("hii hii" -> "hii", "hapana hapana" -> "hapana").
 * - Normalises phonetic number words ("wani" -> "one", "tu" before product/of -> "two", "thri" -> "three").
 * - Replaces unambiguous singular/plural or 1-edit product mishearings with the shop's catalogue term.
 */
export function normalizeTranscript(transcript: string, catalogueTerms: string[] = []): string {
  const trimmed = transcript.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";

  let text = trimmed
    .replace(/\b[Hh]iipe\b/g, (m) => (m[0] === "H" ? "Nipe" : "nipe"))
    .replace(/\b([Nn])a\s+omba\b/g, "$1aomba")
    .replace(/\b([Nn])a\s+taka\b/g, "$1ataka")
    .replace(/\b([Oo])n\s+geza\b/g, "$1ngeza")
    .replace(/\b([Oo])n\s+doa\b/g, "$1ndoa")
    .replace(/\b([Hh]apana)(?:[\s,]+\1)+\b/gi, "$1")
    .replace(/\b([Hh]apana[\s,]+)zile\b/gi, "$1ziwe")
    .replace(/\b(hii|hizi|ile|zile|hiki|kile)\s+\1\b/gi, "$1")
    .replace(
      /\b([Nn])amba(?=\s+(?:hii|hizi|ile|zile|moja|mbili|tatu|nne|tano|sita|saba|nane|tisa|kumi|one|two|three|wani|tu|\d+|[a-z]{3,}))/g,
      "$1aomba",
    );

  // Replace "tu" with "two" only when used as an English count (e.g. "give me tu", "tu of this", "and tu soap"),
  // never when used as Kiswahili "only" at the end of a phrase ("ziwe tatu tu").
  text = text
    .replace(/\b(give\s+me|add|want|and)\s+tu\b/gi, "$1 two")
    .replace(/\btu(?=\s+of\s+(?:this|these|that|those)\b)/gi, "two");

  // Token-level phonetic number and catalogue alias normalisation while preserving punctuation.
  const words = text.split(/(\s+)/);
  const wordIndices: number[] = [];
  for (let i = 0; i < words.length; i++) {
    if (!/^\s+$/.test(words[i]) && words[i].length > 0) {
      wordIndices.push(i);
    }
  }

  for (let pos = 0; pos < wordIndices.length; pos++) {
    const idx = wordIndices[pos];
    const rawWord = words[idx];
    const match = rawWord.match(/^([^a-zA-Z0-9]*)([a-zA-Z0-9]+)([^a-zA-Z0-9]*)$/);
    if (!match) continue;
    const [, prefix, core, suffix] = match;
    const lower = core.toLowerCase();

    if (PHONETIC_NUMBER_MAP[lower]) {
      words[idx] = `${prefix}${PHONETIC_NUMBER_MAP[lower]}${suffix}`;
      continue;
    }

    // Handle "na tu <product>" where the next word is a catalogue product or English noun
    if (lower === "tu" && pos + 1 < wordIndices.length) {
      const nextRaw = words[wordIndices[pos + 1]].replace(/[^a-zA-Z0-9]/g, "");
      if (nextRaw && resolveCatalogueToken(nextRaw, catalogueTerms)) {
        words[idx] = `${prefix}two${suffix}`;
        continue;
      }
    }

    if (catalogueTerms.length > 0) {
      const resolved = resolveCatalogueToken(core, catalogueTerms);
      if (resolved && cleanToken(resolved) !== lower) {
        words[idx] = `${prefix}${resolved}${suffix}`;
      }
    }
  }

  return words.join("");
}

/**
 * Formats a spoken transcript into clean, natural sentence case with punctuation
 * so the review card always shows well-structured text.
 */
export function formatTranscript(transcript: string): string {
  const cleaned = transcript
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;?!])/g, "$1");
  if (!cleaned) return "";

  const capitalized = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return /[.?!]$/.test(capitalized) ? capitalized : `${capitalized}.`;
}

/**
 * Deterministic fallback parser used when the intent model is unreachable,
 * ensuring the user's request still resolves cleanly without showing an error screen.
 */
export function fallbackParseIntent(
  normalizedTranscript: string,
  catalogueTerms: string[] = [],
  pointCount = 0,
): Intent {
  const formatted = formatTranscript(normalizedTranscript);
  if (!formatted) {
    return { transcript: "", actions: [], needsClarification: false };
  }

  // Split into clauses by conjunctions or sentence boundaries, handling corrections ("hapana, ...").
  const rawClauses = normalizedTranscript
    .split(/(?:[.;?!]+|\b(?:kisha|halafu|na(?=\s+(?:hii|hizi|ile|zile|hiki|kile|nipe|naomba|nataka|ongeza|ondoa|toa|give|add|remove|one|two|three|four|five|moja|mbili|tatu|nne|tano|\d+))|and(?=\s+(?:this|these|that|those|give|add|remove|one|two|three|four|five|\d+)))\b)/i)
    .map((c) => c.trim().replace(/^[,]+|[,]+$/g, "").trim())
    .filter(Boolean);

  const actions: IntentAction[] = [];

  for (const clause of rawClauses) {
    const lower = clause.toLowerCase();
    // Skip pure greetings or price questions.
    if (/\bbei\s+gani\b|\bhow\s+much\b/.test(lower) && !/\bnipe\b|\bnaomba\b|\bnataka\b|\bgive\b|\badd\b/.test(lower)) {
      continue;
    }

    // Handle inline correction ("hapana, ziwe saba" or "hapana tatu").
    const correctionParts = clause.split(/\b(?:hapana|no)\b[,:\s]*/i).map((p) => p.trim()).filter(Boolean);
    const effectiveClause = correctionParts.length > 1 ? correctionParts[correctionParts.length - 1] : clause;
    const tokens = effectiveClause
      .replace(/[^a-zA-Z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
    if (tokens.length === 0) continue;

    let action: ActionKind = "ADD";
    if (tokens.some((t) => ["ondoa", "toa", "punguza", "remove"].includes(t.toLowerCase()))) {
      action = "REMOVE";
    } else if (tokens.some((t) => ["ziwe", "iwe", "weka", "set", "change"].includes(t.toLowerCase()))) {
      action = correctionParts.length > 1 ? "ADD" : "SET";
    }

    let quantity: number | null = null;
    for (const token of tokens) {
      const n = parseSpokenNumber(token);
      if (n !== null) quantity = n;
    }
    if (quantity === null && tokens.some((t) => ["hii", "hiki", "ile", "kile", "this", "that"].includes(t.toLowerCase()))) {
      quantity = 1;
    }

    let namedProduct: string | null = null;
    for (const token of tokens) {
      const resolved = resolveCatalogueToken(token, catalogueTerms);
      if (resolved) {
        namedProduct = resolved;
        break;
      }
    }

    const hasPointWord = tokens.some((t) =>
      ["hii", "hiki", "hizi", "ile", "kile", "zile", "hapa", "this", "these", "that", "those", "here"].includes(
        t.toLowerCase(),
      ),
    );
    const hasSameWord = tokens.some((t) => ["hiyo", "hizo", "hilo", "it"].includes(t.toLowerCase()));

    if (!namedProduct && !hasPointWord && !hasSameWord && quantity === null) continue;

    const reference = namedProduct && !hasPointWord ? "NAMED" : hasSameWord && actions.length > 0 ? "SAME" : "POINT";
    actions.push({
      action,
      quantity,
      reference,
      namedProduct: reference === "NAMED" ? namedProduct : null,
      spoken: clause,
    });
  }

  if (actions.length === 0 && pointCount > 0) {
    for (let i = 0; i < pointCount; i++) {
      actions.push({
        action: "ADD",
        quantity: 1,
        reference: "POINT",
        namedProduct: null,
        spoken: formatted,
      });
    }
  }

  return {
    transcript: formatted,
    actions,
    needsClarification: actions.some((a) => a.quantity === null),
  };
}
