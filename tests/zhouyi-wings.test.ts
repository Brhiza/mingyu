import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import { allWings, searchZhouyiWings } from '../src/systems/zhouyi';
import { selectLiuyaoClassics, selectMeihuaClassics } from '../src/systems/classics';

const currentTime = '2025-01-01T00:00:00Z';

test('十翼原文收录完整：文言、系辞上下、说卦、序卦、杂卦均可检索', async () => {
  assert.equal(allWings.filter((w) => w.wing === '文言传').length, 2);
  assert.equal(allWings.filter((w) => w.wing === '系辞上传').length, 12);
  assert.equal(allWings.filter((w) => w.wing === '系辞下传').length, 12);
  assert.equal(allWings.filter((w) => w.wing === '说卦传').length, 11);
  assert.equal(allWings.filter((w) => w.wing === '序卦传').length, 2);
  assert.equal(allWings.filter((w) => w.wing === '杂卦传').length, 1);

  const wenyan = searchZhouyiWings({ wing: '文言', chapter: '乾文言' });
  assert.equal(wenyan.total, 1);
  assert.match(wenyan.items[0].text, /元者，善之长也/);

  const xiciShang = searchZhouyiWings({ wing: '系辞上', text: '一阴一阳之谓道' });
  assert.equal(xiciShang.total, 1);
  assert.equal(xiciShang.items[0].chapter, '第五章');
  assert.ok(xiciShang.items[0].excerpt?.includes('一阴一阳之谓道'));

  const xiciXia = searchZhouyiWings({ wing: '系辞下', text: '天地之大德曰生' });
  assert.equal(xiciXia.total, 1);
  assert.equal(xiciXia.items[0].chapter, '第一章');

  const shuogua = searchZhouyiWings({ wing: '说卦', trigram: '震', text: '帝出乎震' });
  assert.equal(shuogua.total, 1);
  assert.equal(shuogua.items[0].chapter, '第五章');

  const xugua = searchZhouyiWings({ wing: '序卦', chapter: '上经' });
  assert.equal(xugua.total, 1);
  assert.match(xugua.items[0].text, /有天地，然后万物生焉/);

  const zagua = searchZhouyiWings({ wing: '杂卦', text: '乾刚坤柔' });
  assert.equal(zagua.total, 1);
  assert.match(zagua.items[0].text, /君子道长，小人道忧也/);

  const apiResult: any = await calculate('zhouyi', {
    query: { kind: 'wings', wing: '说卦传', trigram: '乾', text: '乾为天' },
    question: '乾卦有哪些万物类象？',
    currentTime,
  });
  assert.equal(apiResult.data.result.kind, 'wings');
  assert.equal(apiResult.data.result.total, 1);
  assert.match(apiResult.prompt.text, /乾为天，为圜，为君/);

  const follow = await reprompt({
    method: 'zhouyi',
    result: apiResult,
    question: '再看坤卦类象',
  });
  assert.match(follow.prompt.text, /再看坤卦类象/);
});

test('梅花与六爻在开启 includeClassics 时附带《说卦传》及《文言》《系辞》片段', async () => {
  const meihuaDirect = selectMeihuaClassics({
    trigrams: ['乾', '兑'],
    relation: '体克用',
    originalHexagram: '天泽履',
    changedHexagram: '乾为天',
  });
  assert.ok(meihuaDirect.some((item) => item.book === '周易·说卦传' && item.title === '乾卦类象' && item.quote.includes('乾为天')));
  assert.ok(meihuaDirect.some((item) => item.book === '周易·说卦传' && item.title === '兑卦类象' && item.quote.includes('兑为泽')));
  assert.ok(meihuaDirect.some((item) => item.book === '周易·文言传' && item.chapter === '乾文言'));
  assert.ok(meihuaDirect.some((item) => item.book === '周易·系辞上传'));

  const liuyaoDirect = selectLiuyaoClassics({
    movingCount: 1,
    originalHexagram: '乾为天',
    changedHexagram: '天风姤',
  });
  assert.ok(liuyaoDirect.some((item) => item.book === '周易·说卦传' && item.title === '乾卦类象'));
  assert.ok(liuyaoDirect.some((item) => item.book === '周易·文言传' && item.chapter === '乾文言'));
  assert.ok(liuyaoDirect.some((item) => item.book === '周易·系辞下传' && item.quote.includes('吉凶悔吝者，生乎动者也')));

  const meihuaPlain: any = await calculate('meihua', {
    question: '出行如何',
    currentTime,
    meihua: { method: 'number', number: 123 },
  });
  assert.ok(!meihuaPlain.prompt.text.includes('周易·说卦传'));

  const meihuaWithClassics: any = await calculate('meihua', {
    question: '出行如何',
    currentTime,
    meihua: { method: 'number', number: 123 },
    prompt: { includeClassics: true },
  });
  assert.ok(meihuaWithClassics.prompt.text.includes('周易·说卦传'));

  const liuyaoPlain: any = await calculate('liuyao', {
    question: '求财如何',
    currentTime,
    liuyao: { method: 'manual', yaos: [9, 7, 7, 7, 7, 7] },
  });
  assert.ok(!liuyaoPlain.prompt.text.includes('周易·说卦传'));

  const liuyaoWithClassics: any = await calculate('liuyao', {
    question: '求财如何',
    currentTime,
    liuyao: { method: 'manual', yaos: [9, 7, 7, 7, 7, 7] },
    prompt: { includeClassics: true },
  });
  assert.ok(liuyaoWithClassics.prompt.text.includes('周易·说卦传'));
  assert.ok(liuyaoWithClassics.prompt.text.includes('周易·文言传'));
  assert.ok(liuyaoWithClassics.prompt.text.includes('周易·系辞下传'));
});
