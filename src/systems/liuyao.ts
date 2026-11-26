import type { z } from 'zod';
import { castLiuyao, castYarrow } from './liuyao/cast';
import {
  classifyLiuyaoVoidStatus,
  evaluateLiuyaoMonthBreakStatus,
  generateLiuyaoChart,
} from './liuyao/chart';
import { analyzeLiuyaoEvidence } from './liuyao/evidence';
import type { LiuyaoData } from './liuyao/types';
import { EARTHLY_BRANCHES, getBranchIndex, getBranchWuxing, isChong, isHe, isKe, isSheng, isXing } from './calendar';
import type { liuyaoInput } from '../schema';
import { sameJsonValue } from '../json-value';
import { formatSchoolGuidance, resolvePromptSelection } from '../prompt-selection';
import { formatClassicExcerpts, selectLiuyaoClassics } from './classics';
import reference from './liuyao-reference.json';
import { parseQuestionContext } from './question-context';
import { buildMethodSituationDigest } from './situation-digest';

type Input = z.infer<typeof liuyaoInput>;
type Options = Input['prompt'];

type Evidence = ReturnType<typeof analyzeLiuyaoEvidence>;

const LIUYAO_GUIREN_MAP: Record<string, readonly string[]> = {
  甲: ['丑', '未'], 戊: ['丑', '未'], 庚: ['丑', '未'],
  乙: ['子', '申'], 己: ['子', '申'],
  丙: ['亥', '酉'], 丁: ['亥', '酉'],
  壬: ['卯', '巳'], 癸: ['卯', '巳'],
  辛: ['午', '寅'],
};
const LIUYAO_LUSHEN_MAP: Record<string, string> = {
  甲: '寅', 乙: '卯', 丙: '巳', 戊: '巳', 丁: '午', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子',
};
const LIUYAO_YANGREN_MAP: Record<string, string> = {
  甲: '卯', 乙: '寅', 丙: '午', 戊: '午', 丁: '巳', 己: '巳', 庚: '酉', 辛: '申', 壬: '子', 癸: '亥',
};
const LIUYAO_WENCHANG_MAP: Record<string, string> = {
  甲: '巳', 乙: '午', 丙: '申', 戊: '申', 丁: '酉', 己: '酉', 庚: '亥', 辛: '子', 壬: '寅', 癸: '卯',
};
const SANHE_SHENSHA_MAP: Record<string, { yima: string; taohua: string; huagai: string; jiangxing: string; jiesha: string; zaisha: string; mouxing: string }> = {
  申: { yima: '寅', taohua: '酉', huagai: '辰', jiangxing: '子', jiesha: '巳', zaisha: '午', mouxing: '戌' },
  子: { yima: '寅', taohua: '酉', huagai: '辰', jiangxing: '子', jiesha: '巳', zaisha: '午', mouxing: '戌' },
  辰: { yima: '寅', taohua: '酉', huagai: '辰', jiangxing: '子', jiesha: '巳', zaisha: '午', mouxing: '戌' },
  寅: { yima: '申', taohua: '卯', huagai: '戌', jiangxing: '午', jiesha: '亥', zaisha: '子', mouxing: '辰' },
  午: { yima: '申', taohua: '卯', huagai: '戌', jiangxing: '午', jiesha: '亥', zaisha: '子', mouxing: '辰' },
  戌: { yima: '申', taohua: '卯', huagai: '戌', jiangxing: '午', jiesha: '亥', zaisha: '子', mouxing: '辰' },
  巳: { yima: '亥', taohua: '午', huagai: '丑', jiangxing: '酉', jiesha: '寅', zaisha: '卯', mouxing: '未' },
  酉: { yima: '亥', taohua: '午', huagai: '丑', jiangxing: '酉', jiesha: '寅', zaisha: '卯', mouxing: '未' },
  丑: { yima: '亥', taohua: '午', huagai: '丑', jiangxing: '酉', jiesha: '寅', zaisha: '卯', mouxing: '未' },
  亥: { yima: '巳', taohua: '子', huagai: '未', jiangxing: '卯', jiesha: '申', zaisha: '酉', mouxing: '丑' },
  卯: { yima: '巳', taohua: '子', huagai: '未', jiangxing: '卯', jiesha: '申', zaisha: '酉', mouxing: '丑' },
  未: { yima: '巳', taohua: '子', huagai: '未', jiangxing: '卯', jiesha: '申', zaisha: '酉', mouxing: '丑' },
};
const MONTH_TIANXI_MAP: Record<string, string> = {
  寅: '戌', 卯: '戌', 辰: '戌',
  巳: '丑', 午: '丑', 未: '丑',
  申: '辰', 酉: '辰', 戌: '辰',
  亥: '未', 子: '未', 丑: '未',
};

