/**
 * @file 命录全息聚合器 (Minglu Article Builder)
 * @description 将八字、紫微、占星、风水及跨术数互证数据整合成具备全量目录、交叉索引与百科词典的 MingluArticle。
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
import { MINGLU_GLOSSARY_DATABASE } from './glossary-data';

export function buildMingluArticle(options: BuildMingluOptions): MingluArticle {
  const { person, baziResult, ziweiRuntime, astrolabeData } = options;

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

  // 5. 跨术数互证
  const crossSynthesisSection: MingluCrossSynthesisThemeData[] = [
    {
      themeId: 'temperament',
      title: '性情禀赋与心理结构',
      focus: '八字日主十神与紫微命身星曜、占星日月上升之相互印证。',
      baziEvidence: [
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
        : ['紫微排盘未载入'],
      astrolabeEvidence: astrolabeSection
        ? [
            `太阳落${astrolabeSection.points.find((p) => p.name === 'Sun')?.sign || '—'}`,
            `月亮落${astrolabeSection.points.find((p) => p.name === 'Moon')?.sign || '—'}`,
            `上升点位于${astrolabeSection.angles.find((a) => a.name === 'Ascendant')?.sign || '—'}`,
          ]
        : undefined,
      crossVerificationNotes: [
        '八字日元与十神体现内在能量结构与处事原则。',
        ziweiSection ? '紫微星系呈现外在气度与人际行事风采，与八字格局互为表里。' : '',
        astrolabeSection ? '占星日月升三位一体对应八字精气神，可与八字结构对照阅读。' : '',
      ].filter(Boolean),
    },
    {
      themeId: 'career-wealth',
      title: '事业抱负与财富格局',
      focus: '八字财官印食伤与紫微官禄财帛田宅、占星中天第二第十宫之印证。',
      baziEvidence: [
        `核心用神：${baziResult.analysis.usefulGod.primaryUseful || baziResult.analysis.usefulGod.useful || '待定'}`,
        `核心忌神：${baziResult.analysis.usefulGod.primaryAvoid || baziResult.analysis.usefulGod.avoid || '待定'}`,
      ],
      ziweiEvidence: ziweiSection
        ? [
            `官禄宫坐${
              ziweiSection.palaces
                .find((p) => p.name.includes('官禄'))
                ?.majorStars.map((s) => s.name)
                .join('、') || '诸星'
            }`,
            `财帛宫坐${
              ziweiSection.palaces
                .find((p) => p.name.includes('财帛'))
                ?.majorStars.map((s) => s.name)
                .join('、') || '诸星'
            }`,
          ]
        : ['紫微排盘未载入'],
      crossVerificationNotes: [
        '八字喜用神指明顺应天地之行业与取财路径。',
        ziweiSection ? '紫微三方四正展现具体职场平台与财富蓄积形态。' : '',
      ].filter(Boolean),
    },
    {
      themeId: 'timing-cycles',
      title: '大运岁运与行运脉络',
      focus: '八字大运流年与紫微十年大限、占星行星推运之同步对齐。',
      baziEvidence: [
        `起运岁数：约${luckChronicleSection.startAge}岁起运`,
        `首步大运：${
          luckChronicleSection.cycles.find((c) => !c.isXiaoyun)?.ganZhi || '—'
        }运（约${luckChronicleSection.startAge}岁起始）`,
      ],
      ziweiEvidence: ziweiSection
        ? [`大限按十年步进，起于命宫，顺逆依阳男阴女局数推求。`]
        : ['紫微大限未载入'],
      crossVerificationNotes: ['行运重在时位相应，逢吉运则乘势而上，逢磨砺则沉潜蓄势。'],
    },
  ];

  // 6. 元数据组装
  const metadata: MingluMetadata = {
    subjectName: person.name || '命主',
    gender: person.gender || 'male',
    genderLabel: person.gender === 'male' ? '乾造 (男命)' : '坤造 (女命)',
    solarDateStr: `${baziResult.solarDate.year}年${baziResult.solarDate.month}月${baziResult.solarDate.day}日`,
    lunarDateStr: `农历${baziResult.lunarDate.monthName}${baziResult.lunarDate.dayName}`,
    shichenName: baziResult.timeInfo.name,
    exactBirthTime:
      person.birthHour !== undefined && person.birthMinute !== undefined
        ? `${String(person.birthHour).padStart(2, '0')}:${String(person.birthMinute).padStart(2, '0')}`
        : undefined,
    birthPlace: person.birthPlace,
    longitude: person.birthLongitude,
    latitude: person.birthLatitude,
    timezone: person.timezone,
    timeZoneId: person.timeZoneId,
    isTrueSolarTime: person.useTrueSolarTime ?? false,
    trueSolarTimeStr: baziResult.timing
      ? `${baziResult.timing.correctedTime.hour}时${baziResult.timing.correctedTime.minute}分`
      : undefined,
    baziFourPillars: {
      year: baziResult.pillars.year.ganZhi,
      month: baziResult.pillars.month.ganZhi,
      day: baziResult.pillars.day.ganZhi,
      hour: baziResult.pillars.hour.ganZhi,
    },
    dayMaster: {
      gan: baziResult.dayMaster.gan,
      wuxing: baziResult.dayMaster.element as Wuxing,
      yinYang: baziResult.dayMaster.yinYang as '阴' | '阳',
    },
    zodiac: baziResult.zodiac,
    constellation: baziResult.constellation,
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
            Object.entries(astrolabeSection.distributions.elements).sort(
              (a, b) => b[1].count - a[1].count,
            )[0]?.[0] || '—',
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
          title: '五行分数与能量比例',
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
      title: '第五章：全息神煞谱系与典故考据',
      anchorId: 'bazi-shensha-pantheon',
      level: 1,
      badge: `${shenShaSection.length} 尊神煞`,
      itemCount: shenShaSection.length,
    },
    {
      id: 'section-ten-gods',
      title: '第六章：十神心性与六亲宫位意象',
      anchorId: 'bazi-ten-gods-symbology',
      level: 1,
      badge: '十神六亲',
    },
    {
      id: 'section-life-stages',
      title: '第七章：十二长生全景矩阵与自坐星运',
      anchorId: 'bazi-life-stages-matrix',
      level: 1,
      badge: '十二长生',
    },
    {
      id: 'section-luck',
      title: '第八章：大运流年流月全息编年大表',
      anchorId: 'bazi-luck-chronicle',
      level: 1,
      badge: `${luckChronicleSection.cycles.length} 步大运`,
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
          title: '元素形态能量分布',
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
    title: '第十二章：跨术数命理全景互证',
    anchorId: 'cross-synthesis-section',
    level: 1,
    badge: '多维印证',
  });

  tableOfContents.push({
    id: 'section-glossary',
    title: '第十三章：命理全息术语百科词典',
    anchorId: 'glossary-encyclopedia',
    level: 1,
    badge: `${MINGLU_GLOSSARY_DATABASE.length} 条目`,
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
    glossary: MINGLU_GLOSSARY_DATABASE,
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
      totalGlossaryEntries: MINGLU_GLOSSARY_DATABASE.length,
      totalShenShaCount: shenShaSection.length,
      totalInteractionsCount: interactionsSection.length,
      totalLuckYearsCount: luckChronicleSection.cycles.reduce(
        (acc, c) => acc + c.annualYears.length,
        0,
      ),
      totalZiweiStarsCount: ziweiSection
        ? ziweiSection.palaces.reduce(
            (acc, p) => acc + p.majorStars.length + p.minorStars.length + p.maleficStars.length,
            0,
          )
        : undefined,
      totalAstrolabeAspectsCount: astrolabeSection ? astrolabeSection.aspects.length : undefined,
    },
  };
}
