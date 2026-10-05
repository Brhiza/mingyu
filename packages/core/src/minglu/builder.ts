/**
 * @file 命录全息聚合器 (Minglu Article Builder)
 * @description 将八字、紫微、占星、风水及跨术数盘面资料整合成具备全量目录、交叉索引与百科词典的 MingluArticle。
 */

import type {
  BuildMingluOptions,
  MingluArticle,
  MingluCrossLink,
  MingluCrossSynthesisThemeData,
  MingluMetadata,
  MingluTOCItem,
} from './types';
import type { Wuxing } from '../bazi';
import { SolarDay } from 'tyme4ts';
import {
  buildBeginnerGuide,
  buildEnhancedFiveElementsSection,
  buildEnhancedInteractions,
  buildEnhancedLifeStagesSection,
  buildEnhancedLuckChronicleSection,
  buildEnhancedPatternUsefulGodSection,
  buildEnhancedPillarsSection,
  buildEnhancedShenShaSection,
  buildEnhancedTenGodsSection,
} from './bazi-enhancer';
import { buildEnhancedZiweiSection } from './ziwei-enhancer';
import { buildEnhancedAstrolabeSection } from './astrolabe-enhancer';
import { getBaZhaiPalace, type BaZhaiLabel } from '../direction';
import { getMingluGlossaryEntries } from './glossary-data';

