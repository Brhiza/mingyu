import { ASTRO_HOUSE_SYSTEM_LABELS } from './systems/prompt-format';
import { OUTPUT_LANGUAGE_HEADER } from './output-language';

function formatIsoToBeijing(iso: string, includeSeconds = false): string {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return iso;
  const bj = new Date(parsed + 8 * 3_600_000);
  const y = bj.getUTCFullYear();
  const m = String(bj.getUTCMonth() + 1).padStart(2, '0');
  const d = String(bj.getUTCDate()).padStart(2, '0');
  const hh = String(bj.getUTCHours()).padStart(2, '0');
  const mm = String(bj.getUTCMinutes()).padStart(2, '0');
  if (!includeSeconds) return `${y}-${m}-${d} ${hh}:${mm}`;
  const ss = String(bj.getUTCSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

function replaceIsoTimestamps(text: string): string {
  let out = text;
  // 1. 节气/历法类已并列“UTC ISO｜北京时间 YYYY-MM-DD(T| )HH:MM:SS”时直接去重，保留精确秒数
  out = out.replace(
    /(?:UTC\s+)?\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\s*[｜|]\s*北京时间\s*(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/g,
    '北京时间 $1 $2',
  );
  // 2. 出生范围/周期事件等秒级起止区间保留秒数，避免起止时间被砍秒后完全一致
  out = out.replace(
    /(?:UTC\s+)?(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)\s*至\s*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)/g,
    (_m, startIso: string, endIso: string) =>
      `${formatIsoToBeijing(startIso, true)} 至 ${formatIsoToBeijing(endIso, true)}`,
  );
  // 3. 常规带 Z 的完整 UTC ISO 字符串简化为东八区日期与分钟
  out = out.replace(
    /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g,
    (match) => formatIsoToBeijing(match, false),
  );
  // 4. 不带 Z 的本地 T 分隔日期时间，仅当秒为 :00 且非“北京时间”精度字段时省略秒数
  out = out.replace(
    /(?<!北京时间\s)(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}):00(?!Z)/g,
    '$1 $2',
  );
  out = out.replace(
    /(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(?!Z)/g,
    '$1 $2',
  );
  return out;
}

function translateAstroHouseSystems(text: string): string {
  return text.replace(
    /\b(placidus|whole_sign|equal|koch|porphyry|regiomontanus|campanus|alcabitius|morinus|meridian|polich_page|vehlow)\s*(宫位制|宫位)/gi,
    (_m, key: string, suffix: string) => {
      const cn = ASTRO_HOUSE_SYSTEM_LABELS[key.toLowerCase()];
      return cn ? `${cn}${suffix}` : `${key}${suffix}`;
    },
  );
}

function cleanTimeSectionBody(body: string): string {
  let out = body;
  out = out.replace(/[；;，,]?\s*提示词时间[：:][^。\n；;]*[。]?/g, '');
  out = out.replace(/[；;，,]?\s*(?:历法时区|时区偏移|历法口径)[：:\s]*UTC[+-]?\d{1,2}(?::\d{2})?(?:（[^）]*）)?/g, '');
  out = out.replace(
    /实际起(?:课|局)[：:][^；;\n]+[；;]\s*(真太阳时钟表[：:][^（\n]+)（[^）]*）/g,
    '$1',
  );
  out = out.replace(/[；;，,]?\s*经度修正\s*[-+]?\d+(?:\.\d+)?\s*分钟[，,]?\s*均时差\s*[-+]?\d+(?:\.\d+)?\s*分钟(?:[，,]?\s*合计\s*[-+]?\d+(?:\.\d+)?\s*分钟)?/g, '');
  out = replaceIsoTimestamps(out);
  out = out
    .replace(/\s*[；;]+\s*[。\n]/g, '。')
    .replace(/^[；;，,\s]+/, '')
    .replace(/[；;，,\s]+$/, '')
    .trim();
  if (!out || /^[。；;，,\s]*$/.test(out)) return '';
  return out;
}

function cleanCastMethodBody(body: string): string {
  let out = body;
  out = out.replace(/起卦方式(?:为|：)\s*/g, '');
  out = out.replace(/[；;]?\s*三钱结果由(?:程序随机模拟|调用方提供)[，,]?\s*(?:并非线下实摇|服务无法证明线下投掷来源)/g, '');
  out = out.replace(/[；;]?\s*未实摇铜钱[，,]?\s*也不是按年月日时取数的传统起法/g, '');
  out = out.replace(/[；;]?\s*(?:第[1-6]爻\d\+\d\+\d=\d（(?:老阴|少阳|少阴|老阳)）[；;]?)+/g, '');
  out = out.replace(/按起卦时间戳确定性模拟三钱得到六爻值/g, '时间起卦 · 爻值 ');
  out = out.replace(/^[；;，,\s]+|[；;，,\s]+$/g, '').trim();
  return out || '';
}

function cleanBaziOrZiweiHeaderBody(body: string): string {
  let out = replaceIsoTimestamps(body);
  out = out.replace(/[；;，,]?\s*真实出生瞬时[：:][^；;\n]+/g, '');
  out = out.replace(/[；;，,]?\s*出生瞬时\s*\d{4}-\d{2}-\d{2}\s*\d{2}:\d{2}(?::\d{2})?[，,]?\s*/g, '');
  out = out.replace(/[；;，,]?\s*排盘口径[：:][^\n。]+。?/g, '');
  out = out.replace(/[；;，,]?\s*安星日\s*\d{4}-\d{2}-\d{2}[、，,]?\s*时辰索引\s*\d+/g, '');
  out = out.replace(/[；;，,]?\s*时辰索引\s*\d+/g, '');
  out = out.replace(/出生地钟表\s*(\d{4}-\d{2}-\d{2}\s*\d{2}:\d{2}(?::\d{2})?)[，,]?\s*排盘钟表\s*\1/g, '；出生时间：$1');
  out = out.replace(/出生当地(?:公历)?钟表[：:]/g, '出生时间：');
  out = out.replace(/日时依据[：:]\s*当地民用时间/g, '');
  out = out.replace(/\bapplyChinaDst\b/g, '中国历史夏令时校正');
  out = out.replace(/timeZoneId\s*[：:]\s*"?Asia\/Shanghai"?/gi, '中国标准时区');
  out = out.replace(/\bAsia\/Shanghai\b/g, '中国标准时区');
  out = out.replace(/(性别[：:][^；;，,\n]+?)(?=出生时间[：:])/g, '$1；');
  out = out.replace(/[；;]{2,}/g, '；');
  out = out.replace(/[；;]\s*[。]/g, '。');
  out = out.replace(/^[；;，,\s]+|[；;，,\s]+$/g, '').trim();
  return out;
}

function cleanBodyNoise(header: string, body: string, includeClassics: boolean): string {
  let out = replaceIsoTimestamps(body);

  // 1. 清除残留英文参数或格式噪声
  out = out.replace(/（(满足|不满足)[，,]\s*(?:reference|candidate|override|baseline|fallback)）/gi, '（$1）');
  out = out.replace(/规则（(满足|不满足)）[：:]/g, '（$1）：');
  out = out.replace(/timeZoneId\s*[：:]\s*"?Asia\/Shanghai"?/gi, '中国标准时区');
  out = out.replace(/\bAsia\/Shanghai\b/g, '中国标准时区');
  out = out.replace(/双人合盘需另用\s*(?:bazi-synastry|八字合盘)[，,]?\s*(?:仍有专业分析缺口。?)?/gi, '');
  out = out.replace(/mode[：:]\s*[a-z-]+/gi, '');
  out = translateAstroHouseSystems(out);
  out = out.replace(/星历警告[：:]\s*\[([^\]]*)\]/g, (_m, inner: string) => {
    const cleaned = inner.replace(/["'`]/g, '').trim();
    return cleaned ? `星历提醒：${cleaned}` : '';
  });

  // 2. 清理时间与口径噪声
  out = out.replace(/[；;，,]?\s*真实出生瞬时[：:][^；;\n]+/g, '');
  out = out.replace(/[；;，,]?\s*出生瞬时\s*\d{4}-\d{2}-\d{2}\s*\d{2}:\d{2}(?::\d{2})?(?:[；;，,]\s*)?/g, '');
  out = out.replace(/[；;，,]?\s*排盘口径[：:][^\n。]+。?/g, '');
  out = out.replace(/[；;，,]?\s*时辰索引\s*\d+/g, '');
  out = out.replace(/出生当地(?:公历)?钟表[：:]/g, '出生时间：');
  out = out.replace(/出生地钟表\s*(\d{4}-\d{2}-\d{2}\s*\d{2}:\d{2}(?::\d{2})?)[，,]?\s*排盘钟表\s*\1/g, '出生时间：$1');
  out = out.replace(/日时依据[：:]\s*当地民用时间/g, '');
  out = out.replace(/（终点不含）/g, '');
  out = out.replace(/\bUTC\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(?::\d{2})?)/g, '$1');
  out = out.replace(/（UTC\+\d+(?::\d{2})?）/g, '');

  // 3. 清除维基文库 / CC BY-SA 版权声明与链接，并清理残余空括号
  out = out.replace(/\n?经文来源[：:][^\n]*(?:维基文库|CC BY-SA|wikisource|creativecommons)[^\n]*/g, '');
  out = out.replace(/https?:\/\/(?:zh\.wikisource\.org|creativecommons\.org)[^\s)）\n]*/g, '');
  out = out.replace(/[（(]\s*[)）]/g, '');

  // 4. 剔除 AI 已知的教科书式基础规则解释与引擎免责废话
  const redundantLinePatterns: RegExp[] = [
    /^按出生真实瞬时与节气计算，阳男阴女顺行.*$/gm,
    /^按实际交节瞬时及本项目月令分日表确定.*$/gm,
    /^月龄按平均朔望月与相位角近似换算.*$/gm,
    /^配对和透藏只反映原局结构.*$/gm,
    /^日干作为参照，不计作透出的比肩.*$/gm,
    /^神煞为传统旁证，不可单凭命中推断现实结果。$/gm,
    /^此为所列条件下的旺衰模型.*$/gm,
    /^仅为普通月令取格候选.*$/gm,
    /^仅为所列旺衰和格局模型下的基础取向.*$/gm,
    /^候选仅记录规则条件与资料缺口.*$/gm,
    /^病药与通关仅为所列模型的候选.*$/gm,
    /^未提供可计算的参考时刻，不得虚构流年.*$/gm,
    /^只使用本次列出的盘面和时间层级.*$/gm,
    /^快、中、慢只表示盘内相对节奏.*$/gm,
    /^空亡、马星等只给候选触发条件.*$/gm,
    /^未按具体问题选定用神时，本结果只能作为.*$/gm,
    /^未给(?:现实|目标)?期限时.*换算.*$/gm,
    /^动爻、卦数与旺衰不能据此换算绝对日期.*$/gm,
    /^不得将其当成已经算出的结论。$/gm,
  ];
  for (const pat of redundantLinePatterns) {
    out = out.replace(pat, '');
  }

  // 清除长段落尾部附加的免责/科普尾巴
  out = out.replace(/[。；]?\s*此为所列条件下的旺衰模型[^。\n]*。?/g, '');
  out = out.replace(/[。；]?\s*仅为所列旺衰和格局模型下的基础取向[^\n]*/g, '');
  out = out.replace(/[。；]?\s*候选仅记录规则条件与资料缺口[^\n]*/g, '');
  out = out.replace(/[。；]?\s*病药与通关仅为所列模型的候选[^\n]*/g, '');
  out = out.replace(/[。；]?\s*仅为普通月令取格候选[^\n]*/g, '');
  out = out.replace(/；?\s*依据[：:](?:主卦|原动爻|变卦)[^。\n]+。?/g, '');
  out = out.replace(/；?\s*未另指定用神时，以世爻为求测者主轴。?/g, '');
  out = out.replace(/范围\s*\d{4}-\d{2}-\d{2}[^\n]+分日口径可能不同。/g, '');
  out = out.replace(/[；;]?\s*候选来源[^\n；。]+/g, '');
  // 整句移除“（并非最终用神或喜忌）”等尾部括号说明，避免截断成病句
  out = out.replace(/（(?:并)?非最终(?:用神或喜忌|用神|喜忌)）[。.]?/g, '');
  out = out.replace(/[；;，,]?\s*(?:并)?非最终(?:用神或喜忌|用神|喜忌)[。.]?/g, '');
  out = out.replace(/^\s*(?:并)?非最终(?:用神或喜忌|用神|喜忌)[。.\n]?/gm, '');
  out = out.replace(/用于八字、姓名分析或起名的出生范围[：:]\s*\{[^\n]+\}\n?/g, '');

  // 梅花取数繁琐余数算式精简：保留取数依据本身
  if (header === '【取数与卦象】') {
    out = out.replace(/[；;]?\s*(?:上卦|下卦|动爻)=\([^)]+\)除以\d+，余数为\d+，索引为\d+/g, '');
  }

  // 梅花/六爻卦爻辞清理机器分类长标签，保留纯净经文
  if (header === '【卦爻辞辅助资料】') {
    if (!includeClassics) return '';
    out = out.replace(
      /(?:[主互变]卦[^\s：:]+(?:卦辞|第[1-6]爻爻辞))[：:][^\n]*?原文[：:]/g,
      (line) => {
        const prefix = line.split(/[：:]/)[0];
        return `${prefix}：`;
      },
    );
  }

  // 大运时间精简到日期
  if (header === '【大运】') {
    out = out.replace(/(\d{4}-\d{2}-\d{2})\s+\d{2}:\d{2}(?::\d{2})?/g, '$1');
  } else if (header === '【占卜资料】') {
    out = out.replace(/^历法口径：[^\n]*\n?/gm, '');
  }

  out = out.replace(/节气[^；\n]+；\s*普通格调候候选。?\n?/g, '');
  out = out.replace(/；?\s*仅按运盘计算旺星是否到位；实际可用性须结合水口、门路与实地形势核对。?/g, '');
  out = out.replace(/八宅与玄空分开计算，仅按相同坐山连接；多个候选须分别分析。?/g, '');
  out = out.replace(/[；;]\s*$/gm, '');
  out = out.replace(/\n{3,}/g, '\n\n').trim();
  return out;
}

