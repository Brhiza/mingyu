import type { z } from 'zod';
import type { residentialInput } from '../schema';
import { sameJsonValue } from '../json-value';
import { formatSchoolGuidance, type SchoolGuidanceEntry } from '../prompt-selection';
import { dedupeExcerpts, formatClassicExcerpts, selectBazhaiClassics, selectXuankongClassics } from './classics';
import { bazhai } from './bazhai';
import { xuankong } from './xuankong';
import { measureSitDirection, mountainTrigram, mountains } from './compass';
import { bazhaiPalaces, starPalaceRelations } from './bazhai/foundation';
import { buildMethodSituationDigest } from './situation-digest';

type Input = z.infer<typeof residentialInput>;
type Source = Pick<Input, 'person' | 'orientation' | 'construction' | 'mode' | 'confirmJianXiang' | 'flow'>;
const schoolGuidance: Record<'bazhaimingjing' | 'shenshi' | 'hecan', SchoolGuidanceEntry> = {
  bazhaimingjing: { label: '八宅明镜', task: '以八宅人宅适配为主线，优先对照命卦与宅卦的东四西四及八方游年吉凶。', basis: '《八宅明镜》游年翻卦与人宅相配' },
  shenshi: { label: '沈氏玄空', task: '以玄空宅运、山向飞星与当令旺衰为主线，核对各宫挨星与流年引动。', basis: '《沈氏玄空学》宅运与飞星格局' },
  hecan: { label: '八宅玄空合参', task: '将八宅人宅适配与玄空宅运飞星同宫并列对照，分辨共同关注点与口径差异。', basis: '八宅人宅层与玄空宅运层同宫分层对照' },
};
type BazhaiData = ReturnType<typeof bazhai>['data'];
type XuanKongData = ReturnType<typeof xuankong>['data'];
type MeasurementData = ReturnType<typeof measureSitDirection>;
type XuankongStatus = '已排盘' | '缺少山向' | '缺少建造年或起运年';

export interface ResidentialAgreement {
  level: '一致关注' | '可互补' | '资料不足' | '口径不同需分述';
  title: string;
  detail: string;
}

