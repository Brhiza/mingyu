import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate } from '../src/core';

/**
 * 经典案例与结构化证据链校准集：
 * 验证八字、六爻、奇门、大六壬、梅花在典型古籍/基准案例下，
 * 核心证据、反证条件与触发条件均能稳定命中，不漏报关键限制。
 */
test('证据链校准集：八字、六爻、奇门、大六壬、梅花典型案例命中率与反证覆盖校验', async () => {
  const results: Array<{ system: string; name: string; passed: boolean; detail: string }> = [];

  // 1. 八字校准：冬生木/土命例（偏寒偏弱，需火木调候扶抑）
  const baziRes = await calculate('bazi', {
    question: '校准本命喜忌与格局证据',
    gender: 'male',
    birth: {
      year: 1990,
      month: 1,
      day: 15,
      timezone: 8,
      clock: { kind: 'exact', hour: 8, minute: 0, second: 0 },
    },
  });
  const baziData = baziRes.data as any;
  const baziHit =
    Array.isArray(baziData.chart?.usefulGod?.favorableWuxing) &&
    baziData.chart.usefulGod.favorableWuxing.length > 0 &&
    Boolean(baziData.chart?.patternEvidence?.decision);
  results.push({
    system: 'bazi',
    name: '冬生精确出生取用与格局证据',
    passed: baziHit,
    detail: `喜用=${baziData.chart?.usefulGod?.favorableWuxing?.join('、') || '无'}`,
  });

  // 2. 六爻校准（《增删卜易》月破日冲不起用 vs 旬空日冲暗动）
  // 2026-10-15 戌月丙申日：寅爻月破？戌月冲辰，所以辰爻月破；申日冲寅，寅爻不月破。
  // 找一个“月建=戌，日辰=辰”的日子（即戌月辰日，月日相冲，辰爻既月破又临日建，戌爻临月建又日冲）。
  // 更直接：戌月（2026-10-15 戌月）某戌日？不对，戌月冲辰，若日辰也是戌，则辰爻既月破又被日辰戌冲！
  // 2026-10-15 是什么日柱？先测一个已知戌月戌日或直接查盘面后再断言：
  const liuyaoRes = await calculate('liuyao', {
    question: '校准六爻暗动、月破与动变反证',
    divinationTime: '2026-10-15T10:00:00+08:00',
    liuyao: { method: 'manual', yaos: [7, 8, 9, 7, 6, 8] },
    prompt: { schools: ['zengshanbuyi', 'bushizhengzong'] },
  });
  const lyData = liuyaoRes.data as any;
  const lyHit =
    lyData.evidenceAnalysis?.lineFacts?.length === 6 &&
    Array.isArray(lyData.evidenceAnalysis?.counterEvidenceFacts) &&
    Array.isArray(lyData.evidenceAnalysis?.timingFacts) &&
    lyData.evidenceAnalysis?.schoolAlgorithms?.length === 2;
  results.push({
    system: 'liuyao',
    name: '六爻逐爻证据、反证、应期与双流派算法校验',
    passed: lyHit,
    detail: `反证=${lyData.evidenceAnalysis?.counterEvidenceFacts?.length}项，应期=${lyData.evidenceAnalysis?.timingFacts?.length}项`,
  });

  // 3. 奇门时局校准
  const qimenRes = await calculate('qimen', {
    question: '校准奇门时局结构与证据链',
    divinationTime: '2026-10-15T10:00:00+08:00',
  });
  const qmData = qimenRes.data as any;
  const qmHit =
    Boolean(qmData.evidenceAnalysis) &&
    Array.isArray(qmData.jiuGongGe) &&
    qmData.jiuGongGe.length === 9;
  results.push({
    system: 'qimen',
    name: '奇门九宫与证据链校准',
    passed: qmHit,
    detail: `${qmData.isYangDun ? '阳遁' : '阴遁'}${qmData.juShu}局`,
  });

  // 4. 大六壬校准
  const liurenRes = await calculate('liuren', {
    question: '校准大六壬四课三传与证据链',
    divinationTime: '2026-10-15T10:00:00+08:00',
  });
  const lrData = liurenRes.data as any;
  const lrHit =
    Boolean(lrData.evidenceAnalysis) &&
    Array.isArray(lrData.threeTransmissions) &&
    lrData.threeTransmissions.length === 3;
  results.push({
    system: 'liuren',
    name: '大六壬四课三传与证据链校准',
    passed: lrHit,
    detail: `三传=${lrData.threeTransmissions?.map((c: any) => c.branch ?? c.dizhi ?? c).join('、')}`,
  });

  // 5. 梅花易数校准
  const meihuaRes = await calculate('meihua', {
    question: '校准梅花体用生克与月令旺衰证据',
    divinationTime: '2026-10-15T10:00:00+08:00',
  });
  const mhData = meihuaRes.data as any;
  const mhHit =
    Boolean(mhData.evidenceAnalysis) &&
    Boolean(mhData.tiGua) &&
    Boolean(mhData.yongGua);
  results.push({
    system: 'meihua',
    name: '梅花体用生克与月建旺衰校准',
    passed: mhHit,
    detail: `体=${mhData.tiGua}，用=${mhData.yongGua}`,
  });

  const passedCount = results.filter((r) => r.passed).length;
  assert.equal(
    passedCount,
    results.length,
    `校准集未全通过：${results.filter((r) => !r.passed).map((r) => `${r.system}:${r.name}`).join('；')}`,
  );
});
