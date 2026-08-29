import React, { memo, useCallback, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  filterCommonBaziShenSha,
  getShenShaType,
  getTenGod,
  getTenGodForBranch,
  getWuxing,
  isGanZhiPair,
  ShenShaCalculator,
  type BaziChartResult,
} from 'mingyu-core/bazi';
import {
  getBaziDitiansuiAdvice,
  getBaziQiongtongAdvice,
  getBaziZipingPatternAdvice,
} from 'mingyu-core/classics';
import { HIDDEN_STEMS, NAYIN_MAP } from '@core/bazi/baziMappingsData';
import { getLifeStage } from '@core/bazi/baziValues';
import { calculateKongWangBranches } from '@core/bazi/kongWang';
import { uniqueNonEmptyStrings } from '@/lib/array-utils';
import {
  BaziFortuneSelector,
  type BaziFortuneDisplayColumn,
} from '@/components/BaziFortuneTools/BaziFortuneSelector';
import { lookupMetaphysicsTerm, type MetaphysicsTerm } from '@/lib/metaphysics-terms';
import { useMetaphysicsTermModal, type TermContextData } from '@/components/TermExplanationModal';
import { getBaziTermContext } from '@/lib/chart-term-context';
import { ChartShareModal } from '@/components/ChartShareModal';
import {
  formatAvoidGodPrioritySummary,
  formatBaziDate,
  formatGender,
  formatUsefulGodPrioritySummary,
  joinMultilineText,
} from '../ResultPage.helpers';
const PILLAR_KEYS = ['year', 'month', 'day', 'hour'] as const;
const PILLAR_LABELS = ['年柱', '月柱', '日柱', '时柱'] as const;
const fortuneShenShaCalculator = new ShenShaCalculator();

type BaziBoardColumn = {
  key: string;
  label: string;
  caption?: string;
  gan: string;
  zhi: string;
  ganTenGod: string;
  zhiTenGod: string;
  hiddenStems: string[];
  hiddenTenGods: string[];
  nayin: string;
  ziZuo: string;
  lifeStage: string;
  kongWang: string[];
  shensha: string[];
  isDayMaster?: boolean;
};

function filterBaziBoardShensha(items: string[]) {
  return filterCommonBaziShenSha(uniqueNonEmptyStrings(items));
}

function calculateBaziFortuneShensha(result: BaziChartResult, gan: string, zhi: string) {
  const comparisonPillars: Parameters<ShenShaCalculator['calculateAllShenSha']>[0] = [
    [result.pillars.year.gan, result.pillars.year.zhi],
    [result.pillars.month.gan, result.pillars.month.zhi],
    [result.pillars.day.gan, result.pillars.day.zhi],
    [gan, zhi],
  ];
  const shensha = fortuneShenShaCalculator.calculateAllShenSha(
    comparisonPillars,
    result.gender,
  ).hour;
  return filterBaziBoardShensha(shensha);
}

function BaziGanZhiValue(props: { value: string; onOpenTerm?: (term: string) => void }) {
  const wuxing = getWuxing(props.value);

  return (
    <span className="bazi-ganzhi-value">
      <strong
        className={`bazi-ganzhi-symbol ${props.onOpenTerm ? 'is-clickable-term' : ''}`}
        data-wuxing={wuxing}
        aria-label={`${props.value}，五行属${wuxing}`}
        onClick={() => props.onOpenTerm?.(props.value)}
        title={`点击查看【${props.value}】释义`}
      >
        {props.value}
      </strong>
    </span>
  );
}

function BaziPillarValue(props: {
  gan: string;
  zhi: string;
  ganTenGod: string;
  zhiTenGod: string;
  onOpenTerm?: (term: string) => void;
}) {
  return (
    <span className="bazi-pillar-value">
      <small
        className={props.onOpenTerm && props.ganTenGod ? 'is-clickable-term' : ''}
        onClick={() => props.onOpenTerm?.(props.ganTenGod)}
        title={`点击查看【${props.ganTenGod}】释义`}
      >
        {props.ganTenGod}
      </small>
      <span className="bazi-pillar-ganzhi">
        <BaziGanZhiValue value={props.gan} onOpenTerm={props.onOpenTerm} />
        <BaziGanZhiValue value={props.zhi} onOpenTerm={props.onOpenTerm} />
      </span>
      <em
        className={props.onOpenTerm && props.zhiTenGod ? 'is-clickable-term' : ''}
        onClick={() => props.onOpenTerm?.(props.zhiTenGod)}
        title={`点击查看【${props.zhiTenGod}】释义`}
      >
        {props.zhiTenGod}
      </em>
    </span>
  );
}

function BaziHiddenStemList(props: {
  stems: string[];
  tenGods: string[];
  onOpenTerm?: (term: string) => void;
}) {
  if (props.stems.length === 0) {
    return <span className="bazi-shensha-empty">无</span>;
  }

  return (
    <span className="bazi-hidden-stem-list">
      {props.stems.map((stem, index) => {
        const wuxing = getWuxing(stem);
        const tenGod = props.tenGods[index] ?? '';
        return (
          <span key={`${stem}-${index}`}>
            <strong
              data-wuxing={wuxing}
              className={props.onOpenTerm ? 'is-clickable-term' : ''}
              onClick={() => props.onOpenTerm?.(stem)}
              title={`点击查看【${stem}】释义`}
            >
              {stem}
            </strong>
            <small
              className={props.onOpenTerm && tenGod ? 'is-clickable-term' : ''}
              onClick={() => props.onOpenTerm?.(tenGod)}
              title={`点击查看【${tenGod}】释义`}
            >
              {tenGod}
            </small>
          </span>
        );
      })}
    </span>
  );
}