function buildAgreements(params: {
  bazhaiData: BazhaiData | null;
  xuanData: XuanKongData | null;
  measurement: MeasurementData | null;
  xuankongStatus: XuankongStatus;
  northReferenceUnspecified: boolean;
}): ResidentialAgreement[] {
  const { bazhaiData, xuanData, measurement, xuankongStatus, northReferenceUnspecified } = params;
  const items: ResidentialAgreement[] = [];
  if (!bazhaiData && !xuanData) {
    return [{ level: '资料不足', title: '缺少可用资料', detail: '至少提供山向或居住人信息之一，才能形成住宅风水结果。' }];
  }
  if (bazhaiData && !xuanData) {
    items.push({
      level: '资料不足',
      title: '仅完成八宅人宅层',
      detail: xuankongStatus === '缺少建造年或起运年'
        ? '已有命卦与山向资料，但缺少住宅建造年或起运年，暂不排玄空宅运盘。'
        : '已有命卦方位，但缺少明确山向，暂不能排玄空宅运盘。',
    });
  }
  if (!bazhaiData && xuanData) {
    items.push({
      level: '资料不足',
      title: '仅完成玄空宅运层',
      detail: '已有山向与运盘，但未提供居住人出生年性别或命卦，暂不做八宅人宅适配。',
    });
  }
  if (bazhaiData && xuanData) {
    const xuankongBoundarySensitive = (xuanData.measurement?.candidates.length ?? 0) > 1;
    const houseBoundarySensitive = measurement?.stability === '宅卦不稳定';
    const birthBoundarySensitive = bazhaiData.birth?.status === '交界双候选';
    const periodBoundarySensitive = xuanData.periodBoundary === '交界双候选';
    const firstChart = xuanData.charts[0];
    const periodLabel = `${periodBoundarySensitive ? '暂按' : ''}${firstChart.period.yuan}${firstChart.period.yun}运（${firstChart.period.startYear}–${firstChart.period.endYear}）`;
    const formationSummary = [...new Set(xuanData.charts.map((chart) => chart.formation))].join(' / ');
    const mingGuas = [...new Set(bazhaiData.persons.map((person) => person.gua))].join('或');
    const candidateMatches = new Set(bazhaiData.comparisons.map((item) => item.match));
    const matchChangesWithOrientation = candidateMatches.size > 1;
    const singleMatch = [...candidateMatches][0];

    items.push({
      level: '可互补',
      title: '宅运与人宅分层并观',
      detail: `玄空见${periodLabel}、${northReferenceUnspecified ? '按原始读数暂列的' : ''}${formationSummary}${xuankongBoundarySensitive ? '（中心读数盘，待复测核定）' : ''}；八宅${birthBoundarySensitive ? '暂按' : ''}命卦${mingGuas}、${birthBoundarySensitive || northReferenceUnspecified ? '暂按' : ''}${matchChangesWithOrientation ? `候选命宅关系${[...candidateMatches].join('或')}` : `命宅关系${singleMatch}`}。宅运结构与人宅适配分层并列。`,
    });

    if (matchChangesWithOrientation) {
      items.push({
        level: '资料不足',
        title: '命宅关系随候选坐向变化',
        detail: `${northReferenceUnspecified ? '按原始读数暂列：' : ''}测量误差范围内，${bazhaiData.comparisons.map((item) => `${item.sitMountain}山${item.houseGua}宅命宅${item.match}`).join('、')}；需${northReferenceUnspecified ? '核定北向基准并' : ''}复测坐向后确定命宅关系。`,
      });
    } else if (!xuankongBoundarySensitive && !northReferenceUnspecified && !birthBoundarySensitive && !periodBoundarySensitive) {
      items.push(
        singleMatch === '同组'
          ? { level: '一致关注', title: '命宅同组可提高关注优先级', detail: '八宅显示命宅同组，与玄空中的山向、当运结构并列作为关注资料。' }
          : { level: '口径不同需分述', title: '命宅不同组需分开说明', detail: '八宅显示命宅异组，个人吉方与住宅山向结构分列。' },
      );
    }

    if (xuankongBoundarySensitive) {
      items.push({
        level: '资料不足',
        title: houseBoundarySensitive ? '山向与宅卦边界仍敏感' : '山向边界仍敏感',
        detail: houseBoundarySensitive ? '测量误差范围内的候选山向与宅卦一并列出。' : '测量误差范围内的候选山向已列出，宅卦仍属同一卦。',
      });
    }
  }
  return items;
}