const ALWAYS_DROP_HEADERS = new Set([
  '【提示词参考时间】',
  '【传统依据】',
  '【计算口径】',
  '【限制】',
  '【限制与任务】',
  '【解读选择】',
  '【阳宅风水】',
  '【主题：综合】',
  '【任务】',
]);

/** 当已附带统一【解读与交付契约】或处于 Agent 模式时，同步剔除的冗余子任务/口径变体标题 */
const CONTRACT_REDUNDANT_HEADERS = new Set([
  '【任务与限制】',
  '【婚恋任务】',
  '【恋爱合婚任务】',
  '【合参任务】',
  '【资料口径】',
  '【模型口径】',
  '【口径】',
  '【传统语境】',
  '【适用边界】',
  '【计算限制】',
]);

/** 八字盘面在已有【格局组合与互制关系】与【用神裁定与落位】时，可安全折叠的中间重复推导段 */
const BAZI_REDUNDANT_INTERMEDIATE_HEADERS = new Set([
  '【已迁移路线的格局排序】',
  '【取用基础取向】',
  '【调候条件协调】',
  '【通根与月令透干】',
  '【普通月令取格候选】',
  '【格局透干与根气条件】',
  '【司权、病药与通关候选】',
]);

function isStandardDuplicateSynthesisHeader(header: string, headerSet: ReadonlySet<string>): boolean {
  if (header === '【三宫递进与体用制衡关系】' && headerSet.has('【三宫与体用生克】')) return true;
  if (header === '【体用阶段演变与制衡关系】' && headerSet.has('【体用与阶段】')) return true;
  if (header === '【牌阵结构与牌间呼应关系】' && headerSet.has('【占卜资料】')) return true;
  return false;
}

