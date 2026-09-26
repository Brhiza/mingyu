/**
 * 占问、择时与风水类提示词的事实预期。
 *
 * 事实预期只从算法返回的结构化结果提取，供本地提示词审计使用；不读取
 * prompt、promptText 或最终正文来反推 values。每个事实都带有正文中的归属
 * 标签，避免只凭孤立数字或同名内容误判为已传递。
 */
import type { PromptFactExpectation } from './facts';
import { resolveSsgwStoryContent } from '../../packages/core/src/divination/ssgw-content';
import type { SsgwData } from '../../packages/core/src/types/divination';

export type DivinationPromptFact = PromptFactExpectation;
export type DivinationFactExtractor = (data: unknown) => DivinationPromptFact[];

type AnyRecord = Record<string, unknown>;
type FactOptions = Pick<PromptFactExpectation, 'scope' | 'unit'>;

function isRecord(value: unknown): value is AnyRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function record(value: unknown): AnyRecord | null {
  return isRecord(value) ? value : null;
}

function text(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
}

function texts(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(text).filter((item): item is string => Boolean(item));
}

function numbers(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is number => typeof item === 'number' && Number.isFinite(item));
}

function records(value: unknown): AnyRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord);
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function fact(
  id: string,
  owner: string,
  values: Array<unknown>,
  options: FactOptions = {},
): DivinationPromptFact | null {
  const cleaned = unique(values.map(text).filter((value): value is string => Boolean(value)));
  if (!id || !owner.trim() || !cleaned.length) return null;
  return {
    id,
    owner: owner.trim(),
    values: cleaned,
    ...(options.scope ? { scope: options.scope } : {}),
    ...(options.unit ? { unit: options.unit } : {}),
  };
}

function collect(items: Array<DivinationPromptFact | null>): DivinationPromptFact[] {
  return items.filter((item): item is DivinationPromptFact => Boolean(item));
}

function join(value: unknown, separator = '、'): string | undefined {
  const result = texts(value).join(separator);
  return result || undefined;
}

function firstText(...values: unknown[]): string | undefined {
  for (const value of values) {
    const result = text(value);
    if (result) return result;
  }
  return undefined;
}

function nonEmptyLines(value: unknown): string[] {
  return (
    text(value)
      ?.split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean) || []
  );
}

function yaoBrief(item: AnyRecord): string | undefined {
  const position = text(item.position);
  const relative = text(item.sixRelative);
  const branch = firstText(item.najiaDizhi, item.branch, item.dizhi);
  const element = text(item.wuxing);
  if (!position || !relative || !branch || !element) return undefined;
  return `第${position}爻${relative}${branch}${element}`;
}

function extractLiuyaoFacts(data: unknown): DivinationPromptFact[] {
  const d = record(data);
  if (!d) return [];
  const yaos = records(d.yaosDetail);
  const world = yaos.find((item) => item.isWorld === true);
  const response = yaos.find((item) => item.isResponse === true);
  const changing = yaos.filter((item) => item.isChanging === true);
  const voidBranches = texts(d.voidBranches);
  const facts = collect([
    fact('liuyao.core', '核心结构：', [
      text(d.originalName) ? `主卦${text(d.originalName)}` : undefined,
      `变卦${text(d.changedName) || '无'}`,
      `互卦${text(d.interName) || '无'}`,
    ]),
    fact('liuyao.palace-stage', '八宫卦位：', [d.palaceStage]),
    world || response
      ? fact('liuyao.world-response', '世应：', [
          world ? `世爻${yaoBrief(world)}` : '世爻未列',
          response ? `应爻${yaoBrief(response)}` : '应爻未列',
        ])
      : null,
    fact(
      'liuyao.changing',
      '动变：',
      changing.length
        ? changing.map(yaoBrief).filter((item): item is string => Boolean(item))
        : ['无'],
    ),
    ...yaos.map((item, index) =>
      fact(`liuyao.yao.${index}`, yaoBrief(item) ?? '', [`六神${text(item.sixGod)}`], {
        scope: { start: '六爻全表：', end: '月日触发：' },
      }),
    ),
    fact('liuyao.void', '旬空', [voidBranches.length ? voidBranches.join('、') : '未列']),
  ]);
  return facts;
}

function extractMeihuaFacts(data: unknown): DivinationPromptFact[] {
  const d = record(data);
  if (!d) return [];
  const ti = record(d.tiGua);
  const yong = record(d.yongGua);
  const changedTi = record(d.changedTiGua);
  const changedYong = record(d.changedYongGua);
  const analysis = record(d.analysis);
  const facts = collect([
    fact('meihua.core', '核心结构：', [
      `主卦${text(d.originalName)}`,
      `互卦${text(d.interName) || '无'}`,
      `变卦${text(d.changedName) || '无'}`,
    ]),
    fact('meihua.ti-yong', '体用：', [
      ti ? `体卦${text(ti.name)}（${text(ti.element)}）` : undefined,
      yong ? `用卦${text(yong.name)}（${text(yong.element)}）` : undefined,
      d.movingYao && isRecord(d.movingYao) ? `动爻第${text(d.movingYao.position)}爻` : undefined,
      analysis ? `体用关系${text(analysis.tiYongRelation)}` : undefined,
    ]),
    fact('meihua.inter', '互卦：', [
      ` ${text(d.interName) || text(record(d.interHexagram)?.name) || '无'}`,
      record(d.interTiGua) ? `体互${text(record(d.interTiGua)?.name)}` : undefined,
      record(d.interYongGua) ? `用互${text(record(d.interYongGua)?.name)}` : undefined,
    ]),
    fact('meihua.changed', '变卦：', [
      ` ${text(d.changedName) || text(record(d.changedHexagram)?.name) || '无'}`,
      changedTi ? `变后体卦${text(changedTi.name)}` : undefined,
      changedYong ? `变后用卦${text(changedYong.name)}` : undefined,
    ]),
  ]);
  return facts;
}

function qimenPalaceFacts(data: AnyRecord): DivinationPromptFact[] {
  return collect(
    records(data.jiuGongGe).map((palace, index) => {
      const tian = record(palace.tianPan);
      const di = record(palace.diPan);
      const ren = record(palace.renPan);
      const shen = record(palace.shenPan);
      const name = text(palace.name);
      if (!name) return null;
      return fact(
        `qimen.palace.${index}`,
        name,
        [
          ren && text(ren.door) ? `门${text(ren.door)}` : undefined,
          tian && firstText(tian.star, tian.companionStar)
            ? `星${[text(tian.star), text(tian.companionStar)].filter(Boolean).join('、')}`
            : undefined,
          shen && text(shen.god) ? `神${text(shen.god)}` : undefined,
          tian && text(tian.stem)
            ? `天盘${[text(tian.stem), text(tian.companionStem)].filter(Boolean).join('、')}`
            : undefined,
          di && text(di.stem) ? `地盘${text(di.stem)}` : undefined,
        ],
        { scope: { start: '九宫简表：', end: '同干定位：' } },
      );
    }),
  );
}