function BaziShenShaList(props: { items: string[]; onOpenTerm?: (term: string) => void }) {
  const items = filterBaziBoardShensha(props.items);

  if (items.length === 0) {
    return <span className="bazi-shensha-empty">无</span>;
  }

  return (
    <span className="bazi-shensha-list">
      {items.map((item) => {
        const type = getShenShaType(item === '天罗地网' ? '天罗' : item);
        const toneClassName =
          type === '吉' ? 'is-lucky' : type === '凶' ? 'is-unlucky' : 'is-neutral';

        return (
          <span
            className={`bazi-shensha-tag ${toneClassName} ${props.onOpenTerm ? 'is-clickable-term' : ''}`}
            aria-label={`${item}（${type}）`}
            key={item}
            onClick={() => props.onOpenTerm?.(item)}
          >
            {item}
          </span>
        );
      })}
    </span>
  );
}

interface BaziInteraction {
  id: string;
  category:
    | '天干五合'
    | '地支六合'
    | '地支三合'
    | '地支半合'
    | '地支三会'
    | '地支六冲'
    | '地支相刑'
    | '地支相害'
    | '地支相破';
  name: string;
  pillars: string[];
  tone: 'lucky' | 'unlucky' | 'neutral';
  classicSummary: string;
}

const STEM_FIVE_COMBINATIONS: Array<{
  stems: [string, string];
  name: string;
  wuxing: string;
  description: string;
}> = [
  {
    stems: ['甲', '己'],
    name: '甲己合化土',
    wuxing: '土',
    description: '中正之合，宽厚重信，尊崇礼义',
  },
  {
    stems: ['乙', '庚'],
    name: '乙庚合化金',
    wuxing: '金',
    description: '仁义之合，刚柔相济，果敢重诺',
  },
  {
    stems: ['丙', '辛'],
    name: '丙辛合化水',
    wuxing: '水',
    description: '威制之合，智谋权变，仪态端庄',
  },
  {
    stems: ['丁', '壬'],
    name: '丁壬合化木',
    wuxing: '木',
    description: '仁寿之合，多情重义，温和慈爱',
  },
  {
    stems: ['戊', '癸'],
    name: '戊癸合化火',
    wuxing: '火',
    description: '无情之合，明敏俊秀，老少相配',
  },
];

const BRANCH_SIX_COMBINATIONS: Array<{
  branches: [string, string];
  name: string;
  wuxing: string;
  description: string;
}> = [
  { branches: ['子', '丑'], name: '子丑合化土', wuxing: '土', description: '泥土相涵，亲和稳重' },
  { branches: ['寅', '亥'], name: '寅亥合化木', wuxing: '木', description: '破中有合，生机盎然' },
  { branches: ['卯', '戌'], name: '卯戌合化火', wuxing: '火', description: '春入晚秋，热情内敛' },
  { branches: ['辰', '酉'], name: '辰酉合化金', wuxing: '金', description: '湿土生金，相辅相成' },
  { branches: ['巳', '申'], name: '巳申合化水', wuxing: '水', description: '刑中有合，智勇兼备' },
  { branches: ['午', '未'], name: '午未合化火土', wuxing: '土', description: '日月同辉，尊贵高洁' },
];

const BRANCH_THREE_COMBINATIONS: Array<{
  branches: [string, string, string];
  name: string;
  wuxing: string;
  description: string;
}> = [
  {
    branches: ['申', '子', '辰'],
    name: '申子辰三合水局',
    wuxing: '水',
    description: '润下汇聚，水势浩荡，智谋通达',
  },
  {
    branches: ['亥', '卯', '未'],
    name: '亥卯未三合木局',
    wuxing: '木',
    description: '曲直向上，仁义生发，文华秀出',
  },
  {
    branches: ['寅', '午', '戌'],
    name: '寅午戌三合火局',
    wuxing: '火',
    description: '炎上普照，光明磊落，礼敬热诚',
  },
  {
    branches: ['巳', '酉', '丑'],
    name: '巳酉丑三合金局',
    wuxing: '金',
    description: '从革刚健，义气坚决，威严果敢',
  },
];

const BRANCH_THREE_MEETINGS: Array<{
  branches: [string, string, string];
  name: string;
  wuxing: string;
  description: string;
}> = [
  {
    branches: ['寅', '卯', '辰'],
    name: '寅卯辰三会东方木',
    wuxing: '木',
    description: '东方春令，全盘木气旺盛',
  },
  {
    branches: ['巳', '午', '未'],
    name: '巳午未三会南方火',
    wuxing: '火',
    description: '南方夏令，全盘火气炽热',
  },
  {
    branches: ['申', '酉', '戌'],
    name: '申酉戌三会西方金',
    wuxing: '金',
    description: '西方秋令，全盘金气刚肃',
  },
  {
    branches: ['亥', '子', '丑'],
    name: '亥子丑三会北方水',
    wuxing: '水',
    description: '北方冬令，全盘水气清寒',
  },
];