/** Agent 对话模式下需剥离的单轮复制专用指令头（由 Agent 自身 systemPrompt 统一承接） */
const AGENT_STRIP_HEADERS = new Set([
  '【顶部任务锚点】',
  '【解读与交付契约】',
  '【AI 报告输出规范】',
]);

/** 未启用「含古籍」档位时需剥离的典籍依据段落 */
const CLASSICS_DROP_HEADERS = new Set([
  '【典籍片段】',
  '【典籍参考】',
  '【典籍依据参考】',
  '【卦爻辞辅助资料】',
  '【经典依据】',
  '【经典资料摘要】',
  '【传统资料】',
  '【来源说明】',
]);

/** 「精简」档位剥离的次要推导、重复制衡阐述与长段明细标题 */
const BRIEF_DROP_HEADERS = new Set([
  // 重复跨层制衡重述
  '【三宫递进与体用制衡关系】',
  '【体用阶段演变与制衡关系】',
  '【卦象组合与生克制衡关系】',
  '【格局叠加与吉凶制衡关系】',
  '【格局叠合与成败制衡关系】',
  '【牌阵结构与牌间呼应关系】',
  '【方位格局与理气制衡关系】',
  '【相位格局与能量制衡关系】',
  '【恩用仇难与星曜制衡关系】',
  '【音形义与三才喜忌制衡关系】',
  // 八字次要规则推导与神煞枚举
  '【辅助宫位（命宫/身宫/胎元/胎息）】',
  '【岁运神煞】',
  '【双方本命神煞】',
  '【日主旺衰条件模型】',
  '【普通月令取格候选】',
  '【格局透干与根气条件】',
  '【调候条件候选】',
  '【司权、病药与通关候选】',
  '【八字取用条件候选】',
  '【十神分布】',
  '【四柱条件证据】',
  // 紫微 / 星盘 / 七政 / 奇门 / 占卜 / 风水 / 运势次要段落
  '【本命宫干四化】',
  '【双方各自本命宫干四化】',
  '【十二宫宫主星与飞宫】',
  '【十大星体分布】',
  '【组合中点盘】',
  '【吊照】',
  '【反证】',
  '【反证条件】',
  '【节令背景】',
  '【候选宫间关系】',
  '【方位条件】',
  '【问题范围】',
  '【相邻牌元素与逆位结构】',
  '【分类解说辅助资料】',
  '【八方六亲归宫与门主灶布局指引】',
  '【人生主题候选宫】',
  '【基准时间与历法数据】',
  '【开运与避坑参考】',
  '【关注主题】',
  '【主题】',
]);