function buildAdvice(params: {
  bazhaiData: BazhaiData | null;
  xuanData: XuanKongData | null;
  measurement: MeasurementData | null;
  agreements: ResidentialAgreement[];
  xuankongStatus: XuankongStatus;
  northReferenceUnspecified: boolean;
}): string[] {
  const { bazhaiData, xuanData, measurement, agreements, xuankongStatus, northReferenceUnspecified } = params;
  const advice: string[] = [];
  if (xuanData) {
    const firstChart = xuanData.charts[0];
    const periodBoundarySensitive = xuanData.periodBoundary === '交界双候选';
    const xuankongBoundarySensitive = (xuanData.measurement?.candidates.length ?? 0) > 1;
    const formationSummary = [...new Set(xuanData.charts.map((chart) => chart.formation))].join(' / ');
    advice.push(
      `先看宅运：${periodBoundarySensitive ? '暂按' : ''}${firstChart.period.yuan}${firstChart.period.yun}运（${firstChart.period.startYear}–${firstChart.period.endYear}），坐${firstChart.sitMountain}向${firstChart.facingMountain}，${firstChart.mode}，${formationSummary}${xuankongBoundarySensitive ? '（中心读数盘，待复测核定）' : ''}${northReferenceUnspecified ? '（坐向按原始读数暂列）' : ''}${periodBoundarySensitive ? '；需按建造或起运日期核定运期' : ''}。`,
    );
  }
  if (bazhaiData) {
    const birthBoundarySensitive = bazhaiData.birth?.status === '交界双候选';
    const candidateMatches = new Set(bazhaiData.comparisons.map((item) => item.match));
    const matchText = bazhaiData.comparisons.length
      ? candidateMatches.size > 1
        ? `候选命宅关系${[...candidateMatches].join('或')}`
        : `命宅关系${[...candidateMatches][0]}`
      : '未提供住宅坐向，暂不计算命宅关系';
    const mingText = bazhaiData.persons.map((person) => `${person.gua}（${person.group}）`).join('、');
    const lucky = (bazhaiData.mingPalaces[0]?.palaces ?? [])
      .filter((item) => item.luck === '吉')
      .slice(0, 4)
      .map((item) => `${item.direction}${item.label}`)
      .join('、');
    advice.push(
      `再看人宅：${birthBoundarySensitive ? '暂按' : ''}命卦${mingText}，${birthBoundarySensitive || northReferenceUnspecified ? '暂按' : ''}${matchText}${lucky ? `；命卦较利方位可参考 ${lucky}` : ''}。`,
    );
    if (birthBoundarySensitive) {
      advice.push('补充出生月日或准确出生时刻后复核命卦与个人方位。');
    }
  }
  if (agreements.some((item) => item.level === '口径不同需分述')) {
    advice.push('两边有分歧时，分别保留宅运结构与个人方位依据，不硬统一成一个总分。');
  }
  if (northReferenceUnspecified) {
    advice.push('请核定坐向读数的北向基准；若采用磁北，还需提供当地磁偏角，再复核宅卦、命宅关系与宅运盘。');
  }
  if (agreements.some((item) => item.level === '资料不足')) {
    const houseBoundarySensitive = measurement?.stability === '宅卦不稳定';
    advice.push(
      xuankongStatus === '缺少建造年或起运年'
        ? '请先补充住宅建造年或起运年，再排玄空宅运盘并讨论具体布局。'
        : bazhaiData && xuanData
          ? houseBoundarySensitive
            ? '请复测坐向，核定候选山向与宅卦后再讨论具体布局。'
            : '请复测坐向，核定候选山向后再讨论具体布局。'
          : '资料不足处先补山向或居住人信息，再做更细的布局讨论。',
    );
  }
  if (!advice.length) {
    advice.push('请补充山向或居住人信息后重新排盘。');
  }
  return advice;
}

