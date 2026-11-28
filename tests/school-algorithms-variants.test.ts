import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { calculate } from '../src/core';
import { promptFormSchema } from '../src/web-prompt-schema';
import { formatCaseLifeEventsForPrompt, normalizeCaseLifeEvents } from '../src/v2-ui/cases-store';

test('八字多流派（盲派/新派/调候/古法格局/子平）均输出流派算法口径核验', async () => {
  const res = (await calculate('bazi', {
    question: '看看事业和做功',
    birth: { year: 1990, month: 5, day: 15, clock: { kind: 'exact', hour: 14, minute: 30, second: 0 }, timezone: 8 },
    gender: 'male',
    prompt: { schools: ['ziping', 'mangpai', 'xinpai', 'tiaohou', 'geju'] },
  })) as { prompt: { text: string } };

  const text = res.prompt.text;
  assert.match(text, /【流派算法口径核验】/);
  assert.match(text, /子平派口径/);
  assert.match(text, /盲派做功口径.*宾位\[年月\].*主位\[日时\].*体用归属/);
  assert.match(text, /新派口径.*紧贴作用链.*旬空落支/);
  assert.match(text, /《穷通》调候派口径/);
  assert.match(text, /《子平真诠》格局派口径/);
});

test('紫微多流派（含新增中州派与钦天四化来因宫）均输出流派算法口径核验', async () => {
  const res = (await calculate('ziwei', {
    question: '看看命局格局与四化',
    birth: { year: 1990, month: 5, day: 15, clock: { kind: 'exact', hour: 14, minute: 30, second: 0 }, timezone: 8 },
    gender: 'male',
    prompt: { schools: ['sanhe', 'feixing', 'sihua', 'zhongzhou'] },
  })) as { prompt: { text: string } };

  const text = res.prompt.text;
  assert.match(text, /【流派算法口径核验】/);
  assert.match(text, /三合派口径.*三方四正主星/);
  assert.match(text, /飞星派口径/);
  assert.match(text, /钦天四化派口径.*来因宫/);
  assert.match(text, /中州派口径/);
});

test('八宅、玄空飞星与西洋星盘（含希腊古典）输出流派算法口径核验', async () => {
  const bazhaiRes = (await calculate('bazhai', {
    question: '看看宅命相配',
    person: { kind: 'gua', mingGua: '坎' },
    house: { kind: 'mountain', sitMountain: '壬' },
    prompt: { schools: ['bazhaimingjing', 'yangzhaisanyao'] },
  })) as { prompt: { text: string } };
  assert.match(bazhaiRes.prompt.text, /《八宅明镜》口径/);
  assert.match(bazhaiRes.prompt.text, /《阳宅三要》口径/);

  const xuankongRes = (await calculate('xuankong', {
    question: '看看九运飞星',
    construction: { year: 2024 },
    orientation: { kind: 'mountain', sitMountain: '子' },
    prompt: { schools: ['shenshi', 'wuchang'] },
  })) as { prompt: { text: string } };
  assert.match(xuankongRes.prompt.text, /沈氏玄空派口径/);
  assert.match(xuankongRes.prompt.text, /无常派玄空口径/);

  const astroRes = (await calculate('astrolabe', {
    question: '看看本命星盘',
    birth: { year: 1990, month: 5, day: 15, hour: 14, minute: 30, second: 0, timezone: 8, latitude: 39.9, longitude: 116.4 },
    prompt: { schools: ['modern', 'traditional', 'hellenistic'] },
  })) as { prompt: { text: string } };
  assert.match(astroRes.prompt.text, /现代心理占星口径/);
  assert.match(astroRes.prompt.text, /传统古典占星口径/);
  assert.match(astroRes.prompt.text, /希腊古典占星口径.*昼夜阵营/);
});

