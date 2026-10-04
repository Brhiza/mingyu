import type { LiurenData } from '../types/divination';
import { analyzeLiurenEvidence } from '../divination/liuren-evidence';
import {
  formatLiurenLesson,
  formatLiurenRoleRelation,
  formatLiurenOrdinaryTransmissionAdjudication,
  formatLiurenTransmission,
} from './liuren-facts';

export function formatLiurenJudgmentFacts(
  data: LiurenData,
  options: { includeOrdinaryAdjudication?: boolean; chartFactsIncluded?: boolean } = {},
): string[] {
  const lines: string[] = [];
  const analysis = analyzeLiurenEvidence(data);
  const plateVerified = analysis.plateFact.status === '完整';
  if (!plateVerified) return lines;
  if (plateVerified && !options.chartFactsIncluded && data.transmissionDetail) {
    const sourceMarker = '；古籍依据依次为：';
    const sourceIndex = data.transmissionDetail.indexOf(sourceMarker);
    const transmissionBasis =
      sourceIndex >= 0 ? data.transmissionDetail.slice(0, sourceIndex) : data.transmissionDetail;
    if (transmissionBasis) lines.push(`取传说明：${transmissionBasis}`);
  }

  const classicalRules = (plateVerified ? (data.classicalRules ?? []) : [])
    .map((item) => `${item.category}：${item.summary}`)
    .filter(Boolean);
  if (
    classicalRules.length &&
    !(options.chartFactsIncluded && data.ordinaryTransmissionAdjudication?.status === 'selected')
  )
    lines.push(`取传条件：${classicalRules.join('；')}`);
  const ordinaryAdjudication = formatLiurenOrdinaryTransmissionAdjudication(data);
  if (
    !options.chartFactsIncluded &&
    options.includeOrdinaryAdjudication !== false &&
    ordinaryAdjudication
  )
    lines.push(ordinaryAdjudication);
  const guaTiFacts = (plateVerified ? (data.guaTiFacts ?? []) : [])
    .map((item) => `${item.name}（${item.matchedConditions.join('、')}）`)
    .filter(Boolean);
  if (!options.chartFactsIncluded && guaTiFacts.length)
    lines.push(`课体条件：${guaTiFacts.join('；')}`);

  const focusEvidence = (data.focusEvidence ?? [])
    .map((item) => {
      const evidence = item.evidence.filter(Boolean).join('、');
      return `${item.target}${item.role ? `（${item.role}）` : ''}，${item.level}：${evidence || '未列依据'}${item.limitations.length ? `；适用条件：${item.limitations.join('、')}` : ''}`;
    })
    .filter(Boolean);
  if (!options.chartFactsIncluded && focusEvidence.length)
    lines.push(`重点依据：${focusEvidence.join('；')}`);

  const timingEvidence = analysis.timingFacts.map((item) => item.promptText);
  if (!options.chartFactsIncluded && timingEvidence.length)
    lines.push(`时令依据：${timingEvidence.join('；')}`);
  const counters = analysis.counterEvidenceFacts
    .filter((item) => {
      if (!options.chartFactsIncluded) return true;
      if (item.scope === '四课' && item.basis === '上下神关系') {
        const lesson = analysis.lessons.find((entry) => entry.key === item.ownerKey);
        if (!lesson) return true;
        const displayed = formatLiurenLesson(lesson);
        if (displayed.includes(item.detail)) return false;
        const relation = formatLiurenRoleRelation(lesson.upper, lesson.lower, '上神', '下位');
        return (
          !relation ||
          item.detail !== relation.summary ||
          !displayed.includes(`；${relation.detail}`)
        );
      }
      if (item.scope === '三传') {
        const index = analysis.transmissions.findIndex((entry) => entry.key === item.ownerKey);
        if (index < 0) return true;
        if (item.basis === '相邻传关系') {
          const displayed = formatLiurenTransmission(data, index);
          if (displayed.includes(item.detail)) return false;
          const transmission = data.threeTransmissions[index];
          const previous =
            index === 0 ? data.fourLessons[0]?.lower : data.threeTransmissions[index - 1]?.branch;
          const previousName = index === 0 ? '一课下位' : data.threeTransmissions[index - 1].stage;
          const relation = previous
            ? formatLiurenRoleRelation(
                transmission.branch,
                previous,
                transmission.stage,
                previousName,
              )
            : undefined;
          return (
            !relation ||
            item.detail !== relation.summary ||
            !displayed.includes(`；${relation.detail}`)
          );
        }
        if (item.basis === '月令旺衰') {
          return !analysis.traditionalFacts.some(
            (fact) =>
              fact.kind === '天将乘神' &&
              fact.stages?.includes(analysis.transmissions[index].stage) &&
              fact.promptText.includes(`月令${item.detail}`),
          );
        }
        if (item.basis === '旬空') {
          return !formatLiurenTransmission(data, index).includes('（空）');
        }
      }
      return true;
    })
    .map((item) => item.promptText);
  if (counters.length || !options.chartFactsIncluded) {
    lines.push(
      `课传反证：${analysis.counterSummaryFact.status}${counters.length ? `；${counters.join('；')}` : ''}`,
    );
  }
  if (!options.chartFactsIncluded) {
    lines.push(
      '类神按问题主题取用，主证与空亡、休囚、冲克条件合看；应期结合三传先后、填实冲合及所问期限判断。',
    );
  }
  return lines;
}