function calculateData(source: Source) {
  const input = { ...(source.person ? { person: source.person } : {}), ...(source.orientation ? { orientation: source.orientation } : {}),
    ...(source.construction ? { construction: source.construction } : {}), ...(source.mode ? { mode: source.mode } : {}),
    ...(source.confirmJianXiang !== undefined ? { confirmJianXiang: source.confirmJianXiang } : {}), ...(source.flow ? { flow: source.flow } : {}) };
  if (!input.person && !input.orientation) throw new Error('须提供居住人资料或住宅坐向。');
  if (input.construction && !input.orientation) throw new Error('提供建造或起运年份时还需住宅坐向。');
  if ((input.mode !== undefined || input.confirmJianXiang !== undefined || input.flow !== undefined) && (!input.construction || !input.orientation)) throw new Error('玄空起法或流年流月需要建造年份及住宅坐向。');
  const orientation = input.orientation;
  const degree = orientation?.kind === 'degree' ? (orientation.reading === 'facing' ? (orientation.degree + 180) % 360 : orientation.degree) : undefined;
  const measurement = orientation?.kind === 'degree' ? measureSitDirection({ ...orientation, degree: degree! }) : null;
  const houses = orientation?.kind === 'mountain' ? (() => { const sitMountain = orientation.sitMountain, houseGua = mountainTrigram(sitMountain); return [{ sitMountain, facingMountain: mountains[(mountains.indexOf(sitMountain) + 12) % 24], houseGua }]; })()
    : measurement?.candidates ?? [];
  const house = orientation?.kind === 'mountain' ? { kind: 'mountain' as const, sitMountain: orientation.sitMountain }
    : orientation?.kind === 'degree' ? { kind: 'measurement' as const, reading: 'sit' as const, degree: degree!,
      ...(orientation.northReference !== undefined ? { northReference: orientation.northReference } : {}),
      ...(orientation.magneticDeclinationDegrees !== undefined ? { magneticDeclinationDegrees: orientation.magneticDeclinationDegrees } : {}),
      ...(orientation.uncertaintyDegrees !== undefined ? { uncertaintyDegrees: orientation.uncertaintyDegrees } : {}) } : undefined;
  const xuanOrientation = orientation?.kind === 'mountain' ? { kind: 'mountain' as const, sitMountain: orientation.sitMountain }
    : orientation?.kind === 'degree' ? { ...orientation, reading: orientation.reading === 'facing' ? 'facing' as const : 'sit' as const } : undefined;
  const bazhaiResult = input.person ? bazhai({ question: '住宅资料', person: input.person, ...(house ? { house } : {}) }) : null;
  const xuanResult = input.construction && xuanOrientation ? xuankong({ question: '住宅资料', construction: input.construction, orientation: xuanOrientation, mode: input.mode, confirmJianXiang: input.confirmJianXiang, flow: input.flow }) : null;
  const links = bazhaiResult && xuanResult ? bazhaiResult.data.comparisons.flatMap((person) => xuanResult.data.charts.flatMap((chart, chartIndex) => {
    if (chart.sitMountain !== person.sitMountain) return [];
    const directions = person.directions.map((direction) => {
      const palace = chart.palaces.find((item) => item.direction === direction.direction);
      if (!palace) throw new Error(`无法对齐八宅与玄空的${direction.direction}方。`);
      return {
        direction: direction.direction, gua: direction.gua, ming: direction.ming, house: direction.house,
        yunStar: palace.period, shanStar: palace.mountain, xiangStar: palace.water,
        ...(palace.yearStar !== undefined ? { yearStar: palace.yearStar } : {}),
        ...(palace.monthStar !== undefined ? { monthStar: palace.monthStar } : {}),
        ...(palace.dayStar !== undefined ? { dayStar: palace.dayStar } : {}),
        ...(palace.hourStar !== undefined ? { hourStar: palace.hourStar } : {}),
      };
    });
    return [{ personYear: person.year, mingGua: person.mingGua, sitMountain: person.sitMountain, houseGua: person.houseGua, mingHouseMatch: person.match,
      xuanChartIndex: chartIndex, yun: chart.period.yun, xuanFormation: chart.formation, directions }];
  })) : [];
  const bazhaiData = bazhaiResult?.data ?? null;
  const xuanData = xuanResult?.data ?? null;
  const xuankongStatus: XuankongStatus = xuanData ? '已排盘' : houses.length > 0 ? '缺少建造年或起运年' : '缺少山向';
  const northReferenceUnspecified = orientation?.kind === 'degree' && (orientation.northReference ?? 'unspecified') === 'unspecified';
  const agreements = buildAgreements({ bazhaiData, xuanData, measurement, xuankongStatus, northReferenceUnspecified });
  const advice = buildAdvice({ bazhaiData, xuanData, measurement, agreements, xuankongStatus, northReferenceUnspecified });
  return { data: { input, measurement, houses, housePalaces: houses.map((house) => ({ sitMountain: house.sitMountain, houseGua: house.houseGua, palaces: bazhaiPalaces(house.houseGua), starPalaces: starPalaceRelations(house.houseGua) })),
    bazhai: bazhaiData, xuankong: xuanData, links, agreements, advice,
    limitations: ['两套体系分别保留规则与证据，不生成综合吉凶总分。', '未提供建造或起运年份时不排玄空；形峦、实地状况和完整专业规则未涵盖。'] }, bazhaiResult, xuanResult };
}
type Calculation = ReturnType<typeof calculateData>;
const BAZHAI_LUCKY = new Set(['生气', '延年', '天医', '伏位']);
const XK_SHA_PAIRS: Record<string, string> = {
  '25': '二五交加', '52': '五二交加', '59': '五九毒煞', '95': '九五毒煞',
  '23': '二三斗牛煞', '32': '三二斗牛煞', '37': '三七穿途', '73': '七三穿途',
  '67': '六七交剑煞', '76': '七六交剑煞', '79': '七九火煞', '97': '九七火煞',
};

