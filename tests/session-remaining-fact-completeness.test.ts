import assert from 'node:assert/strict';
import test from 'node:test';

import { generateDivinationSession } from '../packages/core/src/divination/session';
import { analyzeLiuyaoEvidence } from '../packages/core/src/divination/liuyao-evidence';
import type { AstrolabeData, LiuyaoData, TaiyiResult } from '../packages/core/src/types/divination';

test('历史六爻简版任务书保留本课月日、动变空亡与飞伏关系', () => {
  const session = generateDivinationSession({
    method: 'liuyao',
    question: '按实际月建日辰看本次动变',
    divinationTime: '2025-01-28T04:00:00Z',
    currentTime: '2026-09-30T04:00:00Z',
    liuyao: { method: 'manual', yaos: [6, 7, 8, 9, 6, 7] },
  });
  const data = session.data as LiuyaoData;
  assert.equal(data.ganzhi.month, '丁丑');
  assert.equal(data.ganzhi.day, '丁酉');
  assert.equal(data.yaosDetail[0].changedYao?.isVoid, true);
  assert.match(session.aiPrompt, /【当前时间】[\s\S]*2026年9月30日/);
  assert.match(session.aiPrompt, /【起课时间】[\s\S]*2025年1月28日/);
  assert.match(
    session.aiPrompt,
    /月日五行：[^\n]*第1爻父母寅木克月建丑土[^\n]*日辰酉金克第1爻父母寅木/u,
  );
  assert.match(session.aiPrompt, /第4爻妻财酉金[^\n]*值日辰酉，刑日辰酉（自刑）/u);
  assert.match(session.aiPrompt, /第5爻子孙未土[^\n]*冲月建丑，刑月建丑（恃势之刑）[^\n]*月破/u);
  assert.match(session.aiPrompt, /第1爻父母寅木[^\n]*化兄弟巳火（化泄、化空）/);
  assert.match(session.aiPrompt, /官鬼伏第3爻亥水，伏于兄弟午火下（伏神克飞/);
  assert.doesNotMatch(session.aiPrompt, /月日触发：|月建、日辰/u);
  assert.equal((session.aiPrompt.match(/月日五行：/g) ?? []).length, 1);
  assert.equal((session.aiPrompt.match(/六爻全表：/g) ?? []).length, 1);
  assert.doesNotMatch(session.aiPrompt, /evidenceAnalysis|sourceUrl|schemaVersion/);
});

test('六爻会话按财富主题取妻财第4爻，不沿用通用世爻主轴', () => {
  const request = {
    method: 'liuyao' as const,
    question: '这笔交易能否推进？',
    divinationTime: '2025-01-28T04:00:00Z',
    currentTime: '2025-01-28T04:00:00Z',
    liuyao: { method: 'manual' as const, yaos: [6, 7, 8, 9, 6, 7] },
  };
  const general = generateDivinationSession(request);
  const caifu = generateDivinationSession({
    ...request,
    prompt: { liuyaoTemplate: 'caifu' },
  });
  assert.deepEqual(caifu.data.yaoArray, general.data.yaoArray);
  const evidence = analyzeLiuyaoEvidence(caifu.data as LiuyaoData, { topic: 'caifu' });
  const selected = evidence.candidates.find(
    (candidate) => candidate.key === evidence.selectionFact.selectedCandidateKey,
  );
  assert.equal(evidence.selectionFact.status, '已选定候选');
  assert.equal(selected?.relative, '妻财');
  assert.deepEqual(
    selected?.references.map((reference) => reference.position),
    [4],
  );
  assert.match(caifu.aiPrompt, /^用神：妻财；盘面第4爻妻财酉金；/m);
  assert.equal((caifu.aiPrompt.match(/^用神：妻财；/gm) ?? []).length, 1);
  assert.match(general.aiPrompt, /^用神主线：事项用神待按具体问题取用/m);
  assert.doesNotMatch(caifu.aiPrompt, /^用神主线：事项用神待按具体问题取用/m);
});

test('星盘简版任务书保留星体落宫、尊贵、昼夜和格局相位事实', () => {
  const session = generateDivinationSession({
    method: 'astrolabe',
    question: '依据星体、宫位和相位解读这张本命盘',
    currentTime: '2025-01-28T04:00:00Z',
    astrolabe: {
      name: '示例',
      gender: '女',
      year: '2000',
      month: '1',
      day: '7',
      hour: '12',
      minute: '0',
      latitude: '39.9',
      longitude: '116.4',
      timezone: '8',
      locationName: '北京',
    },
  });
  const data = session.data as AstrolabeData;
  const moon = data.planets.find((point) => point.name === 'Moon');
  const clusterMembers = ['Moon', 'Neptune', 'Sun'].map((name) =>
    data.planets.find((point) => point.name === name),
  );
  assert.ok(moon);
  assert.equal(moon.house, 10);
  assert.equal(moon.dignityLabel, '落陷');
  assert.equal(data.dayChart, true);
  assert.ok(clusterMembers.every((point) => point?.house === 10));
  assert.ok(data.summary.patterns.includes('同宫星群（月亮、海王星、太阳，第10宫）'));
  assert.match(session.aiPrompt, /昼夜盘：昼盘/);
  assert.ok(session.aiPrompt.includes(`月亮${moon.formatted}，第10宫，落陷`));
  for (const point of clusterMembers) {
    assert.ok(point);
    assert.ok(session.aiPrompt.includes(`  ${point.label}${point.formatted}，第10宫`));
  }
  assert.match(session.aiPrompt, /同宫星群（月亮、海王星、太阳）/);
  assert.match(session.aiPrompt, /太阳与月亮：合相[^\n]*出相[^\n]*同宫/);
  assert.equal((session.aiPrompt.match(/十大星体格局：/g) ?? []).length, 1);
  assert.doesNotMatch(session.aiPrompt, /evidenceAnalysis|sourceUrl|schemaVersion/);
});

test('太乙简版任务书同时列出太乙宫数与将位以核对同宫判断', () => {
  const session = generateDivinationSession({
    method: 'taiyi',
    question: '分析本年太乙主客关系',
    taiyi: { scope: 'year', year: 2025 },
    currentTime: '2025-01-28T04:00:00Z',
  });
  const data = session.data as TaiyiResult;
  assert.equal(data.taiyiPosition, '午');
  assert.equal(data.taiyiPalace, 2);
  assert.equal(data.guestAssistant, data.taiyiPalace);
  assert.match(session.aiPrompt, /太乙在午（第2宫）/);
  assert.equal((session.aiPrompt.match(/太乙在午/g) ?? []).length, 1);
  assert.match(session.aiPrompt, /客参将2宫/);
  assert.match(session.aiPrompt, /囚：客参将与太乙同宫/);
  assert.equal((session.aiPrompt.match(/三门：/g) ?? []).length, 1);
  assert.equal((session.aiPrompt.match(/五将：/g) ?? []).length, 1);
  assert.equal((session.aiPrompt.match(/阴阳和：/g) ?? []).length, 1);
  assert.doesNotMatch(session.aiPrompt, /sourceUrl|evidenceAnalysis|schemaVersion/);
});