function extractQimenFacts(data: unknown): DivinationPromptFact[] {
  const d = record(data);
  if (!d) return [];
  const isYang = d.isYangDun === true;
  const zhiFu = text(d.zhiFu);
  const zhiShi = text(d.zhiShi);
  const voidBranches = texts(d.voidBranches);
  const voidPalaces = records(d.voidPalaces);
  const voidText = voidPalaces.length
    ? voidPalaces
        .map((item) => [text(item.branch), text(item.name)].filter(Boolean).join('空落'))
        .join('、')
    : voidBranches.length
      ? `${voidBranches.join('、')}空`
      : '无';
  const horse = record(d.horseStar);
  const horseText = horse
    ? [text(horse.sourceBranch), '时驿马在', text(horse.branch), '，落', text(horse.name)]
        .filter((item): item is string => Boolean(item))
        .join('')
    : '无';
  const facts = collect([
    fact('qimen.core', '核心结构：', [
      `${isYang ? '阳遁' : '阴遁'}${text(d.juShu)}局`,
      text(record(d.timeInfo)?.juTerm),
      text(record(d.timeInfo)?.epoch),
    ]),
    fact('qimen.zhi-fu-zhi-shi', '值符值使与时干：', [
      zhiFu ? `值符${zhiFu}` : undefined,
      zhiShi ? `值使${zhiShi}` : undefined,
      text(record(d.ganzhi)?.hour) ? `时干${text(record(d.ganzhi)?.hour)?.charAt(0)}` : undefined,
    ]),
    fact('qimen.void-horse', '旬空与马星：', [voidText, horseText]),
    ...qimenPalaceFacts(d),
  ]);
  return facts;
}

function lifetimeSource(data: unknown): AnyRecord | null {
  const wrapper = record(data);
  const nested = record(wrapper?.data);
  return nested || wrapper;
}

function lifetimeStageModelLabel(model: unknown): string | undefined {
  switch (text(model)) {
    case 'pillarFourLimits':
      return '传统四柱分限法（年柱初限、月柱中前限、日柱中后限、时柱末限）';
    case 'palaceWalk':
      return '洛书九宫巡行法';
    case 'decadalGanzhi':
      return '十年干支大运（八字交节起运合参奇门本命宫）';
    case 'fuShiHexagramOrbit':
      return '符使交替十年分段';
    default:
      return undefined;
  }
}

function lifetimeStageScope(stages: AnyRecord[], index: number) {
  const start = `阶段${index + 1}：`;
  const next = stages[index + 1];
  return next ? { start, end: `阶段${index + 2}：` } : { start };
}

function lifetimePalaceFacts(
  chart: AnyRecord,
  scope: FactOptions['scope'],
): DivinationPromptFact[] {
  return collect(
    records(chart.jiuGongGe).map((palace, index) => {
      const name = text(palace.name);
      const tian = record(palace.tianPan);
      const ren = record(palace.renPan);
      const shen = record(palace.shenPan);
      const di = record(palace.diPan);
      if (!name) return null;
      const star = text(tian?.star);
      const companionStar = text(tian?.companionStar);
      const stem = text(tian?.stem);
      const companionStem = text(tian?.companionStem);
      return fact(
        `qimen-lifetime.base-palace.${index}`,
        name,
        [
          star ? `天盘[${star}` : undefined,
          companionStar ? `携${companionStar}` : undefined,
          stem ? `干${stem}` : undefined,
          companionStem ? `携${companionStem}` : undefined,
          ren && text(ren.door) ? `人盘[${text(ren.door)}]` : undefined,
          shen && text(shen.god) ? `神盘[${text(shen.god)}]` : undefined,
          di && text(di.stem) ? `地盘干[${text(di.stem)}]` : undefined,
        ],
        { scope },
      );
    }),
  );
}

function lifetimeDailyRelationCount(cluster: AnyRecord): number {
  const count = records(cluster.triggerDates).length;
  return text(cluster.key)?.includes(':day:') ? count : 0;
}

function lifetimeEventHeader(cluster: AnyRecord): string | undefined {
  const timeSpan = text(cluster.timeSpan);
  const triggerFact = text(cluster.triggerFact);
  if (!timeSpan || !triggerFact) return undefined;
  const dailyCount = lifetimeDailyRelationCount(cluster);
  const stageIndices = Array.isArray(cluster.stageIndices)
    ? cluster.stageIndices.map(text).filter((item): item is string => Boolean(item))
    : [];
  const stageIndex = text(cluster.stageIndex);
  const scopeText = stageIndices.length
    ? `（涉及阶段${stageIndices.map((item) => String(Number(item) + 1)).join('、')}）`
    : stageIndex === undefined
      ? '（阶段表范围外）'
      : '';
  return `${timeSpan}${scopeText} ${dailyCount ? `共${dailyCount}个日辰` : triggerFact}`;
}

function formatLifetimeTriggerDate(item: AnyRecord): string | undefined {
  const dateTime = firstText(item.dateTime, item.date);
  if (!dateTime) return undefined;
  const detail = [text(item.ganzhi), text(item.relation)].filter(Boolean).join('，');
  return detail ? `${dateTime}（${detail}）` : dateTime;
}

function formatLifetimeTriggerLines(items: AnyRecord[]): string[] {
  type DateGroup = { month: string; relation: string; entries: string[] };
  type Output = { kind: 'group'; group: DateGroup } | { kind: 'single'; text: string };
  const outputs: Output[] = [];
  const groups = new Map<string, DateGroup>();
  for (const item of items) {
    const date = text(item.date);
    const dateTime = text(item.dateTime);
    const ganzhi = text(item.ganzhi);
    const relation = text(item.relation);
    if (!dateTime && date && ganzhi && relation && /^\d{4}-\d{2}-\d{2}$/u.test(date)) {
      const month = date.slice(0, 7);
      const key = `${month}|${relation}`;
      let group = groups.get(key);
      if (!group) {
        group = { month, relation, entries: [] };
        groups.set(key, group);
        outputs.push({ kind: 'group', group });
      }
      group.entries.push(`${date.slice(8, 10)}日（${ganzhi}）`);
    } else {
      const formatted = formatLifetimeTriggerDate(item);
      if (formatted) outputs.push({ kind: 'single', text: formatted });
    }
  }
  return outputs.map((output) => {
    if (output.kind === 'single') return `可复核日期：${output.text}`;
    const [year, month] = output.group.month.split('-');
    return `可复核日期：${year}年${month}月${output.group.entries.join('、')}；日干支关系：${output.group.relation}`;
  });
}