function isBriefDroppedHeader(header: string, headerSet: ReadonlySet<string>): boolean {
  if (BRIEF_DROP_HEADERS.has(header) || header.startsWith('【本命神煞')) return true;
  if (header === '【运限】' && headerSet.has('【运限动态与流年四化（压平精要）】')) return true;
  return false;
}

function trimBodyForBrief(header: string, body: string): string {
  let out = body;
  if (header === '【体用与阶段】') {
    out = out.replace(/\n?《梅花易数·万物属类》本局涉卦类象：[\s\S]*$/, '');
    out = out.replace(/^旁通与反观：[^\n]*\n?/gm, '');
  } else if (header === '【指定时刻岁运】') {
    const kept = out
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !line.startsWith('未由所列岁运补全') && !/^(?:流月|流日|流时)/.test(line));
    out = (kept.length > 0 ? kept.slice(0, 3) : out.split('\n').slice(0, 3)).join('\n');
  } else if (header === '【用神裁定与落位】') {
    out = out.replace(/^用神落位（[^\n]*\n?/gm, '');
  } else if (header === '【占卜资料】') {
    out = out.replace(/[；;]\s*洗牌模式：[^。\n]*/g, '');
    out = out.replace(/^牌阵结构统计：[^\n]*\n?/gm, '');
  } else if (header === '【牌面组合】') {
    out = out
      .split('\n')
      .filter((line) => line.trim() && !line.trim().endsWith('不视为固定组合。'))
      .join('\n');
  }
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