test('单科精简包 mingyu-bazi.mjs 仅暴露八字相关方法并拒绝未包含的术数', () => {
  const bundlePath = join(process.cwd(), 'dist-cli', 'mingyu-bazi.mjs');
  if (!existsSync(bundlePath)) return;
  const methodsOut = execFileSync(process.execPath, [bundlePath, 'methods'], { encoding: 'utf8' });
  const parsed = JSON.parse(methodsOut) as { methods: Array<{ id: string }> };
  assert.deepEqual(
    parsed.methods.map((m) => m.id).sort(),
    ['bazi', 'bazi-reverse', 'bazi-synastry'],
  );

  assert.throws(
    () =>
      execFileSync(
        process.execPath,
        [bundlePath, 'calculate', 'ziwei', '--input', '{"question":"test","birth":{"year":1990,"month":5,"day":15,"clock":{"kind":"exact","hour":12,"minute":0,"second":0},"timezone":8},"gender":"male"}'],
        { encoding: 'utf8', stdio: 'pipe' },
      ),
  );
});

test('占卜、择日、七政与五运六气多流派（含新增流派）输出流派算法口径核验', async () => {
  const tarotRes = (await calculate('tarot', {
    question: '看看这件事发展',
    tarot: { spread: 'three', manualCards: [{ id: 1, reversed: false }, { id: 2, reversed: true }, { id: 3, reversed: false }] },
    prompt: { schools: ['rws', 'yuansu', 'narrative', 'marseille'] },
  })) as { prompt: { text: string } };
  assert.match(tarotRes.prompt.text, /【流派算法口径核验】/);
  assert.match(tarotRes.prompt.text, /马赛（Marseille）传统口径/);

  const xlrRes = (await calculate('xiaoliuren', {
    question: '今日出行如何',
    divinationTime: '2026-11-19T12:00:00+08:00',
    prompt: { schools: ['shunshu', 'gongjue', 'daoliu'] },
  })) as { prompt: { text: string } };
  assert.match(xlrRes.prompt.text, /顺数三宫传口径/);
  assert.match(xlrRes.prompt.text, /道家小六壬口径/);

  const taiyiRes = (await calculate('taiyi', {
    question: '年度趋势',
    taiyi: { scope: 'year', year: 2026 },
    prompt: { schools: ['zhuke', 'gongwei', 'jisuan'] },
  })) as { prompt: { text: string } };
  assert.match(taiyiRes.prompt.text, /主客定算派口径/);
  assert.match(taiyiRes.prompt.text, /积算十六神口径/);

  const jkjRes = (await calculate('jinkoujue', {
    question: '合作成否',
    divinationTime: '2026-11-19T12:00:00+08:00',
    jinkoujue: { method: 'branch', branch: '子' },
    prompt: { schools: ['siwei', 'fayong', 'wudong'] },
  })) as { prompt: { text: string } };
  assert.match(jkjRes.prompt.text, /四位生克派口径/);
  assert.match(jkjRes.prompt.text, /五动三动派口径/);

  const wuyunRes = (await calculate('wuyun-liuqi', {
    question: '今年运气特征',
    wuyun: { year: 2026 },
    prompt: { schools: ['yunqi', 'sitian', 'kezhu'] },
  })) as { prompt: { text: string } };
  assert.match(wuyunRes.prompt.text, /岁运太过不及口径/);
  assert.match(wuyunRes.prompt.text, /司天在泉口径/);

  const almanacRes = (await calculate('almanac', {
    question: '哪天适合搬家',
    topic: 'move',
    startDate: '2026-11-20',
    endDate: '2026-11-22',
    prompt: { schools: ['xiejibianfang', 'tongshu'] },
  })) as { prompt: { text: string } };
  assert.match(almanacRes.prompt.text, /《协纪辨方书》正统口径/);
  assert.match(almanacRes.prompt.text, /民间通书民俗口径/);
});

test('流派中文大白话标签与案例人生大事记格式化', () => {
  const schemaOut = promptFormSchema('bazi', { type: 'object', properties: { schools: { type: 'array' } } }, {}) as {
    properties: { schools: { optionLabels?: Record<string, string> } };
  };
  assert.match(schemaOut.properties.schools.optionLabels?.mangpai ?? '', /盲派/);

  const events = normalizeCaseLifeEvents([
    { year: 2019, summary: '换城市工作' },
    { year: 1800, summary: '无效年份' },
    { year: 2022, summary: '结婚' },
  ]);
  assert.equal(events.length, 2);
  assert.equal(formatCaseLifeEventsForPrompt(events), '【已验证人生大事】\n2019年：换城市工作；2022年：结婚');
});
