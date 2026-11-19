import annotationsData from '../data/characters/annotations.json';

export interface CharacterReadingAnnotation {
  readonly readings: readonly string[];
  readonly note?: string;
  readonly surname?: string;
}

export interface CharacterAnnotationResult {
  char: string;
  strokeNote?: string;
  variantKangxiText?: string;
  readingNote?: CharacterReadingAnnotation;
}

export const CHARACTER_STROKE_NOTES: Readonly<Record<string, string>> =
  annotationsData.strokeNotes;

export const CHARACTER_VARIANT_KANGXI_TEXTS: Readonly<Record<string, string>> =
  annotationsData.variantKangxiTexts;

export const CHARACTER_READING_NOTES: Readonly<Record<string, CharacterReadingAnnotation>> =
  annotationsData.readingNotes;

/**
 * 查询单个汉字的姓名学多音/姓氏注释、异体康熙原文与笔画差异说明。
 */
export function getCharacterAnnotations(char: string): CharacterAnnotationResult | undefined {
  const key = char.trim();
  if (!key) return undefined;

  const strokeNote = Object.hasOwn(CHARACTER_STROKE_NOTES, key)
    ? CHARACTER_STROKE_NOTES[key]
    : undefined;
  const variantKangxiText = Object.hasOwn(CHARACTER_VARIANT_KANGXI_TEXTS, key)
    ? CHARACTER_VARIANT_KANGXI_TEXTS[key]
    : undefined;
  const readingNote = Object.hasOwn(CHARACTER_READING_NOTES, key)
    ? CHARACTER_READING_NOTES[key]
    : undefined;

  if (!strokeNote && !variantKangxiText && !readingNote) {
    return undefined;
  }

  return {
    char: key,
    ...(strokeNote !== undefined ? { strokeNote } : {}),
    ...(variantKangxiText !== undefined ? { variantKangxiText } : {}),
    ...(readingNote !== undefined ? { readingNote } : {}),
  };
}

/**
 * 列出所有含特殊姓氏读音说明的汉字条目。
 */
export function listSurnameReadingCharacters(): Array<{
  char: string;
  surname: string;
  readings: readonly string[];
  note?: string;
}> {
  return Object.entries(CHARACTER_READING_NOTES)
    .filter((entry): entry is [string, CharacterReadingAnnotation & { surname: string }] =>
      Boolean(entry[1].surname),
    )
    .map(([char, info]) => ({
      char,
      surname: info.surname,
      readings: info.readings,
      ...(info.note !== undefined ? { note: info.note } : {}),
    }));
}