const HEADER_REMAP: Record<string, string> = {
  '【八字命盘】': '【命主资料】',
  '【紫微斗数】': '【命主资料】',
  '【奇门终身局基础盘】': '【命主资料】',
};

/**
 * 兼容空行与单换行分隔的【标题】段落切分，杜绝相邻单换行标题（如【任务】\n...\n【问题】）粘连误删。
 */
function splitPromptBlocks(rawText: string): Array<{ header: string; body: string }> {
  const normalized = rawText.replace(/\r\n/g, '\n').trim();
  const lines = normalized.split('\n');
  const blocks: Array<{ header: string; bodyLines: string[] }> = [];

  for (const line of lines) {
    // 匹配独立成行的【标题】，或形如【知】简体知... 的字库条目行
    const standalone = /^(【[^】\n]+】)\s*$/.exec(line.trim());
    const inlineHeading = !standalone ? /^(【[^】\n]{1,18}】)(.+)$/.exec(line.trim()) : null;
    if (standalone) {
      blocks.push({ header: standalone[1], bodyLines: [] });
    } else if (inlineHeading && !/^[，。；：、）】》]/.test(inlineHeading[2].trim()) && (blocks.length === 0 || blocks[blocks.length - 1].bodyLines.length === 0 || /^【[^】]{1,2}】$/.test(inlineHeading[1]) || /^【(?:七政四余本命|西洋星盘本命|八字命盘|紫微斗数)/.test(inlineHeading[1]))) {
      blocks.push({ header: inlineHeading[1], bodyLines: [inlineHeading[2].trim()] });
    } else if (blocks.length === 0) {
      blocks.push({ header: '', bodyLines: [line] });
    } else {
      blocks[blocks.length - 1].bodyLines.push(line);
    }
  }

  return blocks.map((b) => ({
    header: b.header,
    body: b.bodyLines.join('\n').trim(),
  }));
}