const BRANCH_SIX_CHONGS: Array<{
  branches: [string, string];
  name: string;
  description: string;
}> = [
  { branches: ['子', '午'], name: '子午相冲', description: '水火相战，多主心肾不安、动荡奔波' },
  { branches: ['丑', '未'], name: '丑未相冲', description: '湿燥相激，多主田宅资产或脾胃变动' },
  { branches: ['寅', '申'], name: '寅申相冲', description: '金木交加，驿马道路奔波、骨骼筋腱注意' },
  { branches: ['卯', '酉'], name: '卯酉相冲', description: '金木相伤，门户变动、情思纠葛' },
  { branches: ['辰', '戌'], name: '辰戌相冲', description: '魁罡相冲，官非权柄或住所迁变' },
  { branches: ['巳', '亥'], name: '巳亥相冲', description: '水火冲突，文书破耗或远行变动' },
];

const BRANCH_PUNISHMENTS: Array<{
  branches: string[];
  name: string;
  description: string;
}> = [
  {
    branches: ['寅', '巳', '申'],
    name: '寅巳申三刑（无恩之刑）',
    description: '性情刚直，防恩将仇报或受人拖累',
  },
  {
    branches: ['丑', '戌', '未'],
    name: '丑戌未三刑（持势之刑）',
    description: '多生竞争，防官讼及权位争端',
  },
  {
    branches: ['子', '卯'],
    name: '子卯相刑（无礼之刑）',
    description: '多生嫌隙，需重礼法修养与人际和谐',
  },
  { branches: ['辰', '辰'], name: '辰辰自刑', description: '思虑过重，多生沉郁自扰之感' },
  { branches: ['午', '午'], name: '午午自刑', description: '性情急躁，多生心火燥烈' },
  { branches: ['酉', '酉'], name: '酉酉自刑', description: '刚愎过重，自伤和气' },
  { branches: ['亥', '亥'], name: '亥亥自刑', description: '欲望过溢，多生迷惘纠结' },
];

const BRANCH_HARMS: Array<{
  branches: [string, string];
  name: string;
  description: string;
}> = [
  { branches: ['子', '未'], name: '子未相害', description: '骨肉生隙，事多羁绊' },
  { branches: ['丑', '午'], name: '丑午相害', description: '争进官非，性情急躁' },
  { branches: ['寅', '巳'], name: '寅巳相害', description: '恩中有怨，进退两难' },
  { branches: ['卯', '辰'], name: '卯辰相害', description: '长幼失和，事多掣肘' },
  { branches: ['申', '亥'], name: '申亥相害', description: '争嫉破耗，先好后疑' },
  { branches: ['酉', '戌'], name: '酉戌相害', description: '嫉妒相伤，多生口舌' },
];

const BRANCH_BREAKS: Array<{
  branches: [string, string];
  name: string;
  description: string;
}> = [
  { branches: ['子', '酉'], name: '子酉相破', description: '金沉水底，做事有头无尾' },
  { branches: ['卯', '午'], name: '卯午相破', description: '木火旺极，劳碌心力' },
  { branches: ['辰', '丑'], name: '辰丑相破', description: '泥土相杂，破耗不宁' },
  { branches: ['未', '戌'], name: '未戌相破', description: '燥土相凌，刑伤破败' },
  { branches: ['寅', '亥'], name: '寅亥相破', description: '生中有破，好中有损' },
  { branches: ['巳', '申'], name: '巳申相破', description: '合中带破，吉凶参半' },
];