/** 奇门终身局需同时审计本命、主题、阶段与动态事件，不能只按普通时家盘读取。 */
function extractQimenLifetimeFacts(data: unknown): DivinationPromptFact[] {
  const d = lifetimeSource(data);
  if (!d) return [];
  const input = record(d.input);
  const basis = record(d.basis);
  const baseChart = record(d.baseChart);
  if (!input || !basis || !baseChart) return [];
  const stages = records(d.stages);
  const markers = records(d.personalMarkers);
  const candidates = records(d.topicCandidates);
  const events = records(d.eventClusters);
  const basisScope = { start: '【起盘依据】', end: '【终身局基础盘】' };
  const baseScope = { start: '【终身局基础盘】', end: '【个人标记与主题宫】' };
  const markerScope = { start: '核心个人标记：', end: '人生重点主题候选宫：' };
  const candidateScope = { start: '人生重点主题候选宫：', end: '【人生阶段资料】' };
  const eventSectionScope = { start: '【周期触发与事件簇】', end: '【任务】' };
  const classicPatterns = records(baseChart.classicPatterns);
  const basePatternFacts = new Map<string, string>();
  for (const pattern of classicPatterns) {
    const name = text(pattern.name);
    const summary = text(pattern.summary);
    const label = pattern.type === 'good' ? '成吉格' : pattern.type === 'bad' ? '逢凶格' : '';
    if (name && summary && label) {
      basePatternFacts.set(`${label}「${name}」：${summary}`, `${label}「${name}」`);
    }
  }
  const formatStageFacts = (value: unknown) =>
    unique(texts(value).map((item) => basePatternFacts.get(item) ?? item)).join('；');
  const facts = collect([
    fact('qimen-lifetime.birth-date', '出生时刻：', [input.birthDateTime], { scope: basisScope }),
    fact('qimen-lifetime.birth-timezone', '出生时区：', [basis.timeZoneUsed], {
      scope: basisScope,
    }),
    fact('qimen-lifetime.calendar', '历法口径：', [basis.calendar], { scope: basisScope }),
    fact('qimen-lifetime.time-standard', '时间标准：', [basis.timeStandard], { scope: basisScope }),
    fact('qimen-lifetime.solar-term', '当令节气：', [basis.solarTerm], { scope: basisScope }),
    fact(
      'qimen-lifetime.method',
      '排盘方法：',
      [
        text(basis.method) === 'zhuanpan'
          ? '转盘法'
          : text(basis.method) === 'feipan'
            ? '飞盘法'
            : undefined,
      ],
      { scope: basisScope },
    ),
    fact(
      'qimen-lifetime.ju-method',
      '定局法则：',
      [
        text(basis.juMethod) === 'chaibu'
          ? '拆补法'
          : text(basis.juMethod) === 'zhirun'
            ? '置闰法'
            : undefined,
      ],
      { scope: basisScope },
    ),
    fact(
      'qimen-lifetime.stage-model',
      '阶段模型：',
      [lifetimeStageModelLabel(record(basis.stagePolicy)?.model)],
      { scope: basisScope },
    ),
  ]);

  const decadal = record(basis.decadalLuck);
  if (decadal) {
    const startAge = record(decadal.startAge);
    const ageText = startAge
      ? `出生后${text(startAge.years) || '0'}年${text(startAge.months) || '0'}月${text(startAge.days) || '0'}日${text(startAge.hours) || '0'}时${text(startAge.minutes) || '0'}分`
      : undefined;
    facts.push(
      ...collect([
        fact(
          'qimen-lifetime.decadal-start',
          '起运：',
          [
            ageText,
            decadal.startDateTime,
            text(decadal.direction) === 'forward'
              ? '顺行'
              : text(decadal.direction) === 'backward'
                ? '逆行'
                : undefined,
          ],
          { scope: basisScope },
        ),
        fact('qimen-lifetime.decadal-rule', '起运口径：', [decadal.rule], { scope: basisScope }),
        fact('qimen-lifetime.decadal-mapping', '定位口径：', [decadal.mapping], {
          scope: basisScope,
        }),
      ]),
    );
  }

  const baseGanzhi = record(baseChart.ganzhi);
  facts.push(
    ...collect([
      fact(
        'qimen-lifetime.base-ganzhi',
        '四柱干支：',
        [
          baseGanzhi?.year ? `${text(baseGanzhi.year)}年` : undefined,
          baseGanzhi?.month ? `${text(baseGanzhi.month)}月` : undefined,
          baseGanzhi?.day ? `${text(baseGanzhi.day)}日` : undefined,
          baseGanzhi?.hour ? `${text(baseGanzhi.hour)}时` : undefined,
        ],
        { scope: baseScope },
      ),
      fact(
        'qimen-lifetime.base-dun',
        '遁局属性：',
        [baseChart.isYangDun === true ? '阳遁' : '阴遁', `${text(baseChart.juShu)}局`],
        { scope: baseScope },
      ),
      fact('qimen-lifetime.base-zhi-fu', '值符星：', [baseChart.zhiFu], { scope: baseScope }),
      fact('qimen-lifetime.base-zhi-shi', '值使门：', [baseChart.zhiShi], { scope: baseScope }),
      fact('qimen-lifetime.base-void', '旬空地支：', [join(baseChart.voidBranches) || undefined], {
        scope: baseScope,
      }),
      fact(
        'qimen-lifetime.base-horse',
        '驿马星：',
        [record(baseChart.horseStar)?.branch, record(baseChart.horseStar)?.name],
        { scope: baseScope },
      ),
      ...lifetimePalaceFacts(baseChart, baseScope),
    ]),
  );
  facts.push(
    ...collect(
      classicPatterns.map((pattern, index) => {
        const name = text(pattern.name);
        const summary = text(pattern.summary);
        const tone = pattern.type === 'good' ? '吉' : pattern.type === 'bad' ? '凶' : '中性';
        return name && summary
          ? fact(`qimen-lifetime.base-pattern.${index}`, `${name}（${tone}）：`, [summary], {
              scope: baseScope,
              unit: 'line',
            })
          : null;
      }),
    ),
  );

  facts.push(
    ...collect(
      markers.map((marker, index) => {
        const meaning = text(marker.traditionalSignificance);
        const palaceName = text(marker.palaceName);
        const layerMap: Record<string, string> = {
          tianPan: '天盘',
          diPan: '地盘',
          renPan: '人盘',
          shenPan: '神盘',
          baseGong: '本宫',
        };
        const layer = text(marker.layer);
        return fact(
          `qimen-lifetime.marker.${index}`,
          meaning ? `${meaning}：` : '核心个人标记：',
          [
            palaceName ? `值临${palaceName}` : undefined,
            layer && layerMap[layer] ? `（${layerMap[layer]}）` : undefined,
          ],
          { scope: markerScope, unit: 'line' },
        );
      }),
    ),
  );

  const chartPalaceName = (number: unknown) => {
    const value = Number(number);
    return records(baseChart.jiuGongGe).find((palace) => Number(palace.gong) === value)?.name;
  };
  facts.push(
    ...collect(
      candidates.map((candidate, index) => {
        const name = text(candidate.topicName);
        if (!name) return null;
        const primary = numbers(candidate.primaryPalaces)
          .map((value) => chartPalaceName(value))
          .filter((value): value is string => Boolean(value));
        return fact(
          `qimen-lifetime.candidate.${index}`,
          `${name}：`,
          [
            primary.length ? `主落${primary.join('、')}` : undefined,
            text(candidate.basis) ? `依据：${text(candidate.basis)}` : undefined,
          ],
          { scope: candidateScope, unit: 'line' },
        );
      }),
    ),
  );

  facts.push(
    ...collect(
      stages.flatMap((stage, index) => {
        const scope = lifetimeStageScope(stages, index);
        const dominantNames = records(stage.dominantPalaces)
          .map((item) => text(item.name))
          .filter((value): value is string => Boolean(value));
        const stageFacts = [
          fact(
            `qimen-lifetime.stage.${index}.header`,
            `阶段${index + 1}：`,
            [stage.title, stage.calendarStart, stage.calendarEnd],
            { scope, unit: 'line' },
          ),
          fact(`qimen-lifetime.stage.${index}.palaces`, '主导宫位：', dominantNames, {
            scope,
            unit: 'line',
          }),
          fact(`qimen-lifetime.stage.${index}.theme`, '阶段核心主线：', [stage.stageTheme], {
            scope,
            unit: 'line',
          }),
          stage.startDateTime
            ? fact(
                `qimen-lifetime.stage.${index}.exact-range`,
                '精确区间：',
                [stage.startDateTime, stage.endDateTimeExclusive],
                { scope, unit: 'line' },
              )
            : null,
          stage.ganzhi
            ? fact(
                `qimen-lifetime.stage.${index}.ganzhi`,
                '干支定位：',
                [join(stage.associatedMarkers, '；')],
                { scope, unit: 'line' },
              )
            : null,
          texts(stage.supportFacts).length
            ? fact(
                `qimen-lifetime.stage.${index}.support`,
                '支持吉象：',
                [formatStageFacts(stage.supportFacts)],
                { scope, unit: 'line' },
              )
            : null,
          texts(stage.constraintFacts).length
            ? fact(
                `qimen-lifetime.stage.${index}.constraint`,
                '考验反证：',
                [formatStageFacts(stage.constraintFacts)],
                { scope, unit: 'line' },
              )
            : null,
        ];
        return stageFacts;
      }),
    ),
  );

  const eventHeaders = events.map(lifetimeEventHeader);
  facts.push(
    ...collect(
      events.flatMap((event, index) => {
        const header = eventHeaders[index];
        if (!header) return [];
        const dailyCount = lifetimeDailyRelationCount(event);
        const nextHeader = eventHeaders[index + 1];
        const scope = {
          start: header,
          end: nextHeader || '【任务】',
        };
        const stageIndices = Array.isArray(event.stageIndices)
          ? event.stageIndices
              .map((value) => Number(value) + 1)
              .filter(Number.isFinite)
              .join('、')
          : '';
        const stageFact = stageIndices ? `涉及阶段${stageIndices}` : undefined;
        const triggerDateLines = formatLifetimeTriggerLines(records(event.triggerDates));
        return [
          fact(
            `qimen-lifetime.event.${index}.header`,
            dailyCount ? `共${dailyCount}个日辰` : text(event.triggerFact) || '',
            [text(event.rhythm) ? `节奏：${text(event.rhythm)}` : undefined, stageFact],
            { scope: eventSectionScope, unit: 'line' },
          ),
          ...triggerDateLines.map((line, dateIndex) =>
            fact(
              `qimen-lifetime.event.${index}.date.${dateIndex}`,
              '可复核日期：',
              [line.slice('可复核日期：'.length)],
              { scope, unit: 'line' },
            ),
          ),
          dailyCount
            ? null
            : fact(
                `qimen-lifetime.event.${index}.interaction`,
                '动态交互：',
                [event.interactionAnalysis],
                { scope, unit: 'line' },
              ),
          !dailyCount && texts(event.supportEvidence).length
            ? fact(
                `qimen-lifetime.event.${index}.support`,
                '增益因素：',
                [join(event.supportEvidence, '；')],
                { scope, unit: 'line' },
              )
            : null,
          texts(event.counterEvidence).length
            ? fact(
                `qimen-lifetime.event.${index}.counter`,
                '制约因素：',
                [join(event.counterEvidence, '；')],
                { scope, unit: 'line' },
              )
            : null,
          !dailyCount &&
          !text(event.key)?.includes(':month-clash:') &&
          texts(event.verificationQuestions).length
            ? fact(
                `qimen-lifetime.event.${index}.verification`,
                '核验要点：',
                [join(event.verificationQuestions, ' ')],
                { scope, unit: 'line' },
              )
            : null,
        ];
      }),
    ),
  );
  return facts;
}