export interface DistillPromptOptions {
  includeClassics?: boolean;
  /** 'user' 面向普通用户复制/单盘直连；'agent' 面向多轮对话 Agent（额外剥离单轮契约与锚点）；'brief' 极简核心事实卡 */
  mode?: 'user' | 'agent' | 'brief';
  /** 是否在保留全部盘面事实前提下折叠八字等高重复中间推导段（默认 true） */
  dedupeRedundantSections?: boolean;
}

export function distillPromptForUser(
  rawText: string,
  options?: DistillPromptOptions,
): string {
  if (!rawText || !rawText.trim()) return '';
  const includeClassics = Boolean(options?.includeClassics);
  const mode = options?.mode ?? 'user';
  const isCompactMode = mode === 'agent' || mode === 'brief';
  const dedupeRedundant = options?.dedupeRedundantSections ?? true;

  const parsedBlocks = splitPromptBlocks(rawText);
  const headerSet = new Set(parsedBlocks.map((b) => b.header).filter(Boolean));
  const hasContract = headerSet.has('【解读与交付契约】') || isCompactMode;
  const hasBaziSummaryCore =
    headerSet.has('【用神裁定与落位】') && headerSet.has('【格局组合与互制关系】');
  const hasCompactDayun = headerSet.has('【岁运动态与格局引动（压平精要）】');

  const cleanedBlocks: string[] = [];

  for (const { header: rawHeader, body: rawBody } of parsedBlocks) {
    if (!rawHeader) {
      const text = replaceIsoTimestamps(rawBody);
      if (text) cleanedBlocks.push(text);
      continue;
    }

    if (ALWAYS_DROP_HEADERS.has(rawHeader)) continue;
    if (!includeClassics && CLASSICS_DROP_HEADERS.has(rawHeader)) continue;
    if (isCompactMode && AGENT_STRIP_HEADERS.has(rawHeader)) continue;
    if (mode === 'brief' && isBriefDroppedHeader(rawHeader, headerSet)) continue;
    if (hasContract && CONTRACT_REDUNDANT_HEADERS.has(rawHeader)) continue;
    if (dedupeRedundant && hasBaziSummaryCore && BAZI_REDUNDANT_INTERMEDIATE_HEADERS.has(rawHeader)) {
      continue;
    }
    if (dedupeRedundant && isStandardDuplicateSynthesisHeader(rawHeader, headerSet)) {
      continue;
    }

    let body = rawBody;
    if (!body) {
      // 章节分隔符（如【一、八字资料】【二、紫微斗数资料】）允许无正文保留；【汉字资料】空头略去
      if (/^【[一二三四五六七八九十]+、/.test(rawHeader)) {
        cleanedBlocks.push(rawHeader);
      }
      continue;
    }

    if (rawHeader === '【时间】') {
      body = cleanTimeSectionBody(body);
      if (!body) continue;
    } else if (rawHeader === '【起卦方式】') {
      body = cleanCastMethodBody(body);
      if (!body) continue;
    } else if (rawHeader in HEADER_REMAP || rawHeader === '【八字命盘概况】' || rawHeader === '【紫微命盘概况】') {
      body = cleanBaziOrZiweiHeaderBody(body);
      if (!body) continue;
    } else {
      body = cleanBodyNoise(rawHeader, body, includeClassics);
      if (!body) continue;
      if (mode === 'brief') {
        body = trimBodyForBrief(rawHeader, body);
        if (!body) continue;
      }
      if (dedupeRedundant && rawHeader === '【大运】' && hasCompactDayun) {
        // 压平精要已含完整大运干支、年龄与喜忌引动，【大运】仅保留顺逆与起运岁数首行，避免重复罗列全部大运
        const firstLine = body.split('\n')[0]?.trim();
        if (firstLine && /顺行|逆行|起运/.test(firstLine)) {
          body = firstLine;
        }
      }
    }

    const header = HEADER_REMAP[rawHeader] ?? rawHeader;
    cleanedBlocks.push(`${header}\n${body}`);
  }

  return cleanedBlocks.join('\n\n').trim();
}

