import type { z } from 'zod';
import type { huangjiInput } from '../schema';
import { sameJsonValue } from '../json-value';
import tables from './huangji-table-data.json';
import { formatHuangjiTableLabel } from './prompt-format';

type Input = z.infer<typeof huangjiInput>;
type Settings = Extract<Input['huangji'], { mode: 'reference' }>;
type ReferenceInput = Input & { huangji: Settings };
// Fixed source texts and labels were transcribed from the repository's reference tables.
// Each historical block has 30 consecutive sexagenary entries starting at 甲子 or 甲午.
const stems = '甲乙丙丁戊己庚辛壬癸';
const branches = '子丑寅卯辰巳午未申酉戌亥';

function query(settings: Settings) {
  if (settings.table === 'sound-rhythm') return structuredClone(tables.sound);
  if (settings.table === 'animal-plant') return structuredClone(tables.animal);
  const shiIndex = settings.shiIndex;
  if (typeof shiIndex !== 'number' || !Number.isInteger(shiIndex) || shiIndex < 2149 || shiIndex > 2208) throw new Error('经辰序号必须是2149至2208之间的整数。');
  const index = shiIndex - 2149;
  const branch = branches[index % 12];
  const sourceBranch = shiIndex === 2178 || shiIndex === 2190 ? '己' : branch;
  const entries = tables.historical.labels[index];
  const rows = tables.historical.texts[index].map((sourceText, row) => {
    const position = (index * 30 + row) % 60;
    const label = entries.find(([rowIndex]) => rowIndex === row + 1)?.[1];
    return { rowIndex: row + 1, ganzhi: stems[position % 10] + branches[position % 12], sourceText, ...(label === undefined ? {} : { historicalLabel: String(label) }) };
  });
  return {
    table: 'historical-era' as const,
    title: '经辰历史纪年原表',
    source: structuredClone(tables.historical.sources[index < 36 ? 0 : 1]),
    shiIndex, sourceBranch, branch,
    ...(sourceBranch === branch ? {} : { sourceBranchNote: '固定卷页文字作“己”；按相邻经辰的子丑寅卯辰巳顺序校为“巳”。' }),
    rows,
    namedEntries: entries.map(([rowIndex, label]) => {
      const row = rows[Number(rowIndex) - 1];
      return { rowIndex: Number(rowIndex), ganzhi: row.ganzhi, label: String(label), sourceText: row.sourceText };
    }),
    limitations: [...tables.historical.limitations],
  };
}

function formatHuangjiReferenceText(result: ReturnType<typeof query>): string {
  const sourcesList = Array.isArray(result.source) ? result.source : [result.source];
  const sourceLines = sourcesList.map(
    (s) => `${s.title}（${s.edition}，修订版 ${s.revision}）`,
  );
  const lines: string[] = [
    `表名：${result.title}（${formatHuangjiTableLabel(result.table)}）`,
    `资料出处：${sourceLines.join('；')}`,
  ];

  if ('bodyCounts' in result) {
    const bodyCounts = result.bodyCounts as {
      heavenlyBody?: number;
      earthlyBody?: number;
      heavenlyUseSound?: number;
      earthlyUseTone?: number;
    };
    lines.push(
      `体用数目：天体 ${bodyCounts.heavenlyBody ?? '—'}、地体 ${bodyCounts.earthlyBody ?? '—'}、天用声 ${bodyCounts.heavenlyUseSound ?? '—'}、地用音 ${bodyCounts.earthlyUseTone ?? '—'}`,
      `四声分类：${result.soundCategories.join('、')}；四音分类：${result.toneCategories.join('、')}`,
      `图数：${result.diagramCounts.map((d) => `${d.name} ${d.value}（${d.formula}）`).join('；')}`,
      `四象配属：${result.pairings.map((p) => `${p.image}（${p.sound}/${p.tone}·${p.element}）`).join('；')}`,
      `原表规则：\n${result.rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}`,
    );
  } else if ('counts' in result) {
    lines.push(
      `动植物数目：\n${result.counts.map((c) => `- ${c.name}：${c.value}（${c.formula}）`).join('\n')}`,
    );
  } else if ('rows' in result) {
    lines.push(`经辰序号：${result.shiIndex}（${result.branch}）`);
    if (result.sourceBranchNote) {
      lines.push(`校注：${result.sourceBranchNote}`);
    }
    if (result.namedEntries.length) {
      lines.push(
        `历史纪年条目：\n${result.namedEntries.map((e) => `- 第${e.rowIndex}格 ${e.ganzhi}（${e.label}）：${e.sourceText}`).join('\n')}`,
      );
    }
    lines.push(
      `经辰三十世全表：\n${result.rows.map((r) => `${r.rowIndex}. ${r.ganzhi}${r.historicalLabel ? `（${r.historicalLabel}）` : ''}：${r.sourceText}`).join('\n')}`,
    );
  }

  if (result.limitations.length) {
    lines.push(`资料限制：${result.limitations.join('；')}`);
  }
  return lines.join('\n');
}

function buildPrompt(result: ReturnType<typeof query>, question: string, now: string) {
  const user = [
    `【时间】\n提示词时间：${now}。`,
    `【固定版本资料表】\n${formatHuangjiReferenceText(result)}`,
    '【任务】\n依据所给资料表回答问题，保留原表标记、来源版本和资料限制；未列历史对应或数值不作补造。',
    `【问题】\n${question}`,
  ].join('\n\n');
  return { text: user };
}

export function huangjiReference(input: ReferenceInput, now: string) {
  const result = query(input.huangji);
  return {
    data: { input: input.huangji, reference: result },
    summary: { title: result.title, tags: [formatHuangjiTableLabel(result.table), ...(input.huangji.table === 'historical-era' ? [`经辰${input.huangji.shiIndex}`] : [])], lines: result.limitations },
    prompt: buildPrompt(result, input.question, now),
  };
}

export function promptForHuangjiReference(data: Record<string, unknown>, input: ReferenceInput, now: string) {
  const result = query(input.huangji);
  if (!sameJsonValue(data.reference, result)) throw new Error('皇极资料表与查询条件不一致。');
  return buildPrompt(result, input.question, now);
}
