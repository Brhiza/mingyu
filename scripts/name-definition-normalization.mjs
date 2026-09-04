const decoder = new TextDecoder('gb18030', { fatal: true });
const mergedPinyin = new Map();
// 旧注音使用连续声调字节，和后续 ASCII 字母被按双字节汉字解码。
// 仅还原完整括号内的注音，不对字义正文或古籍原文执行编码转换。
for (const [index, vowel] of [...'āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ'].entries()) {
  for (let trailing = 0x61; trailing <= 0x7a; trailing++) {
    mergedPinyin.set(
      decoder.decode(Uint8Array.of(0x81 + index, trailing)),
      vowel + String.fromCharCode(trailing),
    );
  }
}

function truncateAtUnclosedAnnotation(value) {
  let cutAt = value.length;
  for (const [open, close] of [
    ['（', '）'],
    ['(', ')'],
    ['〔', '〕'],
    ['“', '”'],
  ]) {
    const openings = [];
    for (const [index, char] of [...value].entries()) {
      if (char === open) openings.push(index);
      if (char === close) {
        if (openings.length) openings.pop();
        else cutAt = Math.min(cutAt, index);
      }
    }
    if (openings.length) cutAt = Math.min(cutAt, openings[0]);
  }
  return value.slice(0, cutAt);
}

export function normalizeCharacterDefinition(character, definition) {
  if (!definition?.trim()) return null;
  let result = definition.trim().replace(/（([^（）]*)）|\(([^()]*)\)/gu, (whole, full, half) => {
    const annotation = (full ?? half).trim();
    if (!/[a-z]/iu.test(annotation)) return whole;
    const restored = [...annotation].map((char) => mergedPinyin.get(char) ?? char).join('');
    if (restored === annotation) return whole;
    if (!/^[a-z]*[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ][a-z]*$/u.test(restored)) return whole;
    return full === undefined ? `(${restored})` : `（${restored}）`;
  });
  // 万俟的读音和词义：教育部《重编国语辞典修订本》万俟条。
  // https://dict.revised.moe.edu.tw/dictView.jsp?ID=27570&la=0&powerMode=0
  if (character === '万') {
    result = result.replace('；（萬）；〔万俟（；（萬）q?）〕', '；〔万俟（mò qí）〕');
  }
  if (character === '俟') {
    result = result.replace('〔万（m?）俟〕见“万2”', '〔万俟（mò qí）〕复姓');
  }
  result = result.replace(
    /^(?:（[\p{Script=Han}]{1,4}）；)?(?:[a-z]+<[^；]*|[a-z]+[\p{Script=Han}][a-z]*)；/u,
    '',
  );
  // 旧数据的少量多音字把其他义项插入了注音括号。此时括号后的内容顺序也已
  // 不可信，只保留该义项之前完整的分号段，详细字源仍可从康熙原文查看。
  const corruptedAnnotationAt = ['（；', '(；', '（“；', '(“；', '“；']
    .map((marker) => result.indexOf(marker))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];
  if (corruptedAnnotationAt !== undefined) {
    const completeSegmentEnd = result.lastIndexOf('；', corruptedAnnotationAt);
    result = result.slice(0, Math.max(0, completeSegmentEnd));
  }
  const damagedFullwidthPinyin = /[ａ-ｚＡ-Ｚ][\p{Script=Han}]{2,}[^；]{0,80}[ａ-ｚＡ-Ｚ]/u.exec(
    result,
  );
  if (damagedFullwidthPinyin) {
    const completeSentenceEnd = result.lastIndexOf('。', damagedFullwidthPinyin.index) + 1;
    result = result.slice(0, completeSentenceEnd);
  }
  const hadDamagedQuestionMark = result.includes('?');
  // 个别旧数据在无法解码的注音字节处已经退化为问号。删除损坏的括号注音，
  // 保留括号外的完整义项，避免把不可恢复的乱码继续交给查字与起名功能。
  result = result
    .replace(/（[^（）]{0,24}\?[^（）]{0,24}）|\([^()]{0,24}\?[^()]{0,24}\)/gu, '')
    .replace(/(?:^|；)[^；]*\?[^；]*(?=；|$)/gu, '')
    .replace(/(?:^|；)（[①-⑳]*[\p{Script=Han}]）(?=；|$)/gu, '')
    .replace(/；[A-Za-z][A-Za-z .,'’/-]*(?=；|$)/gu, '')
    .replace(/(?:^|；)\s*[A-Za-zɑ][A-Za-zɑ '’/-]{4,}[^；]*(?=；|$)/gu, '')
    .replace(/^；*(?:[a-z]+<[^；]*|[a-z]+[\p{Script=Han}][a-z]*)；/u, '');
  if (
    hadDamagedQuestionMark ||
    !['（）', '()', '〔〕', '“”'].every(([open, close]) => {
      let depth = 0;
      for (const char of result) {
        if (char === open) depth += 1;
        if (char === close) depth -= 1;
        if (depth < 0) return false;
      }
      return depth === 0;
    })
  ) {
    for (let previous = ''; previous !== result;) {
      previous = result;
      result = truncateAtUnclosedAnnotation(result);
    }
  }

  // 上游字段末尾还会附带未标名的近义词、反义词或英译，例如“；亮灭暗”与
  // “；brightclear…”。这些不是字义正文；多音字记录之间也可能重复插入同一词组。
  const metadataSegments = [...result.matchAll(/(?:^|；)([\p{Script=Han}]{1,8})(?=；|$)/gu)].map(
    (match) => match[1],
  );
  const repeatedMetadata = new Set(
    metadataSegments.filter((segment, index, items) => items.indexOf(segment) !== index),
  );
  for (const segment of repeatedMetadata) {
    result = result.replace(new RegExp(`；${segment}(?=；|$)`, 'gu'), '');
  }
  while (/；[\p{Script=Han}]{1,8}\s*$/u.test(result)) {
    result = result.replace(/；[\p{Script=Han}]{1,8}\s*$/u, '');
  }
  result = result
    .replace(/^；+/u, '')
    .replace(/；{2,}/gu, '；')
    .replace(/；+$/u, '')
    .trim();
  return result || null;
}