/** 面向站内对话式 AI Agent 的高密度纯事实精炼器（剥离单轮锚点、交付契约与噪声）。 */
export function distillPromptForAgent(
  rawText: string,
  options?: { includeClassics?: boolean },
): string {
  return distillPromptForUser(rawText, {
    includeClassics: Boolean(options?.includeClassics),
    mode: 'agent',
    dedupeRedundantSections: true,
  });
}

/** 面向提示词「精简」档位及超紧凑接口的高压缩核心事实精炼器（省约 45%–60% 字数）。 */
export function distillPromptForBrief(rawText: string): string {
  return distillPromptForUser(rawText, {
    includeClassics: false,
    mode: 'brief',
    dedupeRedundantSections: true,
  });
}

const SYSTEM_ROLE_HEADERS = new Set([
  '【解读与交付契约】',
  '【用户自定义规则框架】',
  '【AI 报告输出规范】',
  OUTPUT_LANGUAGE_HEADER,
]);

/**
 * 将完整单盘提示词拆分为 system（解读契约与框架规范）与 user（纯盘面事实与用户提问），
 * 用于站内直连 AI 对话，提升模型对规则契约的遵循度并减少多轮追问时的角色混淆。
 */
export function splitPromptIntoSystemAndUser(promptText: string): {
  system?: string;
  user: string;
} {
  const trimmed = promptText.trim();
  if (!trimmed) return { user: '' };

  const blocks = splitPromptBlocks(trimmed);
  const systemParts: string[] = [];
  const userParts: string[] = [];

  for (const { header, body } of blocks) {
    const full = header ? (body ? `${header}\n${body}` : header) : body;
    if (!full) continue;
    if (
      SYSTEM_ROLE_HEADERS.has(header)
      || header.startsWith('【指定解读框架：')
      || header.startsWith('【推荐解读框架：')
    ) {
      systemParts.push(full);
    } else {
      userParts.push(full);
    }
  }

  if (systemParts.length === 0) {
    return { user: trimmed };
  }

  // 已有独立 system 规则时，剔除 user 顶部冗余的【顶部任务锚点】（避免重复说教）
  const filteredUserParts = userParts.filter((part) => !part.startsWith('【顶部任务锚点】'));
  const userText = (filteredUserParts.length ? filteredUserParts : userParts).join('\n\n').trim();
  const systemText = [
    '你是专业且通俗易懂的传统术数解读助手。请严格遵循以下交付契约与输出框架，仅基于用户提供的引擎盘面事实作答。',
    ...systemParts,
  ].join('\n\n').trim();

  return { system: systemText, user: userText };
}