export function buildMingluArticle(options: BuildMingluOptions): MingluArticle {
  const { person, baziResult, ziweiRuntime, astrolabeData } = options;
  const glossary = getMingluGlossaryEntries();
  const unknownTime = baziResult.isThreePillars === true;
  const unknownTimeNotice =
    baziResult.unknownTimeAnalysis?.summary ||
    '出生时辰待补充；旺衰、格局、喜忌与岁运须在出生时分确定后再判。';
  const knownPillars = (['year', 'month', 'day'] as const)
    .filter((key) => baziResult.pillars[key].ganZhi)
    .map(
      (key) =>
        `${{ year: '年柱', month: '月柱', day: '日柱' }[key]}${baziResult.pillars[key].ganZhi}`,
    );
  const knownPillarFocus = knownPillars.length ? '八字已确定柱' : '八字候选柱';
  const transformation = baziResult.analysis.mingGe.transformation;

  // 1. 基础八字全量增强
  const pillarsSection = buildEnhancedPillarsSection(baziResult);
  const fiveElementsSection = buildEnhancedFiveElementsSection(baziResult);
  const patternUsefulGodSection = buildEnhancedPatternUsefulGodSection(baziResult);
  const interactionsSection = buildEnhancedInteractions(baziResult);
  const shenShaSection = buildEnhancedShenShaSection(baziResult);
  const tenGodsSection = buildEnhancedTenGodsSection(baziResult);
  const lifeStagesSection = buildEnhancedLifeStagesSection(baziResult);
  const luckChronicleSection = buildEnhancedLuckChronicleSection(baziResult);

  // 2. 可选紫微增强
  const ziweiSection = ziweiRuntime ? buildEnhancedZiweiSection(ziweiRuntime) : undefined;

  // 3. 可选占星增强
  const astrolabeSection = astrolabeData ? buildEnhancedAstrolabeSection(astrolabeData) : undefined;
  const dominantElementCount = astrolabeSection
    ? Math.max(...Object.values(astrolabeSection.distributions.elements).map((item) => item.count))
    : 0;
  const careerAstrolabeEvidence = astrolabeSection
    ? [
        ...astrolabeSection.angles
          .filter((angle) => angle.name === 'Midheaven')
          .map((angle) => `天顶位于${angle.sign}`),
        ...astrolabeSection.houses
          .filter((house) => house.house === 2 || house.house === 10)
          .map((house) => `第${house.house}宫宫头位于${house.sign}`),
      ]
    : [];

  // 4. 可选风水数据
  let fengshuiSection = undefined;
  if (baziResult.mingGua) {
    const mg = baziResult.mingGua;
    // 逐卦取公共八宅大游年表，避免按东四/西四分组固定方位而丢失具体命卦
    const palaces = getBaZhaiPalace(mg.gua);
    const pickDirection = (label: BaZhaiLabel): string => {
      const palace = palaces.find((item) => item.label === label);
      if (!palace) {
        throw new Error(`命卦${mg.gua}大游年缺少${label}宫`);
      }
      return palace.direction;
    };
    fengshuiSection = {
      mingGua: {
        gua: mg.gua,
        number: mg.number,
        eastWest: mg.eastWest,
        wuxing: mg.element,
        beneficialDirections: [
          {
            name: '生气方',
            direction: pickDirection('生气'),
            desc: '大吉，生机勃勃，利于官运与进取',
          },
          { name: '延年方', direction: pickDirection('延年'), desc: '中吉，健康延年，家庭和睦' },
          { name: '天医方', direction: pickDirection('天医'), desc: '次吉，贵人相助，病除身健' },
          { name: '伏位方', direction: pickDirection('伏位'), desc: '小吉，安稳从容，修身养性' },
        ],
        unfavorableDirections: [
          { name: '绝命方', direction: pickDirection('绝命'), desc: '大凶，宜避开床头与主要气口' },
          { name: '五鬼方', direction: pickDirection('五鬼'), desc: '次凶，防口舌是非与火燥' },
          { name: '六煞方', direction: pickDirection('六煞'), desc: '中凶，多思多虑，慎重决策' },
          { name: '祸害方', direction: pickDirection('祸害'), desc: '小凶，避免杂乱与堆放重物' },
        ],
      },
      yuanYun: {
        currentYun: 9,
        yunName: '下元九运·离火运',
        wuxing: '火',
        period: '2024年 - 2043年',
      },
    };
  }

  // 5. 跨术数盘面资料
  const crossSynthesisSection: MingluCrossSynthesisThemeData[] = [
    {
      themeId: 'temperament',
      title: '本命盘面要素',
      focus: `${[unknownTime ? knownPillarFocus : '八字日主与格局', ...(ziweiSection ? ['紫微命身'] : []), ...(astrolabeSection ? ['占星日月上升'] : [])].join('、')}的本命资料。`,
      baziEvidence: unknownTime
        ? [
            unknownTimeNotice,
            knownPillars.length
              ? `${knownPillars.join('、')}为已确定资料；${baziResult.dayMaster.gan ? `日主${baziResult.dayMaster.gan}已确定，` : '日主待补时，'}完整十神分布与格局待补时。`
              : '年、月、日柱须按候选场景定位；日主十神与格局待补时。',
          ]
        : [
            `日主${baziResult.dayMaster.gan}(${baziResult.dayMaster.element})，${baziResult.analysis.dayMasterStrength.status}`,
            `主格局为【${baziResult.analysis.mingGe.pattern}】`,
          ],
      ziweiEvidence: ziweiSection
        ? [
            `命宫坐${
              ziweiSection.palaces
                .find((p) => p.isOriginSoulPalace)
                ?.majorStars.map((s) => s.name)
                .join('、') || '空宫'
            }`,
            `身主${ziweiSection.bodyMaster}，命主${ziweiSection.soulMaster}`,
          ]
        : [],
      astrolabeEvidence: astrolabeSection
        ? [
            ...astrolabeSection.points
              .filter((point) => point.name === 'Sun' || point.name === 'Moon')
              .map((point) => `${point.name === 'Sun' ? '太阳' : '月亮'}落${point.sign}`),
            ...astrolabeSection.angles
              .filter((angle) => angle.name === 'Ascendant')
              .map((angle) => `上升点位于${angle.sign}`),
          ]
        : undefined,
      crossVerificationNotes: [],
    },
    {
      themeId: 'career-wealth',
      title: '事业与财富相关盘面',
      focus: `${[unknownTime ? knownPillarFocus : '八字喜忌', ...(ziweiSection ? ['紫微官禄财帛宫'] : []), ...(careerAstrolabeEvidence.length ? ['占星本命资料'] : [])].join('、')}的本命资料。`,
      baziEvidence: unknownTime
        ? [unknownTimeNotice, '喜用五行与财官印食伤作用待出生时分确定后再核验。']
        : [
            `核心用神：${baziResult.analysis.usefulGod.primaryUseful || baziResult.analysis.usefulGod.useful || '待定'}`,
            `核心忌神：${baziResult.analysis.usefulGod.primaryAvoid || baziResult.analysis.usefulGod.avoid || '待定'}`,
            ...(transformation?.status === '成化'
              ? [`成化取用以化神${transformation.element}为主体`]
              : []),
          ],
      ziweiEvidence: ziweiSection
        ? [
            `官禄宫坐${
              ziweiSection.palaces
                .find((p) => p.name.includes('官禄'))
                ?.majorStars.map((s) => s.name)
                .join('、') || '无主星'
            }`,
            `财帛宫坐${
              ziweiSection.palaces
                .find((p) => p.name.includes('财帛'))
                ?.majorStars.map((s) => s.name)
                .join('、') || '无主星'
            }`,
          ]
        : [],
      astrolabeEvidence: careerAstrolabeEvidence.length ? careerAstrolabeEvidence : undefined,
      crossVerificationNotes: [],
    },
    {
      themeId: 'timing-cycles',
      title: '起运与运限资料',
      focus: '八字起运岁数与首步大运。',
      baziEvidence: unknownTime
        ? []
        : [
            `起运岁数：约${luckChronicleSection.startAge}岁起运`,
            `首步大运：${
              luckChronicleSection.cycles.find((c) => !c.isXiaoyun)?.ganZhi || '—'
            }运（约${luckChronicleSection.startAge}岁起始）`,
          ],
      ziweiEvidence: [],
      crossVerificationNotes: [],
    },
  ].filter((theme) => theme.baziEvidence.length > 0);

  // 6. 元数据组装
  const gender =
    baziResult.gender === 'male' || baziResult.gender === 'female' ? baziResult.gender : '';
  const timing = baziResult.timing?.enabled ? baziResult.timing : undefined;
  const birthClock = unknownTime ? undefined : (baziResult.birthClockTime ?? timing?.standardTime);
  const birthSolarDay = birthClock
    ? SolarDay.fromYmd(birthClock.year, birthClock.month, birthClock.day)
    : undefined;
  const birthLunarDay = birthSolarDay?.getLunarDay();
  const showBirthSecond =
    !unknownTime &&
    (person.birthSecond !== undefined || (birthClock !== undefined && birthClock.second !== 0));
  const correctedClock = timing?.correctedTime;
  const correctedCrossesDate =
    birthClock !== undefined &&
    correctedClock !== undefined &&
    (birthClock.year !== correctedClock.year ||
      birthClock.month !== correctedClock.month ||
      birthClock.day !== correctedClock.day);
  const metadata: MingluMetadata = {
    subjectName: person.name || '命主',
    gender,
    genderLabel: gender === 'male' ? '乾造 (男命)' : gender === 'female' ? '坤造 (女命)' : '未指定',
    solarDateStr: birthClock
      ? `${birthClock.year}年${birthClock.month}月${birthClock.day}日`
      : `${baziResult.solarDate.year}年${baziResult.solarDate.month}月${baziResult.solarDate.day}日`,
    lunarDateStr: birthLunarDay
      ? `农历${birthLunarDay.getLunarMonth().getName()}${birthLunarDay.getName()}`
      : `农历${baziResult.lunarDate.monthName}${baziResult.lunarDate.dayName}`,
    shichenName: baziResult.timeInfo.name,
    exactBirthTime: unknownTime
      ? undefined
      : birthClock
        ? `${String(birthClock.hour).padStart(2, '0')}:${String(birthClock.minute).padStart(2, '0')}${showBirthSecond ? `:${String(birthClock.second).padStart(2, '0')}` : ''}`
        : person.birthHour !== undefined && person.birthMinute !== undefined
          ? `${String(person.birthHour).padStart(2, '0')}:${String(person.birthMinute).padStart(2, '0')}${
              person.birthSecond === undefined
                ? ''
                : `:${String(person.birthSecond).padStart(2, '0')}`
            }`
          : undefined,
    ...(showBirthSecond ? { birthSecond: birthClock?.second ?? person.birthSecond } : {}),
    birthPlace: timing ? timing.birthPlace : person.birthPlace,
    longitude: timing ? timing.birthLongitude : person.birthLongitude,
    latitude: person.birthLatitude,
    timezone: timing ? timing.timezone : person.timezone,
    timeZoneId: timing ? timing.timeZoneId : person.timeZoneId,
    isTrueSolarTime: timing?.enabled === true,
    trueSolarTimeStr: correctedClock
      ? `${correctedCrossesDate ? `${correctedClock.year}年${correctedClock.month}月${correctedClock.day}日 ` : ''}${correctedClock.hour}时${correctedClock.minute}分${person.birthSecond !== undefined || correctedClock.second !== 0 ? `${correctedClock.second}秒` : ''}`
      : undefined,
    baziFourPillars: {
      year: baziResult.pillars.year.ganZhi || (unknownTime ? '待补时' : ''),
      month: baziResult.pillars.month.ganZhi || (unknownTime ? '待补时' : ''),
      day: baziResult.pillars.day.ganZhi || (unknownTime ? '待补时' : ''),
      hour: baziResult.pillars.hour.ganZhi || (unknownTime ? '待补时' : ''),
    },
    dayMaster: {
      gan: baziResult.dayMaster.gan,
      wuxing: (baziResult.dayMaster.element || (unknownTime ? '待补时' : '')) as Wuxing,
      yinYang: (baziResult.dayMaster.yinYang || (unknownTime ? '待补时' : '')) as '阴' | '阳',
    },
    zodiac: birthLunarDay
      ? birthLunarDay
          .getLunarMonth()
          .getLunarYear()
          .getSixtyCycle()
          .getEarthBranch()
          .getZodiac()
          .getName()
      : baziResult.zodiac,
    constellation: birthSolarDay
      ? birthSolarDay.getConstellation().getName()
      : baziResult.constellation,
    mingGua: baziResult.mingGua
      ? {
          gua: baziResult.mingGua.gua,
          number: baziResult.mingGua.number,
          eastWest: baziResult.mingGua.eastWest,
          element: baziResult.mingGua.element,
        }
      : undefined,
    ziweiSummary: ziweiSection
      ? {
          soulMaster: ziweiSection.soulMaster,
          bodyMaster: ziweiSection.bodyMaster,
          wuxingBureau: ziweiSection.bureau,
          soulPalaceBranch: ziweiSection.soulPalaceBranch,
          bodyPalaceBranch: ziweiSection.bodyPalaceBranch,
        }
      : undefined,
    astrolabeSummary: astrolabeSection
      ? {
          sunSign: astrolabeSection.points.find((p) => p.name === 'Sun')?.sign || '—',
          moonSign: astrolabeSection.points.find((p) => p.name === 'Moon')?.sign || '—',
          ascendantSign: astrolabeSection.angles.find((a) => a.name === 'Ascendant')?.sign || '—',
          dominantElement:
            Object.entries(astrolabeSection.distributions.elements)
              .filter(([, item]) => item.count > 0 && item.count === dominantElementCount)
              .map(([element]) => element)
              .join('、') || '—',
        }
      : undefined,
  };

  // 7. 目录树 (Table of Contents)
  const tableOfContents: MingluTOCItem[] = [
    {
      id: 'section-beginner-guide',
      title: '导读：小白极速入门指南',
      anchorId: 'minglu-beginner-guide',
      level: 1,
      badge: '通俗直解',
    },
    {
      id: 'section-pillars',
      title: '第一章：命录提纲与四柱全息矩阵',
      anchorId: 'bazi-pillars-matrix',
      level: 1,
      badge: '原局四柱',
      subItems: [
        {
          id: 'sub-matrix',
          title: '四柱干支与藏干十神全览',
          anchorId: 'bazi-matrix-table',
          level: 2,
        },
        { id: 'sub-sanyuan', title: '三垣胎元胎息与命身宫', anchorId: 'bazi-sanyuan', level: 2 },
        { id: 'sub-season', title: '节气令星与月令司令', anchorId: 'bazi-season', level: 2 },
      ],
    },
    {
      id: 'section-five-elements',
      title: '第二章：日主精微与五行能量全息剖析',
      anchorId: 'bazi-five-elements',
      level: 1,
      badge: '旺衰强弱',
      subItems: [
        {
          id: 'sub-elements-dist',
          title: '五行结构加权分布',
          anchorId: 'bazi-elements-distribution',
          level: 2,
        },
        {
          id: 'sub-strength',
          title: '日主旺衰与同异类比值',
          anchorId: 'bazi-daymaster-strength',
          level: 2,
        },
      ],
    },
    {
      id: 'section-pattern',
      title: '第三章：格局成败与用神喜忌精微',
      anchorId: 'bazi-pattern-gods',
      level: 1,
      badge: '格局用神',
      subItems: [
        {
          id: 'sub-pattern-def',
          title: '主格定性与立格成败',
          anchorId: 'bazi-pattern-detail',
          level: 2,
        },
        {
          id: 'sub-useful-god',
          title: '核心用神与喜忌仇闲',
          anchorId: 'bazi-useful-god-detail',
          level: 2,
        },
        {
          id: 'sub-classics',
          title: '《滴天髓》《穷通宝鉴》评注',
          anchorId: 'bazi-classics-advice',
          level: 2,
        },
      ],
    },
    {
      id: 'section-interactions',
      title: '第四章：全量柱间作用网络与刑冲合会',
      anchorId: 'bazi-interactions',
      level: 1,
      badge: `${interactionsSection.length} 组关系`,
      itemCount: interactionsSection.length,
    },
    {
      id: 'section-shensha',
      title: '第五章：八字神煞与传统取象',
      anchorId: 'bazi-shensha-pantheon',
      level: 1,
      badge: `${shenShaSection.length} 项神煞`,
      itemCount: shenShaSection.length,
    },
    {
      id: 'section-ten-gods',
      title: '第六章：十神透藏与四柱传统取象',
      anchorId: 'bazi-ten-gods-symbology',
      level: 1,
      badge: '十神六亲',
    },
    {
      id: 'section-life-stages',
      title: '第七章：十二长生阶段与四柱自坐',
      anchorId: 'bazi-life-stages-matrix',
      level: 1,
      badge: '十二长生',
    },
    {
      id: 'section-luck',
      title: '第八章：岁运与流年流月',
      anchorId: 'bazi-luck-chronicle',
      level: 1,
      badge: `${luckChronicleSection.cycles.filter((cycle) => cycle.entryType === '大运').length} 步大运`,
    },
  ];

  if (ziweiSection) {
    tableOfContents.push({
      id: 'section-ziwei',
      title: '第九章：紫微斗数十二宫全息图谱',
      anchorId: 'ziwei-twelve-palaces',
      level: 1,
      badge: '紫微斗数',
      subItems: [
        {
          id: 'sub-ziwei-palaces',
          title: '十二宫位星曜三方四正',
          anchorId: 'ziwei-palaces-grid',
          level: 2,
        },
        {
          id: 'sub-ziwei-patterns',
          title: '经典格局检测与考证',
          anchorId: 'ziwei-patterns-list',
          level: 2,
        },
        {
          id: 'sub-ziwei-mutagens',
          title: '生年四化与飞星',
          anchorId: 'ziwei-mutagens-flow',
          level: 2,
        },
      ],
    });
  }

  if (astrolabeSection) {
    tableOfContents.push({
      id: 'section-astrolabe',
      title: '第十章：西洋占星本命图谱与相位网格',
      anchorId: 'astrolabe-chart-dossier',
      level: 1,
      badge: '西洋占星',
      subItems: [
        {
          id: 'sub-astro-planets',
          title: '十大行星与四轴落宫',
          anchorId: 'astrolabe-planets-table',
          level: 2,
        },
        {
          id: 'sub-astro-aspects',
          title: '本命相位全景网格',
          anchorId: 'astrolabe-aspects-grid',
          level: 2,
        },
        {
          id: 'sub-astro-elements',
          title: '元素与形态星体统计',
          anchorId: 'astrolabe-elements-chart',
          level: 2,
        },
      ],
    });
  }

  if (fengshuiSection) {
    tableOfContents.push({
      id: 'section-fengshui',
      title: '第十一章：宅命相配与八宅九星风水',
      anchorId: 'fengshui-bazhai-dossier',
      level: 1,
      badge: '八宅风水',
    });
  }

  tableOfContents.push({
    id: 'section-synthesis',
    title: '第十二章：盘面主题资料',
    anchorId: 'cross-synthesis-section',
    level: 1,
    badge: '主题资料',
  });

  tableOfContents.push({
    id: 'section-glossary',
    title: '第十三章：命理全息术语百科词典',
    anchorId: 'glossary-encyclopedia',
    level: 1,
    badge: `${glossary.length} 条目`,
  });

  // 8. 交叉链接网络 (Cross Links)
  const crossLinks: MingluCrossLink[] = [
    {
      id: 'link-daymaster',
      label: baziResult.dayMaster.gan,
      targetAnchorId: 'bazi-daymaster-strength',
      category: '日元',
    },
    {
      id: 'link-pattern',
      label: baziResult.analysis.mingGe.pattern,
      targetAnchorId: 'bazi-pattern-detail',
      category: '格局',
    },
    {
      id: 'link-useful',
      label: baziResult.analysis.usefulGod.primaryUseful || '用神',
      targetAnchorId: 'bazi-useful-god-detail',
      category: '用神',
    },
    {
      id: 'link-interactions',
      label: '柱间关系',
      targetAnchorId: 'bazi-interactions',
      category: '刑冲合会',
    },
    {
      id: 'link-shensha',
      label: '神煞谱系',
      targetAnchorId: 'bazi-shensha-pantheon',
      category: '神煞',
    },
    { id: 'link-luck', label: '大运编年', targetAnchorId: 'bazi-luck-chronicle', category: '大运' },
  ];

  if (ziweiSection) {
    crossLinks.push({
      id: 'link-ziwei',
      label: '紫微斗数十二宫',
      targetAnchorId: 'ziwei-twelve-palaces',
      category: '紫微',
    });
  }
  if (astrolabeSection) {
    crossLinks.push({
      id: 'link-astrolabe',
      label: '占星相位网格',
      targetAnchorId: 'astrolabe-aspects-grid',
      category: '占星',
    });
  }

  return {
    metadata,
    tableOfContents,
    beginnerGuide: buildBeginnerGuide(baziResult),
    glossary,
    crossLinks,
    pillarsSection,
    fiveElementsSection,
    patternUsefulGodSection,
    interactionsSection,
    shenShaSection,
    tenGodsSection,
    lifeStagesSection,
    luckChronicleSection,
    ziweiSection,
    astrolabeSection,
    fengshuiSection,
    crossSynthesisSection,
    statistics: {
      totalSections: tableOfContents.length,
      totalGlossaryEntries: glossary.length,
      totalShenShaCount: shenShaSection.length,
      totalInteractionsCount: interactionsSection.length,
      totalLuckYearsCount: luckChronicleSection.cycles.reduce(
        (acc, c) => acc + c.annualYears.length,
        0,
      ),
      totalZiweiStarsCount: ziweiSection
        ? ziweiSection.palaces.reduce(
            (acc, p) =>
              acc +
              p.majorStars.length +
              p.minorStars.length +
              p.maleficStars.length +
              p.otherStars.length,
            0,
          )
        : undefined,
      totalAstrolabeAspectsCount: astrolabeSection ? astrolabeSection.aspects.length : undefined,
    },
  };
}