function extractLiurenFacts(data: unknown): DivinationPromptFact[] {
  const d = record(data);
  if (!d) return [];
  const lessons = records(d.fourLessons);
  const transmissions = records(d.threeTransmissions);
  const facts = collect([
    fact('liuren.core', '核心结构：', [
      text(d.monthLeader) ? `月将${text(d.monthLeader)}` : undefined,
      text(d.divinationBranch) ? `占时${text(d.divinationBranch)}` : undefined,
      text(d.dayNight),
      text(d.noblemanBranch) ? `贵人${text(d.noblemanBranch)}` : undefined,
      texts(d.xunKong).length ? `旬空${texts(d.xunKong).join('、')}` : undefined,
    ]),
    ...lessons.map((item, index) => {
      const name = text(item.name);
      const upper = text(item.upper);
      const lower = text(item.lower);
      const god = text(item.god);
      if (!name || !upper || !lower || !god) return null;
      return fact(
        `liuren.four-lesson.${index}`,
        `${name}${upper}临${lower}乘${god}，`,
        [item.relation],
        { unit: 'line', scope: { start: '四课：', end: '三传：' } },
      );
    }),
    ...transmissions.map((item, index) => {
      const stage = text(item.stage);
      const branch = text(item.branch);
      const god = text(item.god);
      if (!stage || !branch || !god) return null;
      return fact(
        `liuren.three-transmission.${index}`,
        `${stage}${branch}乘${god}，`,
        [item.relation],
        { unit: 'line', scope: { start: '三传：' } },
      );
    }),
  ]);
  return facts;
}