function isXkGoodStar(star: number, yun: number): boolean {
  const next1 = (yun % 9) + 1;
  const next2 = ((yun + 1) % 9) + 1;
  return star === yun || (star === next1 && star !== 5) || (star === next2 && star !== 5);
}

function buildResidentialPatternRelations(data: Calculation['data']): string {
  if (!data.links.length) {
    return '缺少居住人命卦、住宅坐向或建造年份之一，暂仅具备单层结果，待补齐双层资料后可输出八宅×玄空叠合制衡关系。';
  }
  const lines: string[] = [];
  for (const link of data.links) {
    const yun = link.yun;
    const header = `命卦${link.mingGua}${link.personYear === null ? '' : `（${link.personYear}年）`} × ${link.sitMountain}山${link.houseGua}宅（八宅${link.mingHouseMatch}｜玄空${yun}运${link.xuanFormation}）`;
    const stackedGood: string[] = [];
    const conflicts: string[] = [];
    const fiveTwoSuppressions: string[] = [];
    const remedies = new Set<string>();

    for (const d of link.directions) {
      const mingLucky = BAZHAI_LUCKY.has(d.ming);
      const houseLucky = BAZHAI_LUCKY.has(d.house);
      const anyBazhaiLucky = mingLucky || houseLucky;
      const bothBazhaiLucky = mingLucky && houseLucky;
      const anyBazhaiBad = !mingLucky || !houseLucky;
      const xkGood = isXkGoodStar(d.shanStar, yun) || isXkGoodStar(d.xiangStar, yun);
      const pairKey = `${d.shanStar}${d.xiangStar}`;
      const shaPair = XK_SHA_PAIRS[pairKey];
      const hasFive = (d.shanStar === 5 && yun !== 5) || (d.xiangStar === 5 && yun !== 5) || d.yearStar === 5;
      const hasTwo = (d.shanStar === 2 && yun !== 2) || (d.xiangStar === 2 && yun !== 2) || d.yearStar === 2;
      const hasHardSha = hasFive || (hasTwo && yun !== 9) || Boolean(shaPair);

      if (anyBazhaiLucky && xkGood && !hasHardSha) {
        const bazhaiTag = bothBazhaiLucky ? `命${d.ming}/宅${d.house}双吉` : mingLucky ? `命${d.ming}吉（宅${d.house}）` : `宅${d.house}吉（命${d.ming}）`;
        const xkTags = [
          isXkGoodStar(d.shanStar, yun) ? `山${d.shanStar}` : '',
          isXkGoodStar(d.xiangStar, yun) ? `向${d.xiangStar}` : '',
        ].filter(Boolean).join('+');
        stackedGood.push(`${d.direction}方（${bazhaiTag}＋玄空${xkTags}当令旺生）`);
      }

      if (anyBazhaiLucky && hasHardSha) {
        const shaReasons = [
          hasFive ? '五黄煞' : '',
          hasTwo && yun !== 9 ? '二黑病符' : '',
          shaPair ?? '',
        ].filter(Boolean).join('、');
        conflicts.push(`${d.direction}方［八宅吉（命${d.ming}/宅${d.house}）受玄空${shaReasons}压制］：须先化煞再启用`);
      } else if (!anyBazhaiLucky && xkGood) {
        const xkTags = [
          isXkGoodStar(d.shanStar, yun) ? `山${d.shanStar}` : '',
          isXkGoodStar(d.xiangStar, yun) ? `向${d.xiangStar}` : '',
        ].filter(Boolean).join('+');
        conflicts.push(`${d.direction}方［玄空${xkTags}旺生但八宅命${d.ming}/宅${d.house}双凶］：宜动静分层（可作通明纳气，避作命主长期卧床）`);
      } else if (anyBazhaiLucky && anyBazhaiBad && xkGood && !hasHardSha) {
        conflicts.push(`${d.direction}方［人宅异组冲突：命${d.ming}/宅${d.house}，玄空山${d.shanStar}向${d.xiangStar}旺生］：外局从宅、床桌从命`);
      }

      if (hasFive || hasTwo) {
        const starsText = [
          d.shanStar === 5 && yun !== 5 ? '山五黄' : '',
          d.xiangStar === 5 && yun !== 5 ? '向五黄' : '',
          d.yearStar === 5 ? '年五黄' : '',
          d.shanStar === 2 && yun !== 2 ? `山二黑${yun === 9 ? '(进气防病气)' : ''}` : '',
          d.xiangStar === 2 && yun !== 2 ? `向二黑${yun === 9 ? '(进气防病气)' : ''}` : '',
          d.yearStar === 2 ? '年二黑' : '',
        ].filter(Boolean).join('+');
        const bazhaiState = !mingLucky && !houseLucky
          ? `叠八宅双凶（命${d.ming}/宅${d.house}）凶上加凶，宜静压设储物/卫浴、忌动土`
          : anyBazhaiLucky
            ? `压制八宅吉位（命${d.ming}/宅${d.house}），先以金泄土化煞再使用`
            : `命${d.ming}/宅${d.house}，宜静置减动`;
        const extraCombo = (pairKey === '25' || pairKey === '52' || pairKey === '59' || pairKey === '95') ? `［${XK_SHA_PAIRS[pairKey]}高危］` : '';
        fiveTwoSuppressions.push(`${d.direction}方（${starsText}${extraCombo}；${bazhaiState}）`);
        remedies.add('五黄/二黑土煞化解：以金属器物/铜铃/素白金气泄耗土煞，严忌红黄火土色、明火及动土修造');
      }
      if (pairKey === '23' || pairKey === '32') remedies.add('二三斗牛煞化解：以暖光/红色火气通关泄木生土');
      if (pairKey === '37' || pairKey === '73' || pairKey === '67' || pairKey === '76') remedies.add('三七/六七金木相战化解：以静水/黑蓝色水气通关泄金');
      if (pairKey === '79' || pairKey === '97') remedies.add('七九火煞化解：以陶瓷/米黄色土气通关泄火生金');
    }

    lines.push(`${header}`);
    lines.push(`- 同向叠加吉位：${stackedGood.join('；') || '无八宅与玄空同向纯净吉位'}。`);
    lines.push(`- 冲突争议位：${conflicts.join('；') || '未见显著跨体系冲突位'}。`);
    lines.push(`- 五黄二黑压制位：${fiveTwoSuppressions.join('；') || '八方未见非当运五黄二黑落宫'}。`);
    if (remedies.size) {
      lines.push(`- 化解路径：${[...remedies].join('；')}。`);
    }
  }
  return lines.join('\n');
}

