/**
 * ШАГ 10. Детерминированный фильтр нецензурной и явно оскорбительной лексики.
 *
 * Умеет распознавать обходы:
 *  — символы и знаки препинания:  «с.у.к.а», «муд@к», «бл*дь», «х*й»
 *  — цифры:                       «муд4к», «п3зд3ц», «г0вн0» (визуальные и звуковые)
 *  — пробелы:                     «с у ка», «м у д а к»
 *  — повторяющиеся буквы:         «сссууукааа», «пииииздееец»
 *  — смешение кириллицы и латиницы: «cyka» (лат.), «хуй» → «xyй»
 *  — намеренные искажения:        «мдак», «пздц» (согласный скелет)
 *
 * Контекстная защита: обычные слова не блокируются из-за совпадения
 * подстроки — матчинг идёт по словам (с нормализацией), плюс белый
 * список легитимных слов («команда», «мандат», «херсон», «бляха»,
 * «медик», «мороз», «поздно» и т.п.).
 *
 * Проверяется ВЕСЬ текст, включая цитируемые фрагменты в кавычках —
 * цитаты не исключаются из проверки.
 */

import {
  DIGIT_SOUND_MAP,
  EXACT_WORD_STEMS,
  LOOKALIKE_MAP,
  PREFIX_3_STEMS,
  PROFANITY_STEMS,
  SKELETON_EXACT_2,
  SKELETON_STEMS,
  WHITELIST_WORDS,
  skeleton,
} from "./lexicon";

export interface ProfanityHit {
  word: string;
  stem: string;
  mode: "word" | "joined" | "skeleton";
}

export interface ProfanityResult {
  blocked: boolean;
  hits: ProfanityHit[];
}

/** Нормализованные варианты слова: lookalike-карта + схлопывание повторов + звуковые замены цифр. */
function normalizeVariants(raw: string): string[] {
  const lower = raw.toLowerCase();
  let base = "";
  const digitPositions: { idx: number; digit: string }[] = [];
  let prev = "";
  let prevOriginal = "";
  for (const ch0 of lower) {
    const ch = LOOKALIKE_MAP[ch0] ?? ch0;
    if (!/[а-яё]/.test(ch)) continue; // всё, что не буква, — разделитель
    // повтор схлопываем, НО не после цифры: «п3з» → «пзз», иначе «3»+«з»
    // сольются и звуковую замену сделать не получится
    if (ch === prev && !/[0-9]/.test(prevOriginal) && !/[0-9]/.test(ch0)) continue;
    prev = ch;
    prevOriginal = ch0;
    if (/[0-9]/.test(ch0)) digitPositions.push({ idx: base.length, digit: ch0 }); // исходная цифра
    base += ch;
  }
  if (!base) return [];
  if (digitPositions.length === 0 || digitPositions.length > 3) return [base];
  // звуковые варианты цифр: «п3зд3ц» → «пездец», «муд4к» → «мудак»
  const results = new Set<string>([base]);
  let frontier = [base];
  for (const { idx, digit } of digitPositions) {
    const next: string[] = [];
    for (const w of frontier) {
      const sounds = DIGIT_SOUND_MAP[digit]; // ключ — ИСХОДНАЯ цифра
      if (!sounds) continue;
      for (const s of sounds) next.push(w.slice(0, idx) + s + w.slice(idx + 1));
    }
    next.forEach((w) => results.add(w));
    frontier = next;
  }
  return [...results];
}

function isWhitelisted(word: string): boolean {
  return WHITELIST_WORDS.some((w) => word.includes(w));
}

function matchStem(word: string, stem: string): boolean {
  if (EXACT_WORD_STEMS.includes(stem)) return word === stem;
  if (PREFIX_3_STEMS.includes(stem)) return word.startsWith(stem);
  // основы >= 4 символов ловим по началу слова, 3-символьные — только точное слово
  if (stem.length >= 4) return word.startsWith(stem);
  return word === stem;
}

function wordMatches(word: string, stem: string): boolean {
  const stemE = stem.replace(/ё/g, "е");
  const wordE = word.replace(/ё/g, "е");
  return matchStem(wordE, stemE) || matchStem(word, stem);
}

/** Скелетное совпадение: 3-символьные скелеты — только точное слово (защита «медик», «мороз»). */
function skeletonMatches(skel: string): string | null {
  if (skel.length >= 4) {
    for (const sstem of SKELETON_STEMS) {
      if (sstem.length < 4) continue; // короткие скелеты — только точное совпадение
      if (skel === sstem || skel.startsWith(sstem)) return sstem;
    }
    // 3-символьный скелет допустим только как точное совпадение
    if (skel.length === 4 && SKELETON_STEMS.includes(skel)) return skel;
    return null;
  }
  if (skel.length === 3 && SKELETON_STEMS.includes(skel)) return skel;
  if (skel.length === 2 && SKELETON_EXACT_2.includes(skel)) return skel;
  return null;
}

/**
 * Основная проверка. Возвращает список срабатываний.
 * Текст проверяется целиком, включая цитаты — кавычки не исключаем.
 */
export function checkProfanity(text: string): ProfanityResult {
  const hits: ProfanityHit[] = [];
  if (!text) return { blocked: false, hits };

  const push = (word: string, stem: string, mode: ProfanityHit["mode"]) => {
    if (!hits.some((h) => h.word === word && h.stem === stem)) {
      hits.push({ word, stem, mode });
    }
  };

  /** Проверить один «сырой» кусок (слово или склейка кусков). */
  const scanChunk = (raw: string, mode: ProfanityHit["mode"]): boolean => {
    const variants = normalizeVariants(raw);
    if (variants.length === 0) return false;
    if (variants.every((v) => isWhitelisted(v))) return false;
    for (const v of variants) {
      // словный матчинг
      for (const stem of PROFANITY_STEMS) {
        if (wordMatches(v, stem)) {
          push(raw, stem, mode);
          return true;
        }
      }
      // согласный скелет — намеренные искажения без гласных («мдак», «пздц», «хй»)
      const skel = skeleton(v.replace(/ё/g, "е"));
      const stem = skel ? skeletonMatches(skel) : null;
      if (stem) {
        push(raw, stem, "skeleton");
        return true;
      }
    }
    return false;
  };

  // Разбиваем на «сырые» куски по любым не-буквенно-цифровым символам.
  // Цифры оставляем внутри куска, чтобы «муд4к» не распался на «муд»+«к».
  const pieces = text.split(/[^0-9а-яёa-zäöü]+/i).filter(Boolean);

  // Оконный проход: все смежные окна из 1..6 кусков (ловит «муд@к», «с.у.к.а», «ты ч.м.о», «м у д а к»).
  for (let start = 0; start < pieces.length; start++) {
    let concat = "";
    for (let size = 1; size <= 6 && start + size <= pieces.length; size++) {
      concat += pieces[start + size - 1];
      if (concat.length > 14) break;
      if (size === 1) {
        // одиночное слово
        if (scanChunk(pieces[start], "word")) break;
      } else {
        // защита от ложных склеек: если крупный кусок легитимен — окно пропускаем
        const covered = pieces
          .slice(start, start + size)
          .map((p) => normalizeVariants(p)[0])
          .filter(Boolean);
        if (covered.some((c) => c.length >= 4 && isWhitelisted(c))) continue;
        if (scanChunk(concat, "joined")) break;
      }
    }
  }

  return { blocked: hits.length > 0, hits };
}