function extractXiaoliurenFacts(data: unknown): DivinationPromptFact[] {
  const d = record(data);
  if (!d) return [];
  const sequence = record(d.sequence);
  const month = record(sequence?.month);
  const day = record(sequence?.day);
  const hour = record(sequence?.hour);
  const primary = record(d.primary);
  const leapLabel = d.isLeapMonth === true ? '闰' : '';
  return collect([
    fact('xiaoliuren.start', '起课：', [
      `农历${leapLabel}${text(d.lunarMonth) || ''}月${text(d.lunarDay) || ''}日`,
      text(d.hourLabel),
    ]),
    fact(
      'xiaoliuren.process',
      '起课过程：',
      [
        month
          ? `定月宫：${leapLabel}${text(d.lunarMonth) || ''}月从大安顺数，落${text(month.name) || ''}`
          : undefined,
        day
          ? `定日宫：从月宫${text(month?.name) || ''}${text(d.rule) === 'duoneng' ? '下一宫' : ''}起初一，顺数至${text(d.lunarDay) || ''}日，落${text(day.name) || ''}`
          : undefined,
        hour
          ? `定时宫：从日宫${text(day?.name) || ''}起子时，顺数至${text(d.hourLabel) || ''}，落${text(hour.name) || ''}`
          : undefined,
      ],
      { unit: 'block', scope: { start: '起课过程：', end: '定位用途' } },
    ),
    fact('xiaoliuren.location', '定位用途：', [
      month ? `月宫${text(month.name)}` : undefined,
      day ? `日宫${text(day.name)}` : undefined,
      hour ? `时宫${text(hour.name)}` : undefined,
    ]),
    fact('xiaoliuren.primary', '占得宫：', [primary?.name]),
    fact('xiaoliuren.verse', '歌诀原文：', [primary?.verse]),
  ]);
}

function positionText(item: AnyRecord, fallback: string): string | undefined {
  const name = text(item.name) || fallback;
  const stem = text(item.stem);
  const branch = text(item.branch);
  const god = text(item.god);
  const element = text(item.element);
  const season = text(item.seasonState);
  return `${name}${stem || ''}${branch || ''}${god ? `乘${god}` : ''}${element ? `（${element}` : ''}${season ? `，月令${season}` : ''}${element || season ? '）' : ''}`;
}

function extractJinkoujueFacts(data: unknown): DivinationPromptFact[] {
  const d = record(data);
  if (!d) return [];
  const positions: AnyRecord = record(d.positions) || {};
  const use = record(d.yinYangUse);
  const movementItems = records(d.movements);
  const positionValues = [
    ['地分', record(positions.diFen)],
    ['将神', record(positions.jiangShen)],
    ['贵神', record(positions.guiShen)],
    ['人元', record(positions.renYuan)],
  ] as const;
  const fourPositionValues = positionValues.flatMap(([label, item]) => {
    if (!item) return [];
    const name = text(item.name) || label;
    const stem = text(item.stem);
    const branch = text(item.branch);
    const god = text(item.god);
    return [`${name}${stem || ''}${branch || ''}${god ? `乘${god}` : ''}`];
  });
  const positionLabel = (item: AnyRecord, fallback: string) => {
    const name = text(item.name) || fallback;
    const element = text(item.element);
    return `${name}${element || ''}`;
  };
  const relationPairs: Array<[string, string, string]> = [
    ['guiShen', 'jiangShen', text(record(d.relations)?.guiToJiang) || ''],
    ['guiShen', 'renYuan', text(record(d.relations)?.guiToRen) || ''],
    ['jiangShen', 'diFen', text(record(d.relations)?.jiangToDi) || ''],
    ['renYuan', 'diFen', text(record(d.relations)?.renToDi) || ''],
    ['guiShen', 'diFen', text(record(d.relations)?.guiToDi) || ''],
  ];
  const relationText = (fromKey: string, toKey: string, relation: string) => {
    const from = record(positions[fromKey]);
    const to = record(positions[toKey]);
    if (!from || !to) return undefined;
    const fromLabel = positionLabel(from, fromKey);
    const toLabel = positionLabel(to, toKey);
    if (relation === '被生') return `${toLabel}生${fromLabel}`;
    if (relation === '被克') return `${toLabel}克${fromLabel}`;
    if (relation === '比和') return `${fromLabel}与${toLabel}比和`;
    if (relation === '生' || relation === '克') return `${fromLabel}${relation}${toLabel}`;
    return `${fromLabel}对${toLabel}为${relation}`;
  };
  return collect([
    fact('jinkoujue.yinyang-use', '阴阳发用：', [
      text(use?.rule),
      use && text(use.usePosition) ? `发用位${text(use.usePosition)}` : undefined,
      use?.isVoid === true ? '旬空' : use ? '不空' : undefined,
    ]),
    fact('jinkoujue.four-positions', '四位：', fourPositionValues),
    fact('jinkoujue.movements', '五动三动：', [
      movementItems.length
        ? movementItems
            .map(
              (item) =>
                `${text(item.category) || ''}${text(item.name) || ''}（${text(item.trigger) || ''}）`,
            )
            .join('；')
        : '无',
    ]),
    fact(
      'jinkoujue.relations',
      '四位关系：',
      relationPairs.map(([from, to, relation]) => relationText(from, to, relation)),
    ),
  ]);
}

function extractTarotFacts(data: unknown): DivinationPromptFact[] {
  const d = record(data);
  if (!d) return [];
  const cards = records(d.cards);
  return collect([
    fact('tarot.core', '核心结构：', [`牌阵${text(d.spreadName)}`, `共${cards.length}张牌`]),
    cards.some((card) => card.reversed === true)
      ? fact('tarot.orientation', '正逆位口径：', ['逆位'])
      : null,
    ...cards.map((card, index) => {
      const position = text(card.position);
      const name = text(card.name);
      if (!position || !name) return null;
      return fact(
        `tarot.card.${index}`,
        `${position}：${name}`,
        [
          `${position}：${name}`,
          card.reversed === true ? '（逆位）' : '（正位）',
          join(card.keywords) ? `关键词：${join(card.keywords)}` : undefined,
          text(card.element) ? `牌组属性：${text(card.element)}` : undefined,
          text(card.archetype) ? `基础牌义：${text(card.archetype)}` : undefined,
        ],
        { scope: { start: '牌位明细：', end: '【任务】' } },
      );
    }),
  ]);
}