function buildLiuyaoGuaShenAndShenshaSummary(data: LiuyaoData): string {
  const gs = data.guaShen;
  const gsVoid = gs && data.voidBranches.includes(gs.branch) ? '（逢旬空）' : '';
  const guaShenLine = !gs
    ? '月卦身：伏藏未上主卦（《卜筮正宗》以卦身不现主事体未显或尚缺依托）。'
    : typeof gs.position === 'number'
      ? `月卦身：${gs.branch}（${gs.sixRelative}），落第${gs.position}爻${gsVoid}。`
      : `月卦身：${gs.branch}（${gs.sixRelative}），伏藏未上主卦${gsVoid}（《卜筮正宗》以卦身不现主事体未显或尚缺依托）。`;

  const shiYao = data.yaosDetail.find((y) => y.isWorld);
  const yingYao = data.yaosDetail.find((y) => y.isResponse);
  let shiYingLine = '';
  if (shiYao && yingYao) {
    const elemRel =
      shiYao.wuxing === yingYao.wuxing
        ? '世应比和'
        : isSheng(shiYao.wuxing, yingYao.wuxing)
          ? '世生应（我生彼，主我方主动付出或迁就）'
          : isSheng(yingYao.wuxing, shiYao.wuxing)
            ? '应生世（彼生我，主他方助益或事就我）'
            : isKe(shiYao.wuxing, yingYao.wuxing)
              ? '世克应（我克彼，主我方掌控或主动求取）'
              : '应克世（彼克我，主外境施压或对方占优）';
    const branchInteraction: string[] = [];
    if (isHe(shiYao.najiaDizhi, yingYao.najiaDizhi)) branchInteraction.push('世应六合');
    if (isChong(shiYao.najiaDizhi, yingYao.najiaDizhi)) branchInteraction.push('世应六冲');
    if (isXing(shiYao.najiaDizhi, yingYao.najiaDizhi)) branchInteraction.push('世应相刑');
    shiYingLine = `世应枢机：世居第${shiYao.position}爻${shiYao.sixRelative}${shiYao.najiaDizhi}${shiYao.wuxing}（${shiYao.sixGod}），应居第${yingYao.position}爻${yingYao.sixRelative}${yingYao.najiaDizhi}${yingYao.wuxing}（${yingYao.sixGod}）；${elemRel}${branchInteraction.length ? `，${branchInteraction.join('、')}` : ''}。`;
  }

  const dayStem = data.ganzhi.day[0] ?? '';
  const dayBranch = data.ganzhi.day[1] ?? '';
  const monthBranch = data.ganzhi.month[1] ?? '';
  const monthIdx = getBranchIndex(monthBranch);
  const tianyiBranch = monthIdx >= 0 ? EARTHLY_BRANCHES[(monthIdx + 11) % 12] : '';
  const tianxiBranch = MONTH_TIANXI_MAP[monthBranch] ?? '';
  const sanhe = SANHE_SHENSHA_MAP[dayBranch];

  const locateBranches = (branches: readonly string[]) => {
    const hits = data.yaosDetail
      .filter((y) => branches.includes(y.najiaDizhi))
      .map((y) => `${y.position}爻${y.sixRelative}${y.najiaDizhi}`);
    return hits.length ? `［临${hits.join('/')}］` : '';
  };

  const shenshaParts: string[] = [];
  const guiren = LIUYAO_GUIREN_MAP[dayStem];
  if (guiren) shenshaParts.push(`天乙贵人${guiren.join('、')}${locateBranches(guiren)}`);
  const lushen = LIUYAO_LUSHEN_MAP[dayStem];
  if (lushen) shenshaParts.push(`禄神${lushen}${locateBranches([lushen])}`);
  const yangren = LIUYAO_YANGREN_MAP[dayStem];
  if (yangren) shenshaParts.push(`羊刃${yangren}${locateBranches([yangren])}`);
  const wenchang = LIUYAO_WENCHANG_MAP[dayStem];
  if (wenchang) shenshaParts.push(`文昌${wenchang}${locateBranches([wenchang])}`);
  if (sanhe) {
    shenshaParts.push(`驿马${sanhe.yima}${locateBranches([sanhe.yima])}`);
    shenshaParts.push(`桃花${sanhe.taohua}${locateBranches([sanhe.taohua])}`);
    shenshaParts.push(`华盖${sanhe.huagai}${locateBranches([sanhe.huagai])}`);
    shenshaParts.push(`将星${sanhe.jiangxing}${locateBranches([sanhe.jiangxing])}`);
    shenshaParts.push(`谋星${sanhe.mouxing}${locateBranches([sanhe.mouxing])}`);
    shenshaParts.push(`劫煞${sanhe.jiesha}${locateBranches([sanhe.jiesha])}`);
    shenshaParts.push(`灾煞${sanhe.zaisha}${locateBranches([sanhe.zaisha])}`);
  }
  if (tianyiBranch) shenshaParts.push(`天医（月）${tianyiBranch}${locateBranches([tianyiBranch])}`);
  if (tianxiBranch) shenshaParts.push(`天喜（月）${tianxiBranch}${locateBranches([tianxiBranch])}`);

  return [
    guaShenLine,
    shiYingLine,
    shenshaParts.length ? `常用神煞：${shenshaParts.join('；')}。` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildLiuyaoPatternRelations(data: LiuyaoData, evidence: Evidence): string {
  const monthBranch = data.ganzhi.month[1] ?? '';
  const dayBranch = data.ganzhi.day[1] ?? '';
  const monthElem = monthBranch ? getBranchWuxing(monthBranch) : '';
  const dayElem = dayBranch ? getBranchWuxing(dayBranch) : '';

  const movingYaos = data.yaosDetail.filter((y) => y.isChanging);
  const hiddenMoveYaos = data.yaosDetail.filter((y) => !y.isChanging && y.isHiddenMove);
  const activeYaos = [...movingYaos, ...hiddenMoveYaos];

  // 1. 主线格局与世应关系
  const motionPattern = data.specialPattern
    ? data.specialPattern
    : movingYaos.length === 1
      ? `独发（第${movingYaos[0].position}爻${movingYaos[0].sixRelative}${movingYaos[0].najiaDizhi}发动）`
      : `多动（共${movingYaos.length}爻明动：${movingYaos.map((y) => `第${y.position}爻${y.sixRelative}${y.najiaDizhi}`).join('、')}）`;
  const structureTags: string[] = [motionPattern];
  if (hiddenMoveYaos.length) {
    structureTags.push(
      `暗动${hiddenMoveYaos.map((y) => `第${y.position}爻${y.sixRelative}${y.najiaDizhi}`).join('、')}`,
    );
  }
  if (data.hexagramRelations?.transition) {
    structureTags.push(data.hexagramRelations.transition);
  } else {
    if (data.hexagramRelations?.original) structureTags.push(`主卦${data.hexagramRelations.original}`);
    if (data.hexagramRelations?.changed) structureTags.push(`变卦${data.hexagramRelations.changed}`);
  }
  if (data.fanfuRelations?.labels?.length) {
    structureTags.push(data.fanfuRelations.labels.join('、'));
  }
  if (data.sanheWithDay) structureTags.push(`日合${data.sanheWithDay.group}`);
  if (data.sanheWithMonth) structureTags.push(`月合${data.sanheWithMonth.group}`);

  const shiYao = data.yaosDetail.find((y) => y.isWorld);
  const yingYao = data.yaosDetail.find((y) => y.isResponse);
  let shiYingText = '';
  if (shiYao && yingYao) {
    const rel =
      shiYao.wuxing === yingYao.wuxing
        ? '世应比和'
        : isSheng(shiYao.wuxing, yingYao.wuxing)
          ? '世生应'
          : isSheng(yingYao.wuxing, shiYao.wuxing)
            ? '应生世'
            : isKe(shiYao.wuxing, yingYao.wuxing)
              ? '世克应'
              : '应克世';
    const branchTags = [
      isHe(shiYao.najiaDizhi, yingYao.najiaDizhi) ? '六合' : '',
      isChong(shiYao.najiaDizhi, yingYao.najiaDizhi) ? '六冲' : '',
      isXing(shiYao.najiaDizhi, yingYao.najiaDizhi) ? '相刑' : '',
    ].filter(Boolean);
    shiYingText = `世爻（第${shiYao.position}爻${shiYao.sixRelative}${shiYao.najiaDizhi}${shiYao.wuxing}）与应爻（第${yingYao.position}爻${yingYao.sixRelative}${yingYao.najiaDizhi}${yingYao.wuxing}）呈${rel}${branchTags.length ? `兼${branchTags.join('、')}` : ''}`;
  }
  const mainPatternLine = `- 主线格局与世应：${structureTags.join('；')}${shiYingText ? `；${shiYingText}` : ''}。`;

  // 确定核对主轴：选定用神优先，否则以世爻为主轴
  const selectedCandidate = evidence.selectionFact.selectedCandidateKey
    ? evidence.candidates.find((c) => c.key === evidence.selectionFact.selectedCandidateKey)
    : undefined;
  const targetVisibleYaos = selectedCandidate
    ? selectedCandidate.references
        .filter((r) => r.source === '本卦')
        .map((r) => data.yaosDetail.find((y) => y.position === r.position))
        .filter((y): y is NonNullable<typeof y> => Boolean(y))
    : shiYao
      ? [shiYao]
      : [];
  const targetHiddenSpirits = selectedCandidate
    ? selectedCandidate.references
        .filter((r) => r.source === '伏神')
        .map((r) =>
          (data.hiddenSpirits ?? []).find(
            (h) => h.position === r.position && h.sixRelative === r.sixRelative,
          ),
        )
        .filter((h): h is NonNullable<typeof h> => Boolean(h))
    : [];
  const targetLabel = selectedCandidate
    ? `用神${selectedCandidate.label}`
    : shiYao
      ? `世爻第${shiYao.position}爻${shiYao.sixRelative}${shiYao.najiaDizhi}`
      : '主轴爻';
  const targetElem =
    targetVisibleYaos[0]?.wuxing ?? targetHiddenSpirits[0]?.wuxing ?? shiYao?.wuxing ?? '';

  const supportChain: string[] = [];
  const resistanceChain: string[] = [];
  const rescueConditions: string[] = [];

  // 2. 逐个核对主轴明爻的成事链与阻力链
  for (const yao of targetVisibleYaos) {
    const tag = `第${yao.position}爻${yao.sixRelative}${yao.najiaDizhi}${yao.wuxing}`;
    const yaoSupports: string[] = [];
    const yaoResists: string[] = [];

    if (yao.seasonState === '旺' || yao.seasonState === '相') yaoSupports.push(`月令${yao.seasonState}`);
    else if (yao.seasonState) yaoResists.push(`月令${yao.seasonState}`);

    if (yao.najiaDizhi === monthBranch) yaoSupports.push('值月建');
    else if (monthElem && isSheng(monthElem, yao.wuxing)) yaoSupports.push(`月建${monthBranch}生扶`);
    else if (monthElem && isKe(monthElem, yao.wuxing)) yaoResists.push(`月建${monthBranch}克制`);

    if (yao.najiaDizhi === dayBranch) yaoSupports.push('值日辰');
    else if (dayElem && isSheng(dayElem, yao.wuxing)) yaoSupports.push(`日辰${dayBranch}生扶`);
    else if (dayElem && isKe(dayElem, yao.wuxing)) yaoResists.push(`日辰${dayBranch}克制`);

    if (isHe(yao.najiaDizhi, monthBranch)) yaoSupports.push('合月建');
    if (isHe(yao.najiaDizhi, dayBranch)) yaoSupports.push('合日辰');

    if (yao.isChanging) {
      const rels = yao.changeRelations ?? [];
      if (yao.changeDirection === '化进神') yaoSupports.push('发动化进神');
      if (rels.includes('回头生')) yaoSupports.push('化回头生');
      if (yao.changedLifeStage === '长生' || yao.changedLifeStage === '帝旺') {
        yaoSupports.push(`化${yao.changedLifeStage}`);
      }
      if (rels.includes('回头克')) yaoResists.push('化回头克');
      if (rels.includes('回头冲')) yaoResists.push('化回头冲');
      if (yao.changeDirection === '化退神') yaoResists.push('化退神');
      if (yao.isHuaMu) yaoResists.push('动而化墓');
      if (yao.changedLifeStage === '绝') yaoResists.push('动而化绝');
      if (rels.includes('化空') || yao.changedYao?.isVoid) yaoResists.push('化空');
    }

    if (yao.isMonthBreak) {
      yaoResists.push('月破');
      const mb = evaluateLiuyaoMonthBreakStatus({ yao, dayBranch, activeYaos });
      rescueConditions.push(`${tag}月破：${mb.condition}`);
    }
    if (yao.isDayBreak) yaoResists.push('日破');
    if (yao.isRiMu) yaoResists.push('入日墓');
    if (yao.isDongMu) yaoResists.push('入动墓');
    if (yao.isVoid) {
      const va = classifyLiuyaoVoidStatus({ yao, monthBranch, dayBranch, activeYaos });
      yaoResists.push(`旬空（${va.status}）`);
      rescueConditions.push(`${tag}${va.status}（${va.reasons.join('、')}）：${va.condition}`);
    }

    if (yaoSupports.length) supportChain.push(`${tag}得${yaoSupports.join('、')}`);
    if (yaoResists.length) resistanceChain.push(`${tag}见${yaoResists.join('、')}`);
  }

  // 3. 核对伏神飞伏生克与出伏条件
  for (const hidden of targetHiddenSpirits) {
    const hTag = `伏神第${hidden.position}爻${hidden.sixRelative}${hidden.najiaDizhi}${hidden.wuxing}`;
    const fTag = `飞神${hidden.underYao.sixRelative}${hidden.underYao.najiaDizhi}${hidden.underYao.wuxing}`;
    if (isSheng(hidden.underYao.wuxing, hidden.wuxing)) {
      supportChain.push(`${hTag}得${fTag}飞神生伏`);
    } else if (isKe(hidden.underYao.wuxing, hidden.wuxing)) {
      resistanceChain.push(`${hTag}受${fTag}飞神克伏`);
    } else if (isSheng(hidden.wuxing, hidden.underYao.wuxing)) {
      resistanceChain.push(`${hTag}生${fTag}泄气`);
    } else if (isKe(hidden.wuxing, hidden.underYao.wuxing)) {
      supportChain.push(`${hTag}克${fTag}（伏克飞为出暴）`);
    }
    if (monthElem && (isSheng(monthElem, hidden.wuxing) || monthElem === hidden.wuxing)) {
      supportChain.push(`${hTag}得月建${monthBranch}生扶`);
    }
    if (dayElem && (isSheng(dayElem, hidden.wuxing) || dayElem === hidden.wuxing)) {
      supportChain.push(`${hTag}得日辰${dayBranch}生扶`);
    }
    const flyingLine = data.yaosDetail.find((y) => y.position === hidden.position);
    const emergeHints: string[] = [];
    if (flyingLine?.isVoid) emergeHints.push('飞神旬空');
    if (flyingLine?.isMonthBreak) emergeHints.push('飞神月破');
    if (flyingLine?.isDayBreak || flyingLine?.isDayClash) emergeHints.push('飞神受日冲');
    if (hidden.isVoid) {
      resistanceChain.push(`${hTag}逢旬空`);
      emergeHints.push('伏神待出空');
    }
    rescueConditions.push(
      `${hTag}伏藏于${fTag}下${emergeHints.length ? `（现见${emergeHints.join('、')}）` : ''}：出伏须待飞神受冲克/空破或伏神得月日旺相生扶透出`,
    );
  }

  // 4. 核对卦中明动/暗动爻（原神/忌神/仇神）对主轴的作用与通关/自损救应
  if (targetElem) {
    const activeYuanShen = activeYaos.filter(
      (y) => !targetVisibleYaos.some((t) => t.position === y.position) && isSheng(y.wuxing, targetElem),
    );
    const activeJiShen = activeYaos.filter(
      (y) => !targetVisibleYaos.some((t) => t.position === y.position) && isKe(y.wuxing, targetElem),
    );

    for (const ys of activeYuanShen) {
      const mode = ys.isChanging ? '明动' : '暗动';
      const selfImpair =
        ys.isMonthBreak ||
        ys.isVoid ||
        ys.changeRelations?.includes('回头克') ||
        ys.changeDirection === '化退神';
      supportChain.push(
        `原神第${ys.position}爻${ys.sixRelative}${ys.najiaDizhi}${ys.wuxing}${mode}生扶${targetLabel}${selfImpair ? '（但原神自身带空破/退克，生力打折）' : ''}`,
      );
    }

    for (const js of activeJiShen) {
      const mode = js.isChanging ? '明动' : '暗动';
      const jsRels = js.changeRelations ?? [];
      const selfImpairTags = [
        jsRels.includes('回头克') ? '化回头克' : '',
        js.changeDirection === '化退神' ? '化退神' : '',
        jsRels.includes('化空') || js.changedYao?.isVoid ? '化空' : '',
        js.changedLifeStage === '绝' ? '化绝' : '',
        js.isMonthBreak ? '月破' : '',
        js.isVoid ? '自身旬空' : '',
      ].filter(Boolean);
      resistanceChain.push(
        `忌神第${js.position}爻${js.sixRelative}${js.najiaDizhi}${js.wuxing}${mode}克制${targetLabel}`,
      );
      if (selfImpairTags.length) {
        rescueConditions.push(
          `忌神第${js.position}爻${js.sixRelative}${js.najiaDizhi}虽动但见${selfImpairTags.join('、')}，克制${targetLabel}之力受限`,
        );
      }
    }

    // 贪生忘克 / 原神通关：忌神动克用神，且原神同动（忌神五行必生原神五行）
    if (activeJiShen.length > 0 && activeYuanShen.length > 0) {
      const jsList = activeJiShen.map((y) => `第${y.position}爻${y.sixRelative}${y.najiaDizhi}${y.wuxing}`).join('、');
      const ysList = activeYuanShen.map((y) => `第${y.position}爻${y.sixRelative}${y.najiaDizhi}${y.wuxing}`).join('、');
      rescueConditions.push(
        `贪生忘克通关：忌神${jsList}发动，但原神${ysList}同动通关，形成“忌神生原神→原神生${targetLabel}”转化链`,
      );
    }
  }

  // 非主轴动爻若落旬空也提示虚实
  for (const yao of activeYaos) {
    if (yao.isVoid && !targetVisibleYaos.some((t) => t.position === yao.position)) {
      const va = classifyLiuyaoVoidStatus({ yao, monthBranch, dayBranch, activeYaos });
      rescueConditions.push(
        `动爻第${yao.position}爻${yao.sixRelative}${yao.najiaDizhi}逢${va.status}（${va.reasons.join('、')}）：${va.condition}`,
      );
    }
  }

  if (activeYaos.length === 0) {
    rescueConditions.push('静卦无明动与暗动爻，生克制衡以月建、日辰、世应及伏神条件为主');
  }

  // 确定性应期地支候选窗（逢空填冲、月破逢合、合处逢冲、发动逢值/逢合、伏神冲飞）
  const CHONG_BRANCH: Record<string, string> = {
    子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅',
    卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳',
  };
  const HE_BRANCH: Record<string, string> = {
    子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯',
    辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午',
  };
  const yingQiHints: string[] = [];
  for (const yao of targetVisibleYaos.slice(0, 2)) {
    const z = yao.najiaDizhi;
    const chongZ = CHONG_BRANCH[z];
    const heZ = HE_BRANCH[z];
    if (data.voidBranches.includes(z)) {
      yingQiHints.push(`用神/主轴${z}逢空→待${z}（填实）或${chongZ}（冲空）月/日`);
    } else if (monthBranch && isChong(z, monthBranch)) {
      yingQiHints.push(`用神/主轴${z}月破→待${heZ}（合破）或${z}（出月填实）月/日`);
    } else if (isHe(z, dayBranch) || isHe(z, monthBranch)) {
      yingQiHints.push(`用神/主轴${z}逢合→待${chongZ}（合处逢冲）月/日引动`);
    } else if (yao.isChanging) {
      yingQiHints.push(`用神/主轴${z}发动→重点看${z}（逢值）或${heZ}（逢合）月/日`);
    } else {
      yingQiHints.push(`用神/主轴${z}静守→重点看${z}（值日/月）或${chongZ}（逢冲动起）`);
    }
  }
  for (const h of targetHiddenSpirits.slice(0, 1)) {
    const fly = data.yaosDetail.find((y) => y.position === h.position);
    const chongFly = fly ? CHONG_BRANCH[fly.najiaDizhi] : '';
    yingQiHints.push(
      `伏神${h.sixRelative}${h.najiaDizhi}→待${h.najiaDizhi}（值日透出）${chongFly ? `或${chongFly}（冲开飞神${fly?.najiaDizhi}）` : ''}月/日`,
    );
  }
  if (!yingQiHints.length && movingYaos.length === 1) {
    const m = movingYaos[0];
    yingQiHints.push(`独发第${m.position}爻${m.najiaDizhi}→看${m.najiaDizhi}（逢值）或${HE_BRANCH[m.najiaDizhi]}（逢合）月/日`);
  }

  return [
    mainPatternLine,
    `- 成事链（生扶与助力，主轴=${targetLabel}）：${supportChain.length ? supportChain.join('；') : '未见明显月日生扶或动变助益'}。`,
    `- 阻力链（克制与损耗，主轴=${targetLabel}）：${resistanceChain.length ? resistanceChain.join('；') : '未见明显忌神动克或空破退克阻力'}。`,
    `- 救应与转化条件：${rescueConditions.length ? rescueConditions.join('；') : '无特殊空破伏藏救应触发，按常规月日旺衰与动变直断'}。`,
    yingQiHints.length ? `- 应期地支候选窗：${yingQiHints.join('；')}。` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function buildPrompt(data: LiuyaoData, evidence: Evidence, question: string, options: Options, now: string, timeLabel = '起卦') {
  const selection = resolvePromptSelection('liuyao', options);
  const parsed = parseQuestionContext(question);
  const template = options?.liuyaoTemplate ?? (parsed.inferredTopic === 'ganqing' || parsed.inferredTopic === 'shiye' || parsed.inferredTopic === 'caifu' || parsed.inferredTopic === 'guaishen' ? parsed.inferredTopic : 'general');
  const schools = formatSchoolGuidance(options?.schools, reference.schools, {
    multiNote: '多口径合参：分别依据各口径判断，再比较共同点、分歧与对应卦爻依据。',
  });
  const classics = options?.includeClassics
    ? reference.classics.map((item) => `《${item.book}》·${item.chapter}：${item.summary}\n适用条件：${item.application}`).join('\n')
    : '';
  const zhouyi = options?.includeClassics ? (await import('./zhouyi-text')).hexagramClassics(data.originalName, data.changedName!, data.changingYaos.filter((line) => line.isChanging).map((line) => line.position)) : '';
  const actualChangeTypes: string[] = data.yaosDetail
    .filter((y) => y.isChanging)
    .flatMap((y) => [y.changeDirection, ...(y.changeRelations ?? [])])
    .filter((x): x is NonNullable<typeof x> => Boolean(x));
  const structSummary = evidence.structureFacts.map((s) => s.promptText).join(' ');
  const classicExcerpts = options?.includeClassics
    ? formatClassicExcerpts(
        selectLiuyaoClassics({
          movingCount: data.changingYaos.filter((line) => line.isChanging).length,
          hasFuShen: evidence.hiddenSpiritFacts.length > 0,
          category: parsed.liuyaoCategory ?? (template === 'general' ? undefined : template),
          changeTypes: actualChangeTypes,
          isSixClash: structSummary.includes('六冲'),
          isSixHarmony: structSummary.includes('六合'),
          fanFuYin: structSummary,
          originalHexagram: data.originalName,
          changedHexagram: data.changedName ?? data.originalName,
        }),
        '典籍片段',
      )
    : '';
  const digestLines = buildMethodSituationDigest('liuyao', { ...data, evidenceAnalysis: evidence }, question);
  const schoolAlgorithmsText = evidence.schoolAlgorithms?.length
    ? `【流派算法口径核验】\n${evidence.schoolAlgorithms.map((item) => `${item.label}：卦身口径＝${item.guaShenRule}；日冲口径＝${item.dayClashRule}；本盘核验：${item.findings.join('；')}。`).join('\n')}`
    : '';
  const sections = [
    '【传统依据】\n依八宫纳甲、六亲世应、月日旺衰与动变取证；用神须结合实际所问事项。',
    digestLines.length ? `【局势要点】\n${digestLines.join('\n')}` : '',
    `【时间】\n${timeLabel}：${new Date(data.timestamp).toISOString()}；时区偏移：UTC${(data.timezoneOffsetMinutes ?? 480) >= 0 ? '+' : '-'}${String(Math.floor(Math.abs(data.timezoneOffsetMinutes ?? 480) / 60)).padStart(2, '0')}:${String(Math.abs(data.timezoneOffsetMinutes ?? 480) % 60).padStart(2, '0')}；提示词时间：${now}。`,
    `【起卦方式】\n${evidence.generationFact.promptText}`,
    `【卦盘】\n主卦：${data.originalName}；变卦：${data.changedName}；互卦：${data.interName}；卦宫：${data.palace.name}（${data.palace.wuxing}），${data.palaceStage}。\n干支：${[data.ganzhi.year, data.ganzhi.month, data.ganzhi.day, data.ganzhi.hour].join(' ')}；旬空：${data.voidBranches.join('、')}；六爻值（初至上）：${data.yaoArray.join('、')}。\n${buildLiuyaoGuaShenAndShenshaSummary(data)}`,
    `【逐爻与伏神】\n${evidence.lineFacts.map((item) => item.promptText).join('\n')}${evidence.hiddenSpiritFacts.length ? `\n伏神：${evidence.hiddenSpiritFacts.map((item) => item.promptText).join('；')}` : '\n伏神：无已记录伏神。'}`,
    `【用神与作用链】\n${parsed.liuyaoRelativeReason ? `${parsed.liuyaoRelativeReason}\n` : ''}${evidence.selectionFact.promptText}\n${evidence.candidates.map((item) => item.promptText).join('\n')}${evidence.godChain.length ? `\n${evidence.godChain.map((item) => item.promptText).join('；')}` : ''}`,
    `【卦象组合与生克制衡关系】\n${buildLiuyaoPatternRelations(data, evidence)}`,
    evidence.structureFacts.length ? `【卦内结构】\n${evidence.structureFacts.map((item) => item.promptText).join('；')}` : '',
    evidence.counterEvidenceFacts.length ? `【反证条件】\n${evidence.counterEvidenceFacts.map((item) => item.promptText).join('；')}` : '',
    evidence.timingFacts.length ? `【应期条件】\n${evidence.timingFacts.map((item) => item.promptText).join('；')}` : '',
    `【问题范围】\n${reference.templates[template]}`,
    selection ? `【解读选择】\n${selection.section}` : '',
    schools,
    schoolAlgorithmsText,
    classics ? `【经典依据】\n${classics}` : '',
    zhouyi ? `【周易经文】\n${zhouyi}` : '',
    classicExcerpts,
    `【任务】\n围绕问题先定世应和用神候选，逐项核对月日、动变、空破、伏神及支持和反证；区分传统取义、现实事实和成立条件。${selection ? `\n${selection.task}` : ''}\n应期只按已列触发条件讨论，不将爻位或空亡机械换算成确定日期。`,
    `【问题】\n${question}`,
  ].filter(Boolean);
  const user = sections.join('\n\n');
  return { text: user };
}

export function reconstruct(data: LiuyaoData & { evidenceAnalysis?: unknown }) {
  if (!data || !Number.isSafeInteger(data.timestamp) || !Number.isFinite(new Date(data.timestamp).getTime()) || !Number.isInteger(data.timezoneOffsetMinutes) || data.timezoneOffsetMinutes! < -720 || data.timezoneOffsetMinutes! > 840 || !data.generation) {
    throw new Error('六爻结果缺少有效的起卦时间、时区或起卦记录。');
  }
  const generation = data.generation;
  let cast: ReturnType<typeof castLiuyao>;
  if (generation.method === 'manual') {
    cast = castLiuyao(data.timestamp, { method: 'manual', yaos: data.yaoArray });
  } else if (generation.method === 'time') {
    cast = castLiuyao(data.timestamp, { method: 'time' });
  } else if (generation.method === 'coins') {
    if (!Array.isArray(generation.coinThrows)) throw new Error('六爻结果缺少三钱记录。');
    if (!['user-record', 'simulated'].includes(generation.coinSource ?? '')) throw new Error('六爻结果缺少有效的三钱来源。');
    const reconstructed = castLiuyao(data.timestamp, { method: 'coins', coinThrows: generation.coinThrows });
    cast = { ...reconstructed, generation: { ...reconstructed.generation, coinSource: generation.coinSource } };
  } else if (generation.method === 'yarrow') {
    const saved = generation.yarrow;
    if (!saved || !Array.isArray(saved.lines) || saved.lines.length !== 6 || !saved.lines.every((line) => Array.isArray(line?.changes) && line.changes.length === 3) || !['手工分堆', '余数等概率，类内分堆等概率'].includes(saved.samplingModel)) {
      throw new Error('六爻结果缺少有效的蓍草分堆记录。');
    }
    const reconstructed = castYarrow(saved.lines.flatMap((line) => line.changes.map((change) => change.left)));
    const yarrow = { ...reconstructed, samplingModel: saved.samplingModel };
    cast = { yaos: yarrow.yaos, generation: { method: 'yarrow', yarrow } };
  } else {
    throw new Error('六爻结果的起卦方式无效。');
  }
  if (data.ziHourMode !== undefined && data.ziHourMode !== '23:00' && data.ziHourMode !== '00:00') {
    throw new Error('六爻结果的早晚子时换日口径无效。');
  }
  const chart = generateLiuyaoChart(new Date(data.timestamp), cast, data.timezoneOffsetMinutes, data.ziHourMode);
  const { evidenceAnalysis: _cached, ...saved } = data;
  if (!sameJsonValue(saved, chart)) throw new Error('六爻卦盘与起卦记录不一致。');
  return { chart, cast };
}

export async function liuyao(input: Input, now: string) {
  if (input.range) return (await import('./liuyao-range')).calculateLiuyaoRange(input, now);
  const date = new Date(input.divinationTime ?? now);
  const cast = castLiuyao(date.getTime(), input.liuyao);
  const data = generateLiuyaoChart(date, cast, input.liuyao?.timezoneOffsetMinutes, input.liuyao?.ziHourMode);
  const parsed = parseQuestionContext(input.question);
  const hasExplicitBackground = input.question.includes('【求测背景】');
  const topic =
    input.prompt?.liuyaoTemplate ??
    (parsed.inferredTopic === 'ganqing' || parsed.inferredTopic === 'shiye' || parsed.inferredTopic === 'caifu' || parsed.inferredTopic === 'guaishen'
      ? parsed.inferredTopic
      : 'general');
  const evidenceAnalysis = analyzeLiuyaoEvidence(data, {
    topic,
    ...(hasExplicitBackground && parsed.liuyaoRelative ? { usefulGodRelative: parsed.liuyaoRelative } : {}),
    ...(input.prompt?.schools?.length ? { schools: input.prompt.schools } : {}),
  });
  const summary = {
    title: '六爻起卦结果',
    tags: [`主卦：${data.originalName}`, `变卦：${data.changedName}`, `互卦：${data.interName}`],
    lines: [evidenceAnalysis.selectionFact.promptText, ...evidenceAnalysis.structureFacts.map((item) => item.promptText)],
  };
  return { data: { ...data, evidenceAnalysis }, summary, prompt: await buildPrompt(data, evidenceAnalysis, input.question, input.prompt, now) };
}

export function promptForLiuyao(value: unknown, question: string, options: Options, now: string) {
  const { chart } = reconstruct((value && typeof value === 'object' ? value : {}) as LiuyaoData & { evidenceAnalysis?: unknown });
  const parsed = parseQuestionContext(question);
  const hasExplicitBackground = question.includes('【求测背景】');
  const topic =
    options?.liuyaoTemplate ??
    (parsed.inferredTopic === 'ganqing' || parsed.inferredTopic === 'shiye' || parsed.inferredTopic === 'caifu' || parsed.inferredTopic === 'guaishen'
      ? parsed.inferredTopic
      : 'general');
  return buildPrompt(
    chart,
    analyzeLiuyaoEvidence(chart, {
      topic,
      ...(hasExplicitBackground && parsed.liuyaoRelative ? { usefulGodRelative: parsed.liuyaoRelative } : {}),
      ...(options?.schools?.length ? { schools: options.schools } : {}),
    }),
    question,
    options,
    now,
  );
}
