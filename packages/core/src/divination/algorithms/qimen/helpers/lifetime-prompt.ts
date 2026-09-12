/**
 * @file 奇门终身局自包含提示词生成器
 * @description 遵循 AGENTS.md 规范，生成供在线 AI 解读的自包含完整任务书，
 * 严禁暴露内部工程术语、代码路径、字段键名或否定性限制。
 */

import type { QimenLifetimeData } from '../../../../types/divination';
import { formatFixedTimezoneOffset } from '../../../../calendar/civil-time';
import { QIMEN_IMAGE_INTERPRETATION_TASK } from '../../../../prompt/qimen-interpretation';
import { formatQimenStemLocations } from '../../../../prompt/qimen-facts';

type TriggerDate = NonNullable<
  NonNullable<QimenLifetimeData['eventClusters']>[number]['triggerDates']
>[number];

function formatTriggerDate(item: TriggerDate): string {
  const detail = [item.ganzhi, item.relation].filter(Boolean).join('，');
  return detail ? `${item.dateTime ?? item.date}（${detail}）` : (item.dateTime ?? item.date);
}

function formatTriggerDates(items: TriggerDate[]): string[] {
  type DateGroup = { month: string; relation: string; entries: string[] };
  type Output = { kind: 'group'; group: DateGroup } | { kind: 'single'; text: string };

  const outputs: Output[] = [];
  const groups = new Map<string, DateGroup>();
  for (const item of items) {
    if (!item.dateTime && item.ganzhi && item.relation && /^\d{4}-\d{2}-\d{2}$/u.test(item.date)) {
      const month = item.date.slice(0, 7);
      const key = `${month}|${item.relation}`;
      let group = groups.get(key);
      if (!group) {
        group = { month, relation: item.relation, entries: [] };
        groups.set(key, group);
        outputs.push({ kind: 'group', group });
      }
      group.entries.push(`${item.date.slice(8, 10)}日（${item.ganzhi}）`);
    } else {
      outputs.push({ kind: 'single', text: formatTriggerDate(item) });
    }
  }

  return outputs.map((output) => {
    if (output.kind === 'single') return `  可复核日期：${output.text}`;
    const [year, month] = output.group.month.split('-');
    return `  可复核日期：${year}年${month}月${output.group.entries.join('、')}；日干支关系：${output.group.relation}`;
  });
}

/**
 * 构建终身局自包含提示词任务书
 */
export type LifetimePromptOptions = {
  includeCurrentTime?: boolean;
};