function extractLenormandFacts(data: unknown): DivinationPromptFact[] {
  const d = record(data);
  if (!d) return [];
  const cards = records(d.cards);
  const combinations = records(d.combinations);
  return collect([
    fact('lenormand.core', '核心结构：', [`牌阵${text(d.spreadName)}`, `共${cards.length}张牌`]),
    ...cards.map((card, index) => {
      const position = text(card.position);
      const name = text(card.name);
      if (!position || !name) return null;
      return fact(
        `lenormand.card.${index}`,
        `${position}：${name}`,
        [
          `${position}：${name}`,
          `关键词：${join(card.keywords) || '未列'}`,
          text(card.meaning) ? `基础牌义：${text(card.meaning)}` : undefined,
          text(card.house) ? `落${text(card.house)}宫` : undefined,
          card.row !== undefined && card.column !== undefined
            ? `第${text(card.row)}排第${text(card.column)}列`
            : undefined,
        ],
        { scope: { start: '牌位明细：', end: '【任务】' } },
      );
    }),
    ...combinations.flatMap((item, index) => {
      if (item.source !== '固定组合') return [];
      const card1 = text(item.card1);
      const card2 = text(item.card2);
      const pair = card1 && card2 ? `${card1}+${card2}` : undefined;
      return pair
        ? [
            fact(`lenormand.combination.${index}`, `${pair}：`, [item.meaning], {
              scope: { start: '固定组合：', end: '【任务】' },
            }),
          ]
        : [];
    }),
  ]);
}

function extractSsgwFacts(data: unknown): DivinationPromptFact[] {
  const d = record(data);
  if (!d) return [];
  const details: AnyRecord = record(d.details) || {};
  const poemLines = nonEmptyLines(d.poem);
  // 本签典故按签谱口径合并；跨签引用不属于本次签谱资料。
  const storyContent = resolveSsgwStoryContent(d as unknown as SsgwData);
  const stories = [storyContent.canonicalStory, storyContent.extraStory].filter(Boolean);
  return collect([
    fact('ssgw.number', '签号：', [text(d.number) ? `第${text(d.number)}签` : undefined]),
    fact('ssgw.title', '签题：', [d.title ? `《${text(d.title)}》` : undefined, text(d.title)]),
    fact('ssgw.poem', '签诗：', poemLines, {
      unit: 'block',
      scope: { start: '签诗：', end: '吉凶级别：' },
    }),
    fact('ssgw.fortune', '吉凶级别：', [details['吉凶']]),
    fact('ssgw.story', '典故：', stories, {
      unit: 'block',
      scope: { start: '典故：', end: '基础解签：' },
    }),
    fact(
      'ssgw.basic-interpretation',
      '基础解签：',
      [details['核心寓意'], details['解签'], details['签意'], details['解签总论']],
      { unit: 'block', scope: { start: '基础解签：' } },
    ),
  ]);
}

function extractAlmanacFacts(data: unknown): DivinationPromptFact[] {
  const d = record(data);
  if (!d) return [];
  const participants = records(d.participants);
  const days = records(d.days).sort((left, right) =>
    (text(left.date) || '').localeCompare(text(right.date) || ''),
  );
  const participantFacts = participants.flatMap((item, index) => {
    const pillars = record(item.pillars);
    const name = text(item.name);
    const gender = text(item.gender) || '性别未填';
    const pillarText = pillars
      ? `四柱${text(pillars.year)} ${text(pillars.month)} ${text(pillars.day)} ${text(pillars.hour)}`
      : undefined;
    return [
      fact(
        `almanac.participant.${index}`,
        name ? `${name}：${gender}` : '参与人资料：',
        [pillarText],
        { unit: 'line', scope: { start: '参与人资料：', end: '候选分类：' } },
      ),
    ];
  });
  const dayFacts = days.map((item, index) =>
    (() => {
      const date = text(item.date);
      const ganzhi = record(item.ganzhi);
      const yearGanzhi = text(ganzhi?.year);
      const monthGanzhi = text(ganzhi?.month);
      const dayGanzhi = text(ganzhi?.day);
      return fact(
        `almanac.day.${index}`,
        date ? `第${index + 1}日：${date}` : '候选日期明细：',
        [
          date,
          yearGanzhi && monthGanzhi && dayGanzhi
            ? `干支${yearGanzhi}/${monthGanzhi}/${dayGanzhi}`
            : undefined,
          text(item.dayOfficer) ? `建${text(item.dayOfficer)}` : undefined,
          text(item.twelveStar) ? `值神${text(item.twelveStar)}` : undefined,
        ],
        { unit: 'line', scope: { start: '候选日期明细：' } },
      );
    })(),
  );
  return collect([
    fact('almanac.core', '核心结构：', [
      `择日事项：${text(d.topicLabel)}`,
      `候选日期：${text(d.startDate)} 至 ${text(d.endDate)}`,
    ]),
    ...participantFacts,
    ...dayFacts,
  ]);
}

function extractBaZhaiFacts(data: unknown): DivinationPromptFact[] {
  const d = record(data);
  if (!d) return [];
  const lucky = records(d.luckyDirections);
  const unlucky = records(d.unluckyDirections);
  const mingPalace = records(d.mingPalace);
  const housePalace = records(d.housePalace);
  const direction = (item: AnyRecord) => {
    const name = firstText(item.direction, item.name);
    const label = firstText(item.label, item.fortune, item.type);
    return name ? `${name}${label ? `(${label})` : ''}` : undefined;
  };
  return collect([
    fact('bazhai.ming', '命卦：', [d.mingGua, d.mingGroup]),
    fact('bazhai.house', '宅卦：', [d.houseGua, d.houseGroup]),
    fact('bazhai.match', '命宅配合：', [d.match]),
    fact('bazhai.lucky', '四吉方：', lucky.map(direction)),
    fact('bazhai.unlucky', '四凶方：', unlucky.map(direction)),
    ...mingPalace.map((item, index) =>
      fact(
        `bazhai.ming-palace.${index}`,
        `${item.direction}${item.label}`,
        [item.luck, `约${item.degree}°`],
        { scope: { start: '命卦八方：', ...(housePalace.length ? { end: '宅卦八方：' } : {}) } },
      ),
    ),
    ...housePalace.map((item, index) =>
      fact(
        `bazhai.house-palace.${index}`,
        `${item.direction}${item.label}`,
        [item.luck, `约${item.degree}°`],
        { scope: { start: '宅卦八方：' } },
      ),
    ),
  ]);
}

