import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate } from '../src/core';

test('meihua / liuren / qimen 指定流派时生成结构化流派算法口径核验', async () => {
  const mh = await calculate('meihua', {
    question: '合作前景如何？',
    divinationTime: '2026-10-15T10:00:00+08:00',
    prompt: { schools: ['tiyong', 'xiangshu', 'yaoci'] },
  });
  assert.match(mh.prompt.text, /【流派算法口径核验】/);
  assert.match(mh.prompt.text, /体用生克派口径/);
  assert.match(mh.prompt.text, /象数互变派口径/);
  assert.match(mh.prompt.text, /爻辞动变派口径/);

  const lr = await calculate('liuren', {
    question: '此事走势如何？',
    divinationTime: '2026-10-15T10:00:00+08:00',
    prompt: { schools: ['keti', 'bifafu', 'leishen'] },
  });
  assert.match(lr.prompt.text, /【流派算法口径核验】/);
  assert.match(lr.prompt.text, /九宗门课体派口径/);
  assert.match(lr.prompt.text, /毕法赋百法派口径/);
  assert.match(lr.prompt.text, /类神神煞派口径/);

  const qm = await calculate('qimen', {
    question: '近期出行是否顺利？',
    divinationTime: '2026-10-15T10:00:00+08:00',
    prompt: { schools: ['gongwei', 'geju', 'zhuke'] },
  });
  assert.match(qm.prompt.text, /【流派算法口径核验】/);
  assert.match(qm.prompt.text, /宫位星门神仪派口径/);
  assert.match(qm.prompt.text, /吉凶格局派口径/);
  assert.match(qm.prompt.text, /主客动静派口径/);
});