export function buildLifetimePrompt(
  data: QimenLifetimeData,
  question?: string,
  options: LifetimePromptOptions = {},
): string {
  const lines: string[] = [];
  const q = question?.trim() || '请全面推演我的人生宏观格局、核心阶段运限与关键转折窗口。';

  // 1. 【当前时间】
  if (options.includeCurrentTime !== false) {
    const now = new Date();
    const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    lines.push(`【当前时间】`);
    lines.push(`${nowStr}（UTC${formatFixedTimezoneOffset(-now.getTimezoneOffset() / 60)}）\n`);
  }

  // 2. 【传统依据】
  lines.push(`【传统依据】`);
  const baseTradition = [
    '奇门终身局以本次年命、日干和时干落宫为个人标记，结合门、星、神、天地盘干、宫间生克与格局解释人生主题。',
    '本命为根，阶段运限按所列起止与行限口径展开，流年引动结合本命及所属阶段共同判断；同一象意在不同时间层级分别取证。',
  ];

  const schoolNotes: Record<string, string> = {
    baojian: '《御定奇门宝鉴》取向：结合星门、奇仪、宫位生克与格局条件推演。',
    tongzong: '《奇门遁甲统宗》取向：围绕年命与个人标记落宫，结合各宫奇仪生克解释人事关系。',
    mingfa: '《奇门鸣法》取向：结合本次九宫、符使与动静关系推演。',
    yubo: '《烟波钓叟歌》取向：结合九星八门、奇仪格局与主客动静推演。',
  };

  if (data.input.schools && data.input.schools.length > 0) {
    for (const sc of data.input.schools) {
      if (schoolNotes[sc] && !baseTradition.includes(schoolNotes[sc])) {
        baseTradition.push(schoolNotes[sc]);
      }
    }
  }

  lines.push(`${baseTradition.join('\n')}\n`);

  // 3. 【起盘依据】
  lines.push(`【起盘依据】`);
  lines.push(`出生时刻：${data.input.birthDateTime}`);
  lines.push(`出生时区：${data.basis.timeZoneUsed}`);
  lines.push(`历法口径：${data.basis.calendar}`);
  lines.push(
    `时间标准：${data.basis.timeStandard}${data.basis.trueSolarOffsetSeconds !== undefined ? `（经度时差与均时差校正 ${data.basis.trueSolarOffsetSeconds} 秒）` : ''}`,
  );
  lines.push(`当令节气：${data.basis.solarTerm}`);
  lines.push(
    `排盘方法：${data.basis.method === 'zhuanpan' ? '转盘法（天禽寄坤二宫）' : '飞盘法（九星顺逆飞布）'}`,
  );
  lines.push(`定局法则：${data.basis.juMethod === 'chaibu' ? '拆补法' : '置闰法'}`);
  lines.push(
    `阶段模型：${data.basis.stagePolicy.model === 'pillarFourLimits' ? '传统四柱分限法（年柱初限、月柱中前限、日柱中后限、时柱末限）' : data.basis.stagePolicy.model === 'palaceWalk' ? '洛书九宫巡行法' : '符使卦轨大运法'}`,
  );
  if (data.input.schools && data.input.schools.length > 0) {
    const schoolLabels: Record<string, string> = {
      baojian: '宝鉴派',
      tongzong: '统宗派',
      mingfa: '鸣法派',
      yubo: '钓叟歌理路',
    };
    lines.push(`参考流派：${data.input.schools.map((s) => schoolLabels[s] || s).join('、')}`);
  }
  lines.push('');

  // 4. 【终身局基础盘】
  lines.push(`【终身局基础盘】`);
  lines.push(
    `四柱干支：${data.baseChart.ganzhi.year}年 ${data.baseChart.ganzhi.month}月 ${data.baseChart.ganzhi.day}日 ${data.baseChart.ganzhi.hour}时`,
  );
  lines.push(`遁局属性：${data.baseChart.isYangDun ? '阳遁' : '阴遁'} ${data.baseChart.juShu} 局`);
  lines.push(`值符星：${data.baseChart.zhiFu} | 值使门：${data.baseChart.zhiShi}`);
  if (data.baseChart.voidBranches && data.baseChart.voidBranches.length > 0) {
    lines.push(`旬空地支：${data.baseChart.voidBranches.join('、')}`);
  }
  if (data.baseChart.horseStar) {
    lines.push(
      `驿马星：${data.baseChart.horseStar.branch}（在${data.baseChart.horseStar.name || `${data.baseChart.horseStar.palace}宫`}）`,
    );
  }

  lines.push(`九宫四盘明细：`);
  for (const p of data.baseChart.jiuGongGe) {
    const starText = p.tianPan.companionStar
      ? `${p.tianPan.star}（携${p.tianPan.companionStar}）`
      : p.tianPan.star;
    const stemText = p.tianPan.companionStem
      ? `${p.tianPan.stem}（携${p.tianPan.companionStem}）`
      : p.tianPan.stem;
    const isVoid = data.baseChart.voidPalaces?.some((vp) => vp.palace === p.gong);
    const hasHorse = data.baseChart.horseStar?.palace === p.gong;
    const flags: string[] = [];
    if (isVoid) flags.push('旬空');
    if (hasHorse) flags.push('临马');
    lines.push(
      `  ${p.name}（${p.element}）：天盘[${starText}，干${stemText}]，人盘[${p.renPan.door}]，神盘[${p.shenPan.god}]，地盘干[${p.diPan.stem}]${flags.length > 0 ? `【${flags.join('，')}】` : ''}`,
    );
  }

  if (data.baseChart.classicPatterns && data.baseChart.classicPatterns.length > 0) {
    lines.push(`盘面吉凶格局：`);
    for (const cp of data.baseChart.classicPatterns) {
      lines.push(
        `  ${cp.name}（${cp.type === 'good' ? '吉' : cp.type === 'bad' ? '凶' : '中性'}）：${cp.summary}`,
      );
    }
  }
  lines.push('');

  lines.push(`同干定位（本命局）：\n${formatQimenStemLocations(data.baseChart).join('\n')}\n`);

  // 5. 【个人标记与主题宫】
  lines.push(`【个人标记与主题宫】`);
  lines.push(`核心个人标记：`);
  const layerMap: Record<string, string> = {
    tianPan: '天盘',
    diPan: '地盘',
    renPan: '人盘',
    shenPan: '神盘',
    baseGong: '本宫',
  };
  for (const m of data.personalMarkers) {
    const layerText = layerMap[m.layer] || m.layer;
    lines.push(`  ${m.traditionalSignificance}：值临${m.palaceName}（${layerText}）`);
  }

  lines.push(`人生重点主题候选宫：`);
  for (const t of data.topicCandidates) {
    const pNames = t.primaryPalaces
      .map((g) => data.baseChart.jiuGongGe.find((item) => item.gong === g)?.name || `${g}宫`)
      .join('、');
    lines.push(`  ${t.topicName}：主落${pNames}。依据：${t.basis}`);
    if (t.patternSummary.length > 0) {
      lines.push(`    宫位现状：${t.patternSummary.join('；')}`);
    }
  }
  lines.push('');

  // 6. 【人生阶段资料】
  lines.push(`【人生阶段资料】`);
  for (const st of data.stages) {
    const domNames = st.dominantPalaces.map((d) => d.name).join('、');
    lines.push(
      `阶段${st.stageIndex + 1}：${st.title}（${st.ageStart} - ${st.ageEnd} 岁 / ${st.calendarStart} ~ ${st.calendarEnd}）`,
    );
    lines.push(`  主导宫位：${domNames}`);
    lines.push(`  阶段核心主线：${st.stageTheme}`);
    if (st.supportFacts.length > 0) {
      lines.push(`  支持吉象：${st.supportFacts.join('；')}`);
    }
    if (st.constraintFacts.length > 0) {
      lines.push(`  考验反证：${st.constraintFacts.join('；')}`);
    }
  }
  lines.push('');

  // 7. 【周期触发与事件簇】
  if (data.eventClusters && data.eventClusters.length > 0) {
    lines.push(`【周期触发与事件簇】`);
    for (const ec of data.eventClusters) {
      lines.push(
        `${ec.timeSpan}${ec.stageIndex === undefined ? '（阶段表范围外）' : ''} ${ec.triggerFact}（节奏：${ec.rhythm}）`,
      );
      if (ec.triggerDates && ec.triggerDates.length > 0) {
        lines.push(...formatTriggerDates(ec.triggerDates));
      }
      lines.push(`  动态交互：${ec.interactionAnalysis}`);
      if (ec.supportEvidence.length > 0) {
        lines.push(`  增益因素：${ec.supportEvidence.join('；')}`);
      }
      if (ec.counterEvidence.length > 0) {
        lines.push(`  制约因素：${ec.counterEvidence.join('；')}`);
      }
      if (ec.verificationQuestions.length > 0) {
        lines.push(`  核验要点：${ec.verificationQuestions.join(' ')}`);
      }
    }
    lines.push('');
  }

  // 8. 【任务】
  lines.push(`【任务】`);
  lines.push(QIMEN_IMAGE_INTERPRETATION_TASK);
  lines.push(
    '终身局取象以本命为根，阶段与流年各用本层已列盘面；换象与造象分别说明适用的人生主题和时间层级。',
  );
  lines.push(
    `请依据奇门遁甲本命局、个人标记、阶段运限与事件动态推演终身格局与大限走向。先综述先天格局底色，再按人生阶段依次展开运限分析，最后结合流年触发窗口回答【问题】。先给出明确的倾向或吉凶定性，再说明主要理据及其生克演变；涉及阶段变化时，依据已列干支时段、节令或时间层级说明。`,
  );
  lines.push('');

  // 9. 【问题】
  lines.push(`【问题】`);
  lines.push(`${q}`);

  return lines.join('\n');
}
