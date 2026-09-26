import type { LiurenData } from '../types/divination';
import { analyzeLiurenEvidence } from '../divination/liuren-evidence';
import { formatLiurenOrdinaryTransmissionAdjudication } from './liuren-facts';

export function formatLiurenJudgmentFacts(
  data: LiurenData,
  options: { includeOrdinaryAdjudication?: boolean; chartFactsIncluded?: boolean } = {},
): string[] {
  const lines: string[] = [];
  if (!options.chartFactsIncluded && data.transmissionDetail) {
    const sourceMarker = '；古籍依据依次为：';
    const sourceIndex = data.transmissionDetail.indexOf(sourceMarker);
    const transmissionBasis =
      sourceIndex >= 0 ? data.transmissionDetail.slice(0, sourceIndex) : data.transmissionDetail;
    if (transmissionBasis) lines.push(`取传说明：${transmissionBasis}`);
  }

  const classicalRules = (data.classicalRules ?? [])
    .map((item) => `${item.category}：${item.summary}`)
    .filter(Boolean);
  if (classicalRules.length) lines.push(`取传条件：${classicalRules.join('；')}`);
  const ordinaryAdjudication = formatLiurenOrdinaryTransmissionAdjudication(data);
  if (
    !options.chartFactsIncluded &&
    options.includeOrdinaryAdjudication !== false &&
    ordinaryAdjudication
  )
    lines.push(ordinaryAdjudication);
  const guaTiFacts = (data.guaTiFacts ?? [])
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

  const analysis = analyzeLiurenEvidence(data);
  const timingEvidence = analysis.timingFacts.map((item) => item.promptText);
  if (!options.chartFactsIncluded && timingEvidence.length)
    lines.push(`时令依据：${timingEvidence.join('；')}`);
  const counters = analysis.counterEvidenceFacts.map((item) => item.promptText);
  lines.push(
    `课传反证：${analysis.counterSummaryFact.status}${counters.length ? `；${counters.join('；')}` : ''}`,
  );
  if (!options.chartFactsIncluded) {
    lines.push(
      '类神按问题主题取用，主证与空亡、休囚、冲克条件合看；应期结合三传先后、填实冲合及所问期限判断。',
    );
  }
  return lines;
}
