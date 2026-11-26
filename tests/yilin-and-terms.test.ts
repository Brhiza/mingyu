import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate } from '../src/core';
import {
  YILIN_HEXAGRAM_ORDER,
  getYilinEntry,
  normalizeYilinHexagramName,
  queryYilinEntry,
  selectLiuyaoClassics,
  selectMeihuaClassics,
} from '../src/systems/classics';
import {
  METAPHYSICS_TERMS,
  TERM_CATEGORIES,
  listTermsByCategory,
  lookupMetaphysicsTerm,
  searchMetaphysicsTerms,
} from '../src/systems/terms';

test('《焦氏易林》覆盖 4,096 卦变林辞并支持简繁异体与全名查询', () => {
  assert.equal(YILIN_HEXAGRAM_ORDER.length, 64);

  let nonEmptyCount = 0;
  for (const base of YILIN_HEXAGRAM_ORDER) {
    for (const target of YILIN_HEXAGRAM_ORDER) {
      const entry = getYilinEntry(base, target);
      assert.ok(entry && entry.text.length > 0, `${base}→${target} 应有林辞`);
      nonEmptyCount += 1;
    }
  }
  assert.equal(nonEmptyCount, 4096);

  const qianKun = queryYilinEntry('乾', '坤');
  assert.equal(qianKun.key, '乾之坤');
  assert.equal(qianKun.text, '招殃來螫害我邦國病傷手足不得安息');

  const qianQian = queryYilinEntry('乾', '乾');
  assert.equal(qianQian.key, '乾之乾');
  assert.match(qianQian.text, /^道陟多阪/);

  assert.equal(normalizeYilinHexagramName('乾为天'), '乾');
  assert.equal(normalizeYilinHexagramName('归妹'), '歸妹');
  assert.equal(normalizeYilinHexagramName('讼卦'), '訟');
  assert.equal(queryYilinEntry('乾为天', '坤为地').key, '乾之坤');

  assert.throws(() => queryYilinEntry('无效卦', '坤'), /不是有效的六十四卦名/);
  assert.throws(() => queryYilinEntry('乾', ''), /不是有效的六十四卦名/);
});

test('梅花与六爻仅在开启 includeClassics 时附带《焦氏易林》片段，默认输出不变', async () => {
  const meihuaDirect = selectMeihuaClassics({
    trigrams: ['乾'],
    relation: '体用比和',
    originalHexagram: '乾为天',
    changedHexagram: '坤为地',
  });
  assert.ok(meihuaDirect.some((item) => item.book === '焦氏易林' && item.title === '乾之坤'));

  const liuyaoDirect = selectLiuyaoClassics({
    movingCount: 1,
    originalHexagram: '乾为天',
    changedHexagram: '天风姤',
  });
  assert.ok(liuyaoDirect.some((item) => item.book === '焦氏易林' && item.title === '乾之姤'));

  const currentTime = '2025-01-01T00:00:00Z';
  const meihuaDefault = await calculate('meihua', {
    question: '合作如何',
    currentTime,
    meihua: { method: 'number', number: 135 },
  });
  assert.ok(!meihuaDefault.prompt.text.includes('焦氏易林'));

  const meihuaWithClassics = await calculate('meihua', {
    question: '合作如何',
    currentTime,
    meihua: { method: 'number', number: 135 },
    prompt: { includeClassics: true },
  });
  assert.ok(meihuaWithClassics.prompt.text.includes('《焦氏易林》'));

  const liuyaoDefault = await calculate('liuyao', {
    question: '求财如何',
    currentTime,
    liuyao: { method: 'manual', yaos: [9, 7, 7, 7, 7, 7] },
  });
  assert.ok(!liuyaoDefault.prompt.text.includes('焦氏易林'));

  const liuyaoWithClassics = await calculate('liuyao', {
    question: '求财如何',
    currentTime,
    liuyao: { method: 'manual', yaos: [9, 7, 7, 7, 7, 7] },
    prompt: { includeClassics: true },
  });
  assert.ok(liuyaoWithClassics.prompt.text.includes('《焦氏易林》'));
});

test('术数术语百科词典共 257 条，支持精确、别名、分类与关键词检索', () => {
  assert.equal(METAPHYSICS_TERMS.length, 257);
  assert.ok(TERM_CATEGORIES.length === 10);

  assert.equal(lookupMetaphysicsTerm('甲')?.term, '甲木');
  assert.equal(lookupMetaphysicsTerm('子')?.term, '子水');
  assert.equal(lookupMetaphysicsTerm('cross')?.term, '十字架');
  assert.equal(lookupMetaphysicsTerm('【紫微星】')?.term, '紫微星');
  assert.equal(lookupMetaphysicsTerm('生年紫微星')?.term, '紫微星');

  const baziTerms = listTermsByCategory('八字');
  assert.ok(baziTerms.length > 0);
  assert.ok(baziTerms.every((item) => item.category === '八字'));

  const searched = searchMetaphysicsTerms('滴天髓', { category: '八字', limit: 5 });
  assert.ok(searched.length > 0 && searched.length <= 5);
  assert.ok(searched.every((item) => item.category === '八字'));
});