function calculateBaziInteractions(boardColumns: BaziBoardColumn[]): BaziInteraction[] {
  const interactions: BaziInteraction[] = [];
  const validCols = boardColumns.filter((c) => c.gan && c.zhi);

  // 1. 天干五合
  for (let i = 0; i < validCols.length; i++) {
    for (let j = i + 1; j < validCols.length; j++) {
      const g1 = validCols[i].gan;
      const g2 = validCols[j].gan;
      const match = STEM_FIVE_COMBINATIONS.find(
        (c) => (c.stems[0] === g1 && c.stems[1] === g2) || (c.stems[0] === g2 && c.stems[1] === g1),
      );
      if (match) {
        interactions.push({
          id: `stem-he-${i}-${j}`,
          category: '天干五合',
          name: match.name,
          pillars: [validCols[i].label, validCols[j].label],
          tone: 'lucky',
          classicSummary: match.description,
        });
      }
    }
  }

  const allZhis = validCols.map((c) => ({ label: c.label, zhi: c.zhi }));

  // 2. 地支三会局
  for (const hui of BRANCH_THREE_MEETINGS) {
    const matched = hui.branches.every((b) => allZhis.some((z) => z.zhi === b));
    if (matched) {
      const involved = allZhis.filter((z) => hui.branches.includes(z.zhi)).map((z) => z.label);
      interactions.push({
        id: `branch-hui-${hui.name}`,
        category: '地支三会',
        name: hui.name,
        pillars: Array.from(new Set(involved)),
        tone: 'lucky',
        classicSummary: hui.description,
      });
    }
  }

  // 3. 地支三合局
  for (const sanhe of BRANCH_THREE_COMBINATIONS) {
    const matched = sanhe.branches.every((b) => allZhis.some((z) => z.zhi === b));
    if (matched) {
      const involved = allZhis.filter((z) => sanhe.branches.includes(z.zhi)).map((z) => z.label);
      interactions.push({
        id: `branch-sanhe-${sanhe.name}`,
        category: '地支三合',
        name: sanhe.name,
        pillars: Array.from(new Set(involved)),
        tone: 'lucky',
        classicSummary: sanhe.description,
      });
    }
  }

  // 4. 地支六合
  for (let i = 0; i < allZhis.length; i++) {
    for (let j = i + 1; j < allZhis.length; j++) {
      const z1 = allZhis[i].zhi;
      const z2 = allZhis[j].zhi;
      const match = BRANCH_SIX_COMBINATIONS.find(
        (c) =>
          (c.branches[0] === z1 && c.branches[1] === z2) ||
          (c.branches[0] === z2 && c.branches[1] === z1),
      );
      if (match) {
        interactions.push({
          id: `branch-liuhe-${i}-${j}`,
          category: '地支六合',
          name: match.name,
          pillars: [allZhis[i].label, allZhis[j].label],
          tone: 'lucky',
          classicSummary: match.description,
        });
      }
    }
  }

  // 5. 地支六冲
  for (let i = 0; i < allZhis.length; i++) {
    for (let j = i + 1; j < allZhis.length; j++) {
      const z1 = allZhis[i].zhi;
      const z2 = allZhis[j].zhi;
      const match = BRANCH_SIX_CHONGS.find(
        (c) =>
          (c.branches[0] === z1 && c.branches[1] === z2) ||
          (c.branches[0] === z2 && c.branches[1] === z1),
      );
      if (match) {
        interactions.push({
          id: `branch-chong-${i}-${j}`,
          category: '地支六冲',
          name: match.name,
          pillars: [allZhis[i].label, allZhis[j].label],
          tone: 'unlucky',
          classicSummary: match.description,
        });
      }
    }
  }

  // 6. 地支相刑
  for (const xing of BRANCH_PUNISHMENTS) {
    if (xing.branches.length === 3) {
      const matched = xing.branches.every((b) => allZhis.some((z) => z.zhi === b));
      if (matched) {
        const involved = allZhis.filter((z) => xing.branches.includes(z.zhi)).map((z) => z.label);
        interactions.push({
          id: `branch-sanxing-${xing.name}`,
          category: '地支相刑',
          name: xing.name,
          pillars: Array.from(new Set(involved)),
          tone: 'unlucky',
          classicSummary: xing.description,
        });
      }
    } else if (xing.branches.length === 2 && xing.branches[0] === xing.branches[1]) {
      const count = allZhis.filter((z) => z.zhi === xing.branches[0]).length;
      if (count >= 2) {
        const involved = allZhis.filter((z) => z.zhi === xing.branches[0]).map((z) => z.label);
        interactions.push({
          id: `branch-zixing-${xing.name}`,
          category: '地支相刑',
          name: xing.name,
          pillars: involved,
          tone: 'unlucky',
          classicSummary: xing.description,
        });
      }
    } else if (xing.branches.length === 2) {
      const hasFirst = allZhis.some((z) => z.zhi === xing.branches[0]);
      const hasSecond = allZhis.some((z) => z.zhi === xing.branches[1]);
      if (hasFirst && hasSecond) {
        const involved = allZhis.filter((z) => xing.branches.includes(z.zhi)).map((z) => z.label);
        interactions.push({
          id: `branch-xing-${xing.name}`,
          category: '地支相刑',
          name: xing.name,
          pillars: Array.from(new Set(involved)),
          tone: 'unlucky',
          classicSummary: xing.description,
        });
      }
    }
  }

  // 7. 地支相害
  for (let i = 0; i < allZhis.length; i++) {
    for (let j = i + 1; j < allZhis.length; j++) {
      const z1 = allZhis[i].zhi;
      const z2 = allZhis[j].zhi;
      const match = BRANCH_HARMS.find(
        (c) =>
          (c.branches[0] === z1 && c.branches[1] === z2) ||
          (c.branches[0] === z2 && c.branches[1] === z1),
      );
      if (match) {
        interactions.push({
          id: `branch-harm-${i}-${j}`,
          category: '地支相害',
          name: match.name,
          pillars: [allZhis[i].label, allZhis[j].label],
          tone: 'unlucky',
          classicSummary: match.description,
        });
      }
    }
  }

  // 8. 地支相破
  for (let i = 0; i < allZhis.length; i++) {
    for (let j = i + 1; j < allZhis.length; j++) {
      const z1 = allZhis[i].zhi;
      const z2 = allZhis[j].zhi;
      const match = BRANCH_BREAKS.find(
        (c) =>
          (c.branches[0] === z1 && c.branches[1] === z2) ||
          (c.branches[0] === z2 && c.branches[1] === z1),
      );
      if (match) {
        interactions.push({
          id: `branch-break-${i}-${j}`,
          category: '地支相破',
          name: match.name,
          pillars: [allZhis[i].label, allZhis[j].label],
          tone: 'neutral',
          classicSummary: match.description,
        });
      }
    }
  }

  return interactions;
}