function extractXuanKongFacts(data: unknown): DivinationPromptFact[] {
  const d = record(data);
  if (!d) return [];
  const period = record(d.period);
  const dao = record(d.daoShanXiang);
  const palaces = records(d.palaces);
  return collect([
    fact('xuankong.period', '运程：', [period?.label]),
    fact('xuankong.orientation', '山向：', [
      d.sitMountain && d.facingMountain
        ? `坐${text(d.sitMountain)}向${text(d.facingMountain)}`
        : undefined,
    ]),
    fact('xuankong.gua-type', '卦型：', [d.guaType, d.replacementReason]),
    fact('xuankong.formation', '局型：', [d.formation]),
    fact('xuankong.dao-shan-xiang', '到山到向：', [dao?.summary]),
    ...palaces.map((item, index) =>
      fact(
        `xuankong.palace.${index}`,
        `${item.name}（${item.direction}）`,
        [
          `运${item.yunStar}`,
          `山${item.shanStar}`,
          `向${item.xiangStar}`,
          ...(item.yearStar === undefined ? [] : [`年${item.yearStar}`]),
          ...(item.monthStar === undefined ? [] : [`月${item.monthStar}`]),
        ],
        { scope: { start: '三盘九宫：' } },
      ),
    ),
  ]);
}

function extractResidentialFacts(data: unknown): DivinationPromptFact[] {
  const d = record(data);
  if (!d) return [];
  const bazhai = record(d.bazhai);
  const xuankong = record(d.xuankong);
  const xuankongPeriod = record(xuankong?.period);
  const dao = record(xuankong?.daoShanXiang);
  return collect([
    fact('residential.orientation', '山向：', [d.orientationText]),
    fact('residential.house-year', '宅运年份：', [d.houseYear]),
    fact('residential.xuankong-summary', '玄空：', [
      xuankongPeriod?.label,
      xuankong?.sitMountain && xuankong?.facingMountain
        ? `坐${text(xuankong.sitMountain)}向${text(xuankong.facingMountain)}`
        : undefined,
      xuankong?.guaType,
      dao?.summary,
    ]),
    bazhai
      ? fact('residential.bazhai-summary', '八宅：', [bazhai.mingGua, bazhai.mingGroup])
      : null,
    ...(xuankong
      ? extractXuanKongFacts(xuankong).map((item) => ({ ...item, id: `residential.${item.id}` }))
      : []),
    ...(bazhai
      ? extractBaZhaiFacts(bazhai).map((item) => ({ ...item, id: `residential.${item.id}` }))
      : []),
  ]);
}

function extractTaiyiFacts(data: unknown): DivinationPromptFact[] {
  const d = record(data);
  if (!d) return [];
  const positionValues = [
    d.taiyiPosition ? `太乙在${text(d.taiyiPosition)}` : undefined,
    d.wenChangPosition ? `文昌（主目）在${text(d.wenChangPosition)}` : undefined,
    d.shiJiPosition ? `始击（客目）在${text(d.shiJiPosition)}` : undefined,
    d.jiShenPosition ? `计神在${text(d.jiShenPosition)}` : undefined,
  ];
  const generalValues = [
    d.lordGeneral !== undefined ? `主大将${text(d.lordGeneral)}` : undefined,
    d.lordAssistant !== undefined ? `主参将${text(d.lordAssistant)}` : undefined,
    d.guestGeneral !== undefined ? `客大将${text(d.guestGeneral)}` : undefined,
    d.guestAssistant !== undefined ? `客参将${text(d.guestAssistant)}` : undefined,
    d.setGeneral !== undefined ? `定大将${text(d.setGeneral)}` : undefined,
    d.setAssistant !== undefined ? `定参将${text(d.setAssistant)}` : undefined,
  ];
  const gods = records(d.sixteenGods).flatMap((item) => {
    const branch = text(item.branch);
    const god = text(item.god);
    return branch && god ? [`${branch}${god}`] : [];
  });
  return collect([
    fact('taiyi.cycle', '本计干支：', [d.ganZhi]),
    fact('taiyi.bureau', text(d.yinYang) || '局式：', [
      text(d.yinYang) ? `第${text(d.bureau)}局` : undefined,
      text(d.bureau),
    ]),
    fact('taiyi.core-palaces', '核心宫位：', positionValues),
    fact('taiyi.counts', '主客定算：', [
      d.lordCount !== undefined ? `主算${text(d.lordCount)}` : undefined,
      d.guestCount !== undefined ? `客算${text(d.guestCount)}` : undefined,
      d.setCount !== undefined ? `定算${text(d.setCount)}` : undefined,
    ]),
    fact('taiyi.generals', '将参：', generalValues),
    fact('taiyi.sixteen-gods', '十六神：', gods),
  ]);
}

function extractWuyunLiuqiFacts(data: unknown): DivinationPromptFact[] {
  const d = record(data);
  if (!d) return [];
  const input = record(d.input);
  const annualMovement = record(d.annualMovement);
  const sitian = record(d.sitian);
  const zaiquan = record(d.zaiquan);
  const movementSteps = records(d.movementSteps);
  const qiSteps = records(d.qiSteps);
  return collect([
    fact('wuyun.year', '年干支：', [
      input?.yearGanZhi,
      input?.year !== undefined ? `（公历 ${text(input.year)} 年）` : undefined,
    ]),
    fact('wuyun.annual-movement', '岁运：', [
      annualMovement?.name,
      annualMovement?.toneName,
      annualMovement?.strength,
      annualMovement?.yinYang ? `${text(annualMovement.yinYang)}干` : undefined,
    ]),
    fact('wuyun.sitian', '司天：', [sitian?.name]),
    fact('wuyun.zaiquan', '在泉：', [zaiquan?.name]),
    ...movementSteps.map((item, index) =>
      fact(
        `wuyun.movement.${index}`,
        `${item.order}. ${item.label}`,
        [
          `主运${text(record(item.hostMovement)?.toneName)}（${text(record(item.hostMovement)?.element)}）；客运${text(record(item.guestMovement)?.toneName)}（${text(record(item.guestMovement)?.element)}）`,
          record(item.hostGuestRelation)?.kind
            ? `主客关系${text(record(item.hostGuestRelation)?.kind)}`
            : undefined,
          ...(item.gregorianStart && item.gregorianEnd
            ? [`公历${item.gregorianStart}至${item.gregorianEnd}`]
            : []),
        ],
        { scope: { start: '五步主客运：', end: '六步主客气：' } },
      ),
    ),
    ...qiSteps.map((item, index) =>
      fact(
        `wuyun.qi.${index}`,
        `${item.order}. ${item.label}`,
        [
          `主气${text(record(item.hostQi)?.name)}；客气${text(record(item.guestQi)?.name)}`,
          record(item.hostGuestRelation)?.kind
            ? `主客关系${text(record(item.hostGuestRelation)?.kind)}`
            : undefined,
          ...(item.gregorianStart && item.gregorianEnd
            ? [`公历${item.gregorianStart}至${item.gregorianEnd}`]
            : []),
        ],
        { scope: { start: '六步主客气：' } },
      ),
    ),
  ]);
}