/**
 * 统一提示词输出档位（第一性原理：源头分档，不再让外层反复打补丁）：
 * - standard：默认核心模式（calculate / reprompt / MCP / CLI / HTTP 默认值），
 *   保留全部盘面事实、【任务】、【限制】、【计算口径】、【历表说明】与精确时间戳，
 *   但源头清除内部代码/库名泄露、残缺语病与纯噪声填充；
 * - user：面向人类复制与站内单盘 AI 面板的精炼模式（北京时间友好化、折叠中间推导段）；
 * - agent：供对话 Agent / 工具调用消费的超紧凑事实版（去掉重复交付契约）；
 * - ultra-compact：面向本地/小参数模型的极致事实卡口径；
 * - audit：完整审计模式（对应 detailMode: 'full'），一字不改保留全部底层原始输出。
 */
export type PromptProfile = 'standard' | 'user' | 'agent' | 'ultra-compact' | 'audit';

/**
 * 源头无损清理（用于默认 standard 档位）：
 * 只清除内部实现泄露与明显噪声，不删减任何领域事实、任务要求、边界限制或精确时间戳。
 */
export function sanitizeSourcePromptStandard(rawText: string): string {
  let out = rawText;
  out = out.replace(/timeZoneId\s*[：:]\s*"?Asia\/Shanghai"?/gi, '中国标准时区');
  out = out.replace(/\bAsia\/Shanghai\b/g, '中国标准时区');
  out = out.replace(/[；;，,]?\s*完整资料见结构化结果。?/g, '');
  out = out.replace(/（\s*）/g, '').replace(/\(\s*\)/g, '');
  out = out.replace(/[；;]{2,}/g, '；');
  out = out.replace(/\n{3,}/g, '\n\n');
  return out.trim();
}

export function resolveEffectivePromptProfile(
  promptOptions: unknown,
  explicitProfile?: PromptProfile,
): PromptProfile {
  if (explicitProfile) return explicitProfile;
  if (
    promptOptions
    && typeof promptOptions === 'object'
    && !Array.isArray(promptOptions)
    && (promptOptions as { detailMode?: unknown }).detailMode === 'full'
  ) {
    return 'audit';
  }
  return 'standard';
}

export function applyPromptProfileToPrompt<T extends { text?: string }>(
  prompt: T,
  profile: PromptProfile,
  options?: { includeClassics?: boolean },
): T {
  if (!prompt || typeof prompt.text !== 'string' || !prompt.text.trim()) return prompt;
  if (profile === 'audit') return prompt;
  const includeClassics = Boolean(options?.includeClassics);
  let nextText: string;
  if (profile === 'ultra-compact') {
    nextText = distillPromptForBrief(prompt.text);
  } else if (profile === 'agent') {
    nextText = distillPromptForAgent(prompt.text, { includeClassics });
  } else if (profile === 'user') {
    nextText = distillPromptForUser(prompt.text, { includeClassics });
  } else {
    nextText = sanitizeSourcePromptStandard(prompt.text);
  }
  if (nextText === prompt.text) return prompt;
  return { ...prompt, text: nextText };
}