function render(result: Calculation, question: string, options?: Input['prompt']) {
  const { data, bazhaiResult, xuanResult } = result;
  const palaceText = data.housePalaces.map((house) => `${house.sitMountain}山${house.houseGua}宅：${house.starPalaces.map((p) => `${p.direction}${p.gua}宫${p.palaceElement}，${p.label}${p.star}${p.starElement}，${p.relation}`).join('；')}（伏位取左辅木）`);
  const links = data.links.map((link) => `命卦${link.mingGua}${link.personYear === null ? '' : `（${link.personYear}年）`}、${link.sitMountain}山${link.houseGua}宅：八宅${link.mingHouseMatch}；玄空${link.yun}运、${link.xuanFormation}（候选盘${link.xuanChartIndex + 1}）。\n${link.directions.map((p) => `${p.direction}方：命${p.ming}、宅${p.house}；运${p.yunStar}、山${p.shanStar}、向${p.xiangStar}${p.yearStar !== undefined ? `、年${p.yearStar}` : ''}${p.monthStar !== undefined ? `、月${p.monthStar}` : ''}${p.dayStar !== undefined ? `、日${p.dayStar}` : ''}${p.hourStar !== undefined ? `、时${p.hourStar}` : ''}`).join('；')}`);
  const orientation = data.input.orientation;
  const directionInput = orientation?.kind === 'degree' ? `【输入与方位换算】\n原始读数${orientation.degree}°，来源${orientation.reading === 'facing' ? '住宅朝向' : orientation.reading === 'sit' ? '住宅坐山' : '大门朝屋内'}。${orientation.reading === 'facing' ? '八宅层使用加 180° 的坐山读数，再按北向基准修正。' : '该读数按坐山方向处理，并按北向基准修正。'}` : '';
  const schools = formatSchoolGuidance(options?.schools, schoolGuidance);
  const classics = options?.includeClassics
    ? formatClassicExcerpts(dedupeExcerpts([
      ...selectBazhaiClassics([
        ...data.housePalaces.flatMap((house) => house.starPalaces.map((p) => p.label)),
        ...(data.bazhai?.mingPalaces.flatMap((person) => person.palaces.map((p) => p.label)) ?? []),
      ]),
      ...selectXuankongClassics(
        data.xuankong?.charts.flatMap((chart) =>
          chart.palaces.flatMap((p) => [p.period, p.mountain, p.water, p.yearStar, p.monthStar, p.dayStar, p.hourStar].filter((n): n is number => typeof n === 'number')),
        ) ?? [],
      ),
    ]))
    : '';
  const text = [
    '【阳宅风水】\n八宅与玄空分开计算，仅按相同坐山连接；多个候选须分别分析。',
    directionInput,
    bazhaiResult ? bazhaiResult.prompt.text.split(/【(?:任务与限制|限制与任务|问题)】/u)[0].trim() : `【八宅宅卦】\n${palaceText.join('\n') || '缺少住宅坐向，未计算宅卦。'}\n未提供居住人命卦，不计算命宅适配。`,
    xuanResult ? xuanResult.prompt.text.split(/【(?:任务与限制|限制与任务|问题)】/u)[0].trim() : `【玄空】\n${data.input.construction ? '缺少住宅坐向，未排盘。' : '未提供建造或起运年份，未排盘。'}`,
    `【同一坐山的分层对照】\n${links.join('\n') || '缺少居住人资料、住宅坐向或建造年份，无法同时列出两层对照。'}`,
    `【方位格局与理气制衡关系】\n${buildResidentialPatternRelations(data)}`,
    `【合参要点】\n${data.agreements.map((item) => `[${item.level}] ${item.title}：${item.detail}`).join('\n')}`,
    `【勘察建议】\n${data.advice.map((item, index) => `${index + 1}. ${item}`).join('\n')}`,
    schools,
    classics,
    (() => {
      const digest = buildMethodSituationDigest('residential', data, question);
      return digest.length ? `【局势要点】\n${digest.join('\n')}` : '';
    })(),
    `【限制与任务】\n${data.limitations.join('\n')} 结合问题和实际布局分别解释两套资料，不将一套判断直接替换为另一套。`,
    `【问题】\n${question}`,
  ].filter(Boolean).join('\n\n');
  return { text };
}
export function residential(input: Input) {
  const result = calculateData(input);
  return { data: result.data, summary: { title: '阳宅风水', lines: [`坐山候选：${result.data.houses.length}`, `八宅：${result.data.bazhai ? '已计算' : '未提供居住人资料'}`, `玄空：${result.data.xuankong ? '已计算' : '未计算'}`] }, prompt: render(result, input.question, input.prompt) };
}
export function promptForSavedResidential(data: unknown, source: Source, question: string, options?: Input['prompt']) {
  const expected = calculateData(source);
  if (!sameJsonValue(data, expected.data)) throw new Error('住宅风水结果与原始资料不一致。');
  return render(expected, question, options);
}