function extractHuangjiFacts(data: unknown): DivinationPromptFact[] {
  const d = record(data);
  if (!d) return [];
  const input = record(d.input);
  const forecast = record(d.forecast);
  const hexagrams = record(forecast?.hexagrams);
  const facts = collect(
    forecast
      ? [fact('huangji.target', '目标年份：', [input?.year, record(hexagrams?.annual)?.ganzhi])]
      : [
          fact('huangji.coordinate', '目标年坐标：', [input?.year]),
          fact('huangji.epoch-coordinate', '纪元年坐标：', [input?.epochYear]),
        ],
  );
  if (!forecast || !hexagrams) return facts;
  const layers: Array<[string, AnyRecord | null]> = [
    ['会内统卦：', record(hexagrams.governing)],
    ['运卦：', record(hexagrams.yun)],
    ['六十年统卦：', record(hexagrams.sixtyYear)],
    ['十年卦：', record(hexagrams.decade)],
    ['值年卦：', record(hexagrams.annual)],
  ];
  facts.push(
    ...collect(
      layers.map(([owner, layer]) =>
        fact(`huangji.layer.${owner}`, owner, [record(layer?.hexagram)?.name || layer?.name]),
      ),
    ),
  );
  return facts;
}

function extractZodiacFacts(data: unknown): DivinationPromptFact[] {
  const d = record(data);
  if (!d) return [];
  const elementRelation = record(d.elementRelation);
  const conflicts = records(d.conflicts);
  const conflictLabel: Record<string, string> = {
    值太岁: '同支',
    冲太岁: '相冲',
    刑太岁: '相刑',
    害太岁: '相害',
    破太岁: '相破',
  };
  const taiSuiValues = conflicts.length
    ? conflicts.map((item) => {
        const type = text(item.type) || '';
        const withBranch = text(item.with) || '';
        return `${type}（生肖年支${text(d.zodiacBranch) || ''}与流年年支${withBranch}${conflictLabel[type] || ''}）`;
      })
    : ['未命中值、冲、刑、害、破关系'];
  return collect([
    fact('zodiac.core', '参与关系的资料：', [
      d.zodiacBranch ? `出生年支${text(d.zodiacBranch)}` : undefined,
      d.yearGanZhi
        ? `目标流年年干${text(d.yearGanZhi)?.charAt(0)}、年支${text(d.yearBranch)}`
        : undefined,
    ]),
    fact('zodiac.summary', '五行关系：', [d.relation, elementRelation?.kind]),
    fact('zodiac.taisui', '太岁关系：', taiSuiValues),
  ]);
}

/** 采用稳定方法名的提取器，便于审计脚本按样本变量接线。 */
export const DIVINATION_FACT_EXTRACTORS: Readonly<Record<string, DivinationFactExtractor>> = {
  liuyao: extractLiuyaoFacts,
  meihua: extractMeihuaFacts,
  qimen: extractQimenFacts,
  'qimen-lifetime': extractQimenLifetimeFacts,
  liuren: extractLiurenFacts,
  xiaoliuren: extractXiaoliurenFacts,
  jinkoujue: extractJinkoujueFacts,
  tarot: extractTarotFacts,
  lenormand: extractLenormandFacts,
  ssgw: extractSsgwFacts,
  almanac: extractAlmanacFacts,
  bazhai: extractBaZhaiFacts,
  residential: extractResidentialFacts,
  xuankong: extractXuanKongFacts,
  taiyi: extractTaiyiFacts,
  'wuyun-liuqi': extractWuyunLiuqiFacts,
  huangji: extractHuangjiFacts,
  zodiac: extractZodiacFacts,
};

/** 页面标题、中文名称与审计方法名的映射；未知方法返回空清单。 */
export const DIVINATION_METHOD_ALIASES: Readonly<Record<string, string>> = {
  六爻: 'liuyao',
  '六爻（蓍草十八变）': 'liuyao',
  梅花易数: 'meihua',
  奇门遁甲: 'qimen',
  奇门终身局: 'qimen-lifetime',
  大六壬: 'liuren',
  小六壬: 'xiaoliuren',
  金口诀: 'jinkoujue',
  塔罗: 'tarot',
  塔罗牌: 'tarot',
  雷诺曼: 'lenormand',
  三山国王灵签: 'ssgw',
  签谱: 'ssgw',
  择日: 'almanac',
  黄历择日: 'almanac',
  八宅: 'bazhai',
  八宅风水: 'bazhai',
  住宅: 'residential',
  住宅风水: 'residential',
  玄空: 'xuankong',
  玄空飞星: 'xuankong',
  太乙: 'taiyi',
  太乙神数: 'taiyi',
  皇极: 'huangji',
  皇极经世: 'huangji',
  五运六气: 'wuyun-liuqi',
  生肖: 'zodiac',
  生肖流年: 'zodiac',
};

export function resolveDivinationFactMethod(method: string): string {
  const normalized = method.trim();
  return DIVINATION_METHOD_ALIASES[normalized] || normalized;
}

export function extractDivinationPromptFacts(
  method: string,
  data: unknown,
): DivinationPromptFact[] {
  const key = resolveDivinationFactMethod(method);
  return DIVINATION_FACT_EXTRACTORS[key]?.(data) ?? [];
}

export {
  extractAlmanacFacts,
  extractBaZhaiFacts,
  extractHuangjiFacts,
  extractJinkoujueFacts,
  extractLenormandFacts,
  extractLiurenFacts,
  extractLiuyaoFacts,
  extractMeihuaFacts,
  extractQimenFacts,
  extractQimenLifetimeFacts,
  extractResidentialFacts,
  extractSsgwFacts,
  extractTaiyiFacts,
  extractTarotFacts,
  extractWuyunLiuqiFacts,
  extractXiaoliurenFacts,
  extractXuanKongFacts,
  extractZodiacFacts,
};
