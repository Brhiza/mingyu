import assert from 'node:assert/strict';
import test from 'node:test';

import { formatDivinationResult, generateDivinationSession } from 'mingyu-core/divination/session';
import type { MeihuaData } from '../packages/core/src/types/divination';
import type { WuyunLiuqiResult } from '../packages/core/src/wuyun-liuqi';

test('梅花在线任务书保留动爻阴阳变化与互卦体用关系', () => {
  const session = generateDivinationSession({
    method: 'meihua',
    question: '这项申请的推进结果怎样？',
    divinationTime: '2024-06-15T10:30:00+08:00',
    currentTime: '2024-06-15T10:30:00+08:00',
    meihua: { method: 'time' },
  });
  const data = session.data as MeihuaData;
  const full = formatDivinationResult(session.method, session.data);
  const movingYao = data.yaosDetail.find((yao) => yao.position === data.movingYao.position);

  assert.equal(data.originalName, '雷泽归妹');
  assert.equal(data.interHexagram?.name, '水火既济');
  assert.equal(data.changedHexagram?.name, '震为雷');
  assert.equal(data.movingYao.position, 2);
  assert.equal(movingYao?.yaoType, '阳');
  assert.equal(movingYao?.isChanging, true);
  assert.equal(data.interTiGua?.name, '坎');
  assert.equal(data.interYongGua?.name, '离');
  assert.equal(data.analysis.inter2Relation, '原体生用互');

  assert.ok(full.includes('动爻变化：主卦第2爻阳变阴'));
  assert.ok(full.includes('互卦：水火既济；体互生原体；原体生用互'));
  assert.ok(full.includes('互卦水火既济：体卦坎水，用卦离火，关系体克用'));
  assert.ok(session.aiPrompt.includes('动爻变化：主卦第2爻阳变阴'));
  assert.ok(session.aiPrompt.includes('互卦：水火既济；体互生原体；原体生用互'));
  assert.ok(session.aiPrompt.includes('互卦水火既济：体卦坎水，用卦离火，关系体克用'));
  assert.match(session.aiPrompt, /【任务】[\s\S]*【问题】\n这项申请的推进结果怎样？/);
});

test('五运六气任务书保留五步日期、六步交节边界以定位当前阶段', () => {
  const currentTime = '2024-07-01T12:00:00+08:00';
  const currentTimestamp = Date.parse(currentTime);
  const currentDate = currentTime.slice(0, 10);
  const session = generateDivinationSession({
    method: 'wuyun',
    question: '请以本年度当前阶段为主，说明五步与六步运气的关系。',
    divinationTime: currentTime,
    currentTime,
    wuyun: { year: 2024 },
  });
  const data = session.data as WuyunLiuqiResult;
  const full = formatDivinationResult(session.method, session.data);
  const activeMovement = data.movementSteps.find(
    (step) =>
      step.gregorianStart !== undefined &&
      step.gregorianEnd !== undefined &&
      step.gregorianStart <= currentDate &&
      currentDate <= step.gregorianEnd,
  );
  const activeQi = data.qiSteps.find(
    (step) =>
      step.boundaryTime !== undefined &&
      currentTimestamp >= step.boundaryTime.startTimestamp &&
      currentTimestamp < step.boundaryTime.endTimestampExclusive,
  );

  assert.equal(data.movementSteps.length, 5);
  assert.equal(data.qiSteps.length, 6);
  assert.equal(activeMovement?.label, '三运');
  assert.equal(activeQi?.label, '三之气');
  assert.equal(activeQi?.solarTerms.join('、'), '小满、芒种、夏至、小暑');
  assert.equal(activeQi?.boundaryTime?.startBeijing, '2024-05-20 20:59:31');
  assert.equal(activeQi?.boundaryTime?.endBeijingExclusive, '2024-07-22 15:44:26');

  for (const step of data.movementSteps) {
    assert.ok(step.gregorianStart && step.gregorianEnd);
    const line = full.split('\n').find((item) => item.startsWith(`${step.order}. ${step.label}（`));
    assert.ok(line, `完整格式应列出${step.label}`);
    assert.ok(line.includes(`公历${step.gregorianStart}至${step.gregorianEnd}`));
    assert.ok(session.aiPrompt.includes(line));
  }

  for (const step of data.qiSteps) {
    assert.ok(step.boundaryTime);
    const line = full.split('\n').find((item) => item.startsWith(`${step.order}. ${step.label}（`));
    assert.ok(line, `完整格式应列出${step.label}`);
    assert.ok(line.includes(step.solarTerms.join('、')));
    assert.ok(line.includes(step.boundaryTime.startBeijing));
    assert.ok(line.includes(step.boundaryTime.endBeijingExclusive));
    assert.ok(session.aiPrompt.includes(line));
  }

  assert.match(session.aiPrompt, /【当前时间】[\s\S]*2024年7月1日 12时0分/);
  assert.match(session.aiPrompt, /【任务】[\s\S]*【问题】\n请以本年度当前阶段为主/);
});