export const BaziChartBoard = memo(function BaziChartBoard(props: {
  title: string;
  name: string;
  result: BaziChartResult;
  isInstant?: boolean;
  timeBasisLabel?: string;
}) {
  const { title, name, result, isInstant = false, timeBasisLabel } = props;
  const [fortuneColumns, setFortuneColumns] = useState<BaziFortuneDisplayColumn[]>([]);
  const [interactionsExpanded, setInteractionsExpanded] = useState(true);
  const [qiongtongExpanded, setQiongtongExpanded] = useState(true);
  const [ditiansuiExpanded, setDitiansuiExpanded] = useState(true);
  const [zipingExpanded, setZipingExpanded] = useState(true);

  const dayMasterGan = result.dayMaster?.gan || result.pillars.day?.gan;
  const monthBranchZhi = result.pillars.month?.zhi;

  const qiongtongAdvice = useMemo(() => {
    if (!dayMasterGan || !monthBranchZhi) return undefined;
    return getBaziQiongtongAdvice(dayMasterGan, monthBranchZhi);
  }, [dayMasterGan, monthBranchZhi]);

  const ditiansuiAdvice = useMemo(() => {
    if (!dayMasterGan) return undefined;
    return getBaziDitiansuiAdvice(dayMasterGan);
  }, [dayMasterGan]);

  const zipingAdvice = useMemo(() => {
    const pattern = result.pattern?.name || result.pattern?.type;
    if (!pattern) return undefined;
    return getBaziZipingPatternAdvice(pattern);
  }, [result.pattern]);

  const missingElements = uniqueNonEmptyStrings(result.wuxingStrength.missing);
  const warnings = uniqueNonEmptyStrings(result.warnings);
  const referenceItems: Array<{ label: string; value: string; detail: string }> = [];

  if (!isInstant && result.mingGua) {
    referenceItems.push({
      label: '命卦',
      value: `${result.mingGua.gua}${result.mingGua.number}`,
      detail: `${result.mingGua.eastWest} · ${result.mingGua.element}`,
    });
  }

  if (!isInstant && result.mingGong) {
    referenceItems.push({ label: '命宫', value: result.mingGong, detail: '本命根基' });
  }

  if (!isInstant && result.shenGong) {
    referenceItems.push({ label: '身宫', value: result.shenGong, detail: '后天着力' });
  }
  if (!isInstant && result.taiYuan) {
    referenceItems.push({ label: '胎元', value: result.taiYuan, detail: '月柱顺推' });
  }
  if (!isInstant && result.taiXi) {
    referenceItems.push({ label: '胎息', value: result.taiXi, detail: '日柱干支合取' });
  }
  if (result.monthCommander) {
    referenceItems.push({
      label: '月令司权',
      value: result.monthCommander,
      detail: result.seasonInfo.currentJieqi || result.seasonInfo.currentSeason,
    });
  }
  const pillarRelationGroups = [
    { label: '伏吟', items: result.pillarRelations.fuxin },
    { label: '反吟', items: result.pillarRelations.fanyin },
    { label: '刑冲合会', items: result.pillarRelations.xingChong },
  ].filter((item) => item.items.length > 0);
  const dayOwnerLabel = isInstant
    ? '日元'
    : result.gender === 'male'
      ? '元男'
      : result.gender === 'female'
        ? '元女'
        : '';
  const natalColumns: BaziBoardColumn[] = PILLAR_KEYS.map((key, index) => ({
    key,
    label: PILLAR_LABELS[index],
    gan: result.pillars[key].gan,
    zhi: result.pillars[key].zhi,
    ganTenGod: key === 'day' && dayOwnerLabel ? dayOwnerLabel : result.tenGods[key],
    zhiTenGod: getTenGodForBranch(result.pillars[key].zhi, result.dayMaster.gan),
    hiddenStems: result.hiddenStems[key],
    hiddenTenGods: result.hiddenTenGods[key],
    nayin: result.nayin[key],
    ziZuo: result.ziZuo[key],
    lifeStage: result.lifeStages[key],
    kongWang: result.kongWang[key],
    shensha:
      key === 'year'
        ? [...(result.shensha.global ?? []), ...result.shensha[key]]
        : result.shensha[key],
    isDayMaster: key === 'day',
  }));
  const activeFortuneColumns: BaziBoardColumn[] = fortuneColumns.flatMap((column) => {
    if (!isGanZhiPair(column.ganZhi[0], column.ganZhi[1])) return [];
    const [gan, zhi] = column.ganZhi.split('');
    const hiddenStems = HIDDEN_STEMS[zhi] ?? [];
    return [
      {
        ...column,
        key: `fortune-${column.key}`,
        gan,
        zhi,
        ganTenGod: getTenGod(gan, result.dayMaster.gan),
        zhiTenGod: getTenGodForBranch(zhi, result.dayMaster.gan),
        hiddenStems,
        hiddenTenGods: hiddenStems.map((stem) => getTenGod(stem, result.dayMaster.gan)),
        nayin: NAYIN_MAP[column.ganZhi] ?? '—',
        ziZuo: getLifeStage(gan, zhi),
        lifeStage: getLifeStage(result.dayMaster.gan, zhi),
        kongWang: calculateKongWangBranches(gan, zhi),
        shensha: calculateBaziFortuneShensha(result, gan, zhi),
      },
    ];
  });
  const boardColumns = [...natalColumns, ...activeFortuneColumns];
  const interactions = useMemo(() => calculateBaziInteractions(boardColumns), [boardColumns]);
  const boardStyle = {
    '--bazi-display-column-count': boardColumns.length,
  } as CSSProperties;
  const { openTerm } = useMetaphysicsTermModal();
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const formatBaziChartText = useCallback(() => {
    return [
      `【八字命盘 · ${name}】`,
      `时间：${formatBaziDate(result)} (${result.timeInfo.name})  性别：${formatGender(result.gender)}`,
      `格局：${result.analysis.mingGe.pattern}  旺衰：${result.analysis.dayMasterStrength.status}`,
      `四柱：年柱【${result.pillars.year.gan}${result.pillars.year.zhi}】 月柱【${result.pillars.month.gan}${result.pillars.month.zhi}】 日柱【${result.pillars.day.gan}${result.pillars.day.zhi}】 时柱【${result.pillars.hour.gan}${result.pillars.hour.zhi}】`,
      `核心用神：${result.analysis.usefulGod.primaryUseful || result.analysis.usefulGod.useful || '无'}  忌神：${result.analysis.usefulGod.primaryAvoid || result.analysis.usefulGod.avoid || '无'}`,
      activeFortuneColumns.length
        ? `当前岁运：${activeFortuneColumns.map((c) => `${c.label}:${c.gan}${c.zhi}`).join(' ')}`
        : '',
      interactions.length
        ? `干支作用：${interactions.map((i) => `${i.name}(${i.pillars.join('/')})`).join('；')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');
  }, [name, result, activeFortuneColumns, interactions]);

  const handleOpenBaziTerm = useCallback(
    (term: string, column?: BaziBoardColumn) => {
      const context = getBaziTermContext(term, result, {
        pillarLabel: column?.label,
        ganZhi: column ? `${column.gan || ''}${column.zhi || ''}` : undefined,
      });
      openTerm(term, context);
    },
    [openTerm, result],
  );

  const pillarRows: Array<{
    label: string;
    values: ReactNode[];
    className?: string;
  }> = [
    {
      label: '命式',
      values: boardColumns.map((column) => (
        <BaziPillarValue
          key={column.key}
          gan={column.gan}
          zhi={column.zhi}
          ganTenGod={column.ganTenGod}
          zhiTenGod={column.zhiTenGod}
          onOpenTerm={(t) => handleOpenBaziTerm(t, column)}
        />
      )),
      className: 'is-pillar',
    },
    {
      label: '藏干',
      values: boardColumns.map((column) => (
        <BaziHiddenStemList
          key={column.key}
          stems={column.hiddenStems}
          tenGods={column.hiddenTenGods}
          onOpenTerm={(t) => handleOpenBaziTerm(t, column)}
        />
      )),
      className: 'is-hidden-stems',
    },
    {
      label: '纳音',
      values: boardColumns.map((column) => (
        <span
          key={column.key}
          className={column.nayin && column.nayin !== '—' ? 'is-clickable-term' : ''}
          onClick={() =>
            column.nayin &&
            column.nayin !== '—' &&
            handleOpenBaziTerm(column.nayin, column)
          }
          title={column.nayin && column.nayin !== '—' ? `点击查看【${column.nayin}】释义` : undefined}
        >
          {column.nayin}
        </span>
      )),
    },
    {
      label: '自坐',
      values: boardColumns.map((column) => (
        <span
          key={column.key}
          className={column.ziZuo && column.ziZuo !== '—' ? 'is-clickable-term' : ''}
          onClick={() =>
            column.ziZuo &&
            column.ziZuo !== '—' &&
            handleOpenBaziTerm(column.ziZuo || '十二长生', column)
          }
          title={column.ziZuo && column.ziZuo !== '—' ? `点击查看【${column.ziZuo}】释义` : undefined}
        >
          {column.ziZuo}
        </span>
      )),
    },
    {
      label: '长生',
      values: boardColumns.map((column) => (
        <span
          key={column.key}
          className="is-clickable-term"
          onClick={() => handleOpenBaziTerm(column.lifeStage || '十二长生', column)}
        >
          {column.lifeStage}
        </span>
      )),
    },
    {
      label: '空亡',
      values: boardColumns.map((column) => (
        <span
          key={column.key}
          className={column.kongWang.length ? 'is-clickable-term' : ''}
          onClick={() => column.kongWang.length && handleOpenBaziTerm('旬空', column)}
        >
          {joinMultilineText(column.kongWang, '无')}
        </span>
      )),
      className: 'is-multiline',
    },
    {
      label: '神煞',
      values: boardColumns.map((column) => (
        <BaziShenShaList
          items={column.shensha}
          key={column.key}
          onOpenTerm={(t) => handleOpenBaziTerm(t, column)}
        />
      )),
      className: 'is-shensha',
    },
  ].filter((row) => !isInstant || row.label !== '神煞');

  return (
    <section className="result-showcase-card bazi-showcase-card traditional-chart-layout">
      <div className="result-showcase-head">
        <div>
          <p className="result-section-kicker">{title}</p>
          <h2>{name}</h2>
        </div>
        <div className="result-chip-row">
          {!isInstant ? <span className="result-chip">{formatGender(result.gender)}</span> : null}
          {isInstant && timeBasisLabel ? (
            <span className="result-chip is-accent">{timeBasisLabel}</span>
          ) : null}
          {result.timeInfo.isTrueSolarTime ? (
            <span className="result-chip">真太阳时校正</span>
          ) : null}
        </div>
      </div>

      {warnings.length ? (
        <div className="bazi-warning-list" role="alert">
          {warnings.map((warning) => (
            <div className="bazi-warning-item" key={warning}>
              <strong>排盘预警</strong>
              <span>{warning}</span>
            </div>
          ))}
        </div>
      ) : null}

      {!isInstant ? (
        <div className="result-summary-grid result-summary-grid-bazi">
          <div
            className="result-stat-card result-stat-card-accent is-clickable-term"
            onClick={() => openTerm('身旺')}
          >
            <span>旺衰</span>
            <strong>{result.analysis.dayMasterStrength.status}</strong>
            <small>
              月令{result.analysis.dayMasterStrength.details.seasonalEffect} ·{' '}
              {result.analysis.dayMasterStrength.details.hasRoot ? '有根' : '无根'}
            </small>
          </div>
          <div
            className="result-stat-card is-clickable-term"
            onClick={() => openTerm(result.analysis.mingGe.pattern || '格局')}
          >
            <span>命格</span>
            <strong>{result.analysis.mingGe.pattern}</strong>
            <small>{result.analysis.mingGe.isSpecial ? '特殊格局' : '月令取格'}</small>
          </div>
          <div
            className="result-stat-card is-clickable-term"
            onClick={() =>
              openTerm(
                result.analysis.usefulGod.primaryUseful ||
                  result.analysis.usefulGod.useful ||
                '调候用神',
              )
            }
          >
            <span>核心用神</span>
            <strong>
              {result.analysis.usefulGod.primaryUseful ||
                result.analysis.usefulGod.useful ||
                '待定'}
            </strong>
            <small>{formatUsefulGodPrioritySummary(result)}</small>
          </div>
          <div
            className="result-stat-card is-clickable-term"
            onClick={() =>
              openTerm(
                result.analysis.usefulGod.primaryAvoid ||
                  result.analysis.usefulGod.avoid ||
                '忌神',
              )
            }
          >
            <span>核心忌神</span>
            <strong>
              {result.analysis.usefulGod.primaryAvoid || result.analysis.usefulGod.avoid || '待定'}
            </strong>
            <small>{formatAvoidGodPrioritySummary(result)}</small>
          </div>
        </div>
      ) : null}

      <div className="bazi-core-layout">
        <div className="bazi-pillars-card">
          <div
            className="bazi-pillars-header"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <h3>四柱盘</h3>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className="bazi-share-chart-btn"
                onClick={() => setIsShareModalOpen(true)}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-soft)',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                分享排盘
              </button>
            </div>
          </div>
          <div className="bazi-pillars-scroll">
            <div
              className={`bazi-pillars-table ${activeFortuneColumns.length ? 'has-fortune' : ''}`}
              style={boardStyle}
            >
              <div className="bazi-pillars-cell is-label is-head">信息</div>
              {boardColumns.map((column, index) => (
                <div
                  className={`bazi-pillars-cell is-head ${
                    column.isDayMaster ? 'is-day-master' : ''
                  } ${index === natalColumns.length ? 'is-fortune-start' : ''}`}
                  key={column.key}
                >
                  <span>{column.label}</span>
                  {column.caption ? <small>{column.caption}</small> : null}
                </div>
              ))}
              {pillarRows.flatMap((row) => [
                <div key={`${row.label}-label`} className="bazi-pillars-cell is-label">
                  {row.label}
                </div>,
                ...row.values.map((value, index) => (
                  <div
                    key={`${row.label}-${index}`}
                    className={`bazi-pillars-cell ${row.className ?? ''} ${
                      boardColumns[index]?.isDayMaster ? 'is-day-master' : ''
                    } ${index === natalColumns.length ? 'is-fortune-start' : ''}`}
                  >
                    {value}
                  </div>
                )),
              ])}
            </div>
          </div>
        </div>
      </div>

      {/* 岁运选择器：大运、流年、流月、流日 */}
      {!isInstant ? (
        <div className="bazi-fortune-board" style={{ marginTop: '12px' }}>
          <BaziFortuneSelector result={result} onSelectionChange={setFortuneColumns} />
        </div>
      ) : null}

      {/* 原局与岁运干支作用全景 · 刑冲合害会（紧贴岁运选择器下方，方便同步合参） */}
      {interactions.length > 0 ? (
        <div
          className="traditional-classic-card bazi-interactions-card"
          style={{ marginTop: '12px' }}
        >
          <div
            className="traditional-classic-head"
            onClick={() => setInteractionsExpanded(!interactionsExpanded)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ')
                setInteractionsExpanded(!interactionsExpanded);
            }}
            role="button"
            tabIndex={0}
          >
            <div>
              <span
                className="traditional-classic-badge is-clickable-term"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenTerm('天干五合');
                }}
              >
                命理枢机
              </span>
              <strong>原局与岁运干支作用全景 · 刑冲合害会（{interactions.length}项）</strong>
            </div>
            <span className="traditional-classic-toggle">
              {interactionsExpanded ? '收起作用 ▴' : '展开作用 ▾'}
            </span>
          </div>
          {interactionsExpanded ? (
            <div className="traditional-classic-body bazi-interactions-body">
              <div className="bazi-interactions-grid">
                {interactions.map((item) => (
                  <div
                    className={`bazi-interaction-card is-${item.tone} is-clickable-term`}
                    key={item.id}
                    onClick={() => handleOpenTerm(item.category || item.name)}
                    title={`点击查看【${item.name}】释义`}
                  >
                    <div className="bazi-interaction-head">
                      <span className={`bazi-interaction-badge is-${item.tone}`}>
                        {item.category}
                      </span>
                      <strong>{item.name}</strong>
                      <small className="bazi-interaction-pillars">
                        （{item.pillars.join(' · ')}）
                      </small>
                    </div>
                    <p className="bazi-interaction-summary">{item.classicSummary}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {pillarRelationGroups.length ? (
        <div className="bazi-structure-strip" aria-label="原局干支关系">
          {pillarRelationGroups.map((group) => (
            <div
              key={group.label}
              className="is-clickable-term"
              onClick={() => openTerm(group.label)}
              title={`点击查看【${group.label}】释义`}
            >
              <span>{group.label}</span>
              <strong>{group.items.join('；')}</strong>
            </div>
          ))}
        </div>
      ) : null}

      <div className="bazi-context-grid">
        <div className="result-side-card bazi-fortune-card">
          <div className="result-side-head">
            <h3>五行分布</h3>
          </div>
          <div className="result-tag-cloud">
            {result.wuxingStrength.present.map((item) => (
              <span
                className="result-soft-tag is-clickable-term"
                key={item}
                onClick={() => openTerm(item)}
                title={`点击查看【${item}】释义`}
              >
                见 {item}
                {result.wuxingStrength.dominantByRule.includes(item) ? '（结构比较优先）' : ''}
              </span>
            ))}
            {missingElements.map((item) => (
              <span
                className="result-soft-tag is-clickable-term"
                key={item}
                onClick={() => openTerm(item)}
                title={`点击查看【缺${item}】释义`}
              >
                缺 {item}
              </span>
            ))}
          </div>
        </div>

        {referenceItems.length > 0 ? (
          <div className="result-side-card bazi-reference-card">
            <div className="result-side-head">
              <h3>基础参考</h3>
            </div>
            <div className="bazi-reference-grid">
              {referenceItems.map((item) => (
                <div
                  className="bazi-reference-item is-clickable-term"
                  key={item.label}
                  onClick={() => openTerm(item.label)}
                  title={`点击查看【${item.label}】释义`}
                >
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <small>{item.detail}</small>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {qiongtongAdvice ? (
        <div className="traditional-classic-card bazi-qiongtong-card">
          <div
            className="traditional-classic-head"
            onClick={() => setQiongtongExpanded(!qiongtongExpanded)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') setQiongtongExpanded(!qiongtongExpanded);
            }}
            role="button"
            tabIndex={0}
          >
            <div>
              <span className="traditional-classic-badge">穷通宝鉴</span>
              <strong>
                {dayMasterGan}日主生于{monthBranchZhi}月 · 调候用神
              </strong>
            </div>
            <span className="traditional-classic-toggle">
              {qiongtongExpanded ? '收起典籍 ▴' : '展开典籍 ▾'}
            </span>
          </div>
          {qiongtongExpanded ? (
            <div className="traditional-classic-body">
              <p className="traditional-classic-verse">{qiongtongAdvice.classicVerse}</p>
              <p className="traditional-classic-advice">
                {`【调候要领】${qiongtongAdvice.modernExplanation}`}
                {qiongtongAdvice.primaryGods?.length
                  ? `\n【核心喜用】优先取：${qiongtongAdvice.primaryGods.join('、')}`
                  : ''}
                {qiongtongAdvice.taboos?.length
                  ? `\n【格局忌讳】防范：${qiongtongAdvice.taboos.join('、')}`
                  : ''}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {ditiansuiAdvice ? (
        <div className="traditional-classic-card bazi-ditiansui-card">
          <div
            className="traditional-classic-head"
            onClick={() => setDitiansuiExpanded(!ditiansuiExpanded)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') setDitiansuiExpanded(!ditiansuiExpanded);
            }}
            role="button"
            tabIndex={0}
          >
            <div>
              <span className="traditional-classic-badge">滴天髓</span>
              <strong>
                {dayMasterGan}木{ditiansuiAdvice.wuxing} · 十干体象与性情
              </strong>
            </div>
            <span className="traditional-classic-toggle">
              {ditiansuiExpanded ? '收起典籍 ▴' : '展开典籍 ▾'}
            </span>
          </div>
          {ditiansuiExpanded ? (
            <div className="traditional-classic-body">
              <p className="traditional-classic-verse">{ditiansuiAdvice.verse}</p>
              <p className="traditional-classic-advice">
                {`【原典精解】${ditiansuiAdvice.nature}`}
                {`\n【行运指引】${ditiansuiAdvice.modernAdvice}`}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {zipingAdvice ? (
        <div className="traditional-classic-card bazi-ziping-card">
          <div
            className="traditional-classic-head"
            onClick={() => setZipingExpanded(!zipingExpanded)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') setZipingExpanded(!zipingExpanded);
            }}
            role="button"
            tabIndex={0}
          >
            <div>
              <span className="traditional-classic-badge">子平真诠</span>
              <strong>{zipingAdvice.pattern} · 格局精义</strong>
            </div>
            <span className="traditional-classic-toggle">
              {zipingExpanded ? '收起典籍 ▴' : '展开典籍 ▾'}
            </span>
          </div>
          {zipingExpanded ? (
            <div className="traditional-classic-body">
              {zipingAdvice.verse ? (
                <p className="traditional-classic-verse">{zipingAdvice.verse}</p>
              ) : null}
              <p className="traditional-classic-advice">
                {`【格局要义】${zipingAdvice.rule}`}
                {`\n【现代解析】${zipingAdvice.modernAdvice}`}
                {zipingAdvice.taboos?.length
                  ? `\n【破格防范】${zipingAdvice.taboos.join('、')}`
                  : ''}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {isShareModalOpen ? (
        <ChartShareModal
          chartTitle={`八字排盘 · ${name}`}
          chartMethodName="八字命理"
          chartText={formatBaziChartText()}
          timeLabel={formatBaziDate(result)}
          extraMeta={[
            { label: '造别', value: formatGender(result.gender) },
            { label: '格局', value: result.analysis.mingGe.pattern },
            { label: '旺衰', value: result.analysis.dayMasterStrength.status },
            {
              label: '核心用神',
              value:
                result.analysis.usefulGod.primaryUseful ||
                result.analysis.usefulGod.useful ||
                '无',
            },
          ]}
          onClose={() => setIsShareModalOpen(false)}
        />
      ) : null}
    </section>
  );
});
