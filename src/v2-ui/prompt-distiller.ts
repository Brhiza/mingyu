/**
 * 面向普通用户与大模型对话的提示词精炼器（仅作用于前端展示与复制层，不改动引擎与 API 契约）。
 * 清理系统内部核验措辞、重复 UTC ISO 时间戳、代码口径英文键与纯噪声填充，保留完整命盘/卦象信息与经典依据。
 */

function formatIsoToLocalMinutes(iso: string): string {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return iso;
  // 以东八区北京时间习惯格式化常见起卦/参考时间戳
  const bj = new Date(parsed + 8 * 3_600_000);
  const y = bj.getUTCFullYear();
  const m = String(bj.getUTCMonth() + 1).padStart(2, '0');
  const d = String(bj.getUTCDate()).padStart(2, '0');
  const hh = String(bj.getUTCHours()).padStart(2, '0');
  const mm = String(bj.getUTCMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

function replaceIsoTimestamps(text: string): string {
  // 1. 先处理带毫秒与 Z 的完整 UTC ISO 字符串
  let out = text.replace(
    /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g,
    (match) => formatIsoToLocalMinutes(match),
  );
  // 2. 处理不带 Z 的本地 T 分隔日期时间，去掉冗余 :00 秒数
  out = out.replace(
    /(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}):\d{2}(?!Z)/g,
    '$1 $2',
  );
  return out;
}

function cleanTimeSectionBody(body: string): string {
  let out = body;
  // 清理“提示词时间：...”与无意义的时区偏移声明
  out = out.replace(/[；;，,]?\s*提示词时间[：:][^。\n；;]*[。]?/g, '');
  out = out.replace(/[；;，,]?\s*(?:历法时区|时区偏移|历法口径)[：:\s]*UTC[+-]?\d{1,2}(?::\d{2})?(?:（[^）]*）)?/g, '');
  // 若已含真太阳时钟表，剔除冗余的“实际起课/起局：...”与冗长分钟修正小数说明
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
  // 如果清理后只剩下空句号或短标点，视为无实质时间内容
  if (!out || /^[。；;，,\s]*$/.test(out)) return '';
  return out;
}

function cleanCastMethodBody(body: string): string {
  let out = body;
  out = out.replace(/起卦方式(?:为|：)\s*/g, '');
  // 剔除程序校验免责措辞与每爻铜钱加法算式（六爻卦盘已列出全部爻值）
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
  out = out.replace(/[；;，,]?\s*出生瞬时\s*\d{4}-\d{2}-\d{2}\s*\d{2}:\d{2}[，,]?\s*/g, '');
  out = out.replace(/[；;，,]?\s*排盘口径[：:][^\n。]+。?/g, '');
  out = out.replace(/[；;，,]?\s*安星日\s*\d{4}-\d{2}-\d{2}[、，,]?\s*时辰索引\s*\d+/g, '');
  out = out.replace(/[；;，,]?\s*时辰索引\s*\d+/g, '');
  out = out.replace(/出生地钟表\s*(\d{4}-\d{2}-\d{2}\s*\d{2}:\d{2})[，,]?\s*排盘钟表\s*\1/g, '出生时间：$1');
  out = out.replace(/出生当地(?:公历)?钟表[：:]/g, '出生时间：');
  out = out.replace(/日时依据[：:]\s*当地民用时间/g, '');
  out = out.replace(/[；;]\s*[。]/g, '。');
  out = out.replace(/^[；;，,\s]+|[；;，,\s]+$/g, '').trim();
  return out;
}

function cleanBodyNoise(header: string, body: string, includeClassics: boolean): string {
  let out = replaceIsoTimestamps(body);

  // 1. 清除英文代码字段与调试标签（reference / candidate / override / iztro / normal / synastry 等）
  out = out.replace(/（(满足|不满足)[，,]\s*(?:reference|candidate|override|baseline|fallback)）/gi, '（$1）');
  out = out.replace(/规则（(满足|不满足)）[：:]/g, '（$1）：');
  out = out.replace(/\b(?:referenceTime|includeAsteroids|maxAspects|decadalGanzhi|movingCount)\b/gi, '');
  out = out.replace(/双人合盘需另用\s*bazi-synastry[，,]?\s*仍有专业分析缺口。?/gi, '');
  out = out.replace(/movingCount\s*=\s*(\d+)/gi, '共 $1 爻发动');
  out = out.replace(/｜tianPan｜/g, '｜天盘｜');
  out = out.replace(/｜diPan｜/g, '｜地盘｜');
  out = out.replace(/｜baseGong｜/g, '｜地盘本宫｜');
  out = out.replace(/｜renPan｜/g, '｜人盘｜');
  out = out.replace(/模型[：:]\s*decadalGanzhi[；;]?/gi, '');
  out = out.replace(/[；;，。]?\s*默认未计算谷神、智神、婚神和灶神；启用\s*可加入。?/gi, '');
  out = out.replace(/未提供\s*时仅比较静态本命与组合中点盘，不计算动态行运。?/gi, '');
  out = out.replace(/[，,]?\s*可提高\s*（最多\s*200）/gi, '');
  out = out.replace(/mode[：:]\s*[a-z-]+/gi, '');
  out = out.replace(/\bplacidus\s*宫位制/gi, '普拉西德分宫制');
  out = out.replace(/星历警告[：:]\s*\[([^\]]*)\]/g, (_m, inner: string) => {
    const cleaned = inner.replace(/["'`]/g, '').trim();
    return cleaned ? `星历提醒：${cleaned}` : '';
  });
  out = out.replace(/```json[\s\S]*?```/gi, '');
  out = out.replace(/\biztro\b/gi, '');

  // 2. 清理时间与口径噪声
  out = out.replace(/[；;，,]?\s*真实出生瞬时[：:][^；;\n]+/g, '');
  out = out.replace(/[；;，,]?\s*出生瞬时\s*\d{4}-\d{2}-\d{2}\s*\d{2}:\d{2}(?:[；;，,]\s*)?/g, '');
  out = out.replace(/[；;，,]?\s*排盘口径[：:][^\n。]+。?/g, '');
  out = out.replace(/[；;，,]?\s*时辰索引\s*\d+/g, '');
  out = out.replace(/出生当地(?:公历)?钟表[：:]/g, '出生时间：');
  out = out.replace(/出生地钟表\s*(\d{4}-\d{2}-\d{2}\s*\d{2}:\d{2})[，,]?\s*排盘钟表\s*\1/g, '出生时间：$1');
  out = out.replace(/日时依据[：:]\s*当地民用时间/g, '');
  out = out.replace(/（终点不含）/g, '');
  out = out.replace(/\bUTC\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})/g, '$1');
  out = out.replace(/（UTC\+\d+(?::\d{2})?）/g, '');

  // 3. 清除维基文库 / CC BY-SA 版权声明与链接
  out = out.replace(/\n?经文来源[：:][^\n]*(?:维基文库|CC BY-SA|wikisource|creativecommons)[^\n]*/g, '');
  out = out.replace(/https?:\/\/(?:zh\.wikisource\.org|creativecommons\.org)[^\s)）\n]*/g, '');

  // 4. 剔除 AI 已知的教科书式基础规则解释与引擎免责废话
  const redundantLinePatterns: RegExp[] = [
    /^按出生真实瞬时与节气计算，阳男阴女顺行.*$/gm,
    /^按实际交节瞬时及本项目月令分日表确定.*$/gm,
    /^月龄按平均朔望月与相位角近似换算.*$/gm,
    /^仅列\d+项本命神煞，不含其他流派口径或岁运神煞.*$/gm,
    /^配对和透藏只反映原局结构.*$/gm,
    /^日干作为参照，不计作透出的比肩.*$/gm,
    /^神煞为传统旁证，不可单凭命中推断现实结果。$/gm,
    /^元素关系仅为传统取象，正逆位不改变元素关系。$/gm,
    /^传统署名及成书年代不作为已证实的版本归属。$/gm,
    /^此为所列条件下的旺衰模型.*$/gm,
    /^仅为普通月令取格候选.*$/gm,
    /^仅按已实现的化气、曲直.*$/gm,
    /^仅为所列条件下的普通格局模型.*$/gm,
    /^仅核对所列普通格局条件.*$/gm,
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
    /^第\d+爻为变化触发层位，只用于先后.*$/gm,
    /^月建[子丑寅卯辰巳午未申酉戌亥]只用于校验各阶段体用旺衰.*$/gm,
    /^候选宫与格局是盘内传统取象.*$/gm,
    /^阶段关系与卦爻辞属于传统取象.*$/gm,
    /^不得将其当成已经算出的结论。$/gm,
  ];
  for (const pat of redundantLinePatterns) {
    out = out.replace(pat, '');
  }

  // 清除长段落尾部附加的免责/科普尾巴（非整行匹配的情况）
  out = out.replace(/[。；]?\s*此为所列条件下的旺衰模型[^。\n]*。?/g, '');
  out = out.replace(/[。；]?\s*仅为所列旺衰和格局模型下的基础取向[^\n]*/g, '');
  out = out.replace(/[。；]?\s*候选仅记录规则条件与资料缺口[^\n]*/g, '');
  out = out.replace(/[。；]?\s*病药与通关仅为所列模型的候选[^\n]*/g, '');
  out = out.replace(/[。；]?\s*仅为普通月令取格候选[^\n]*/g, '');
  out = out.replace(/[。；]?\s*仅按已实现的化气[^\n]*/g, '');
  out = out.replace(/[。；]?\s*仅核对所列普通格局条件[^\n]*/g, '');
  out = out.replace(/[。；]?\s*仅为所列条件下的普通格局模型[^\n]*/g, '');
  out = out.replace(/；?\s*依据[：:](?:主卦|原动爻|变卦)[^。\n]+。?/g, '');
  out = out.replace(/；?\s*(?:方位仅在现实路线、安全和事项用神均匹配时采用|须结合现实风险与路线条件复核)/g, '');
  out = out.replace(/；?\s*通用主轴由盘面补齐提出[：:][^。\n]+。?/g, '');
  out = out.replace(/；?\s*未另指定用神时，以世爻为求测者主轴。?/g, '');
  out = out.replace(/范围\s*\d{4}-\d{2}-\d{2}[^\n]+分日口径可能不同。/g, '');
  out = out.replace(/[；;]?\s*候选来源[^\n；。]+/g, '');
  out = out.replace(/由盘面补齐提出[：:]\s*/g, ' · ');
  out = out.replace(/\n?非最终用神[。\n]?/g, '');

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

  // 大运时间精简到日期（去掉冗余的同分同秒时间戳）
  if (header === '【大运】') {
    out = out.replace(/(\d{4}-\d{2}-\d{2})\s+\d{2}:\d{2}/g, '$1');
  }

  // 清除无意义的流程说教与模板化说明句（AI 完全能直接理解盘面数据）
  out = out.replace(/节气[^；\n]+；\s*普通格调候候选。?\n?/g, '');
  out = out.replace(/普通格局条件模型[：:]\s*未判定（格神条件资料不足）[；;]\s*格神条件资料不足。?/g, '');
  out = out.replace(/；?\s*仅按运盘计算旺星是否到位；实际可用性须结合水口、门路与实地形势核对。?/g, '');
  out = out.replace(/八宅与玄空分开计算，仅按相同坐山连接；多个候选须分别分析。?/g, '');
  out = out.replace(/[；;]\s*$/gm, '');
  out = out.replace(/\n{3,}/g, '\n\n').trim();
  return out;
}

const DROP_HEADERS = new Set([
  '【提示词参考时间】',
  '【传统依据】',
  '【计算口径】',
  '【限制】',
  '【限制与任务】',
  '【解读选择】',
  '【住宅风水预览】',
  '【阳宅风水】',
  '【固定版本资料表】',
  '【主题：综合】',
  '【任务】',
]);

const HEADER_REMAP: Record<string, string> = {
  '【八字独立内核预览】': '【命主资料】',
  '【八字命盘】': '【命主资料】',
  '【紫微斗数独立预览】': '【命主资料】',
  '【紫微斗数】': '【命主资料】',
  '【奇门终身局基础盘】': '【命主资料】',
};

export function distillPromptForUser(
  rawText: string,
  options?: { includeClassics?: boolean },
): string {
  if (!rawText || !rawText.trim()) return '';
  const includeClassics = Boolean(options?.includeClassics);

  // 按【标题】段落拆解，兼容前缀无【】的情况
  const normalized = rawText.replace(/\r\n/g, '\n').trim();
  const blocks = normalized.split(/\n{2,}(?=【[^】\n]+】)/);
  const cleanedBlocks: string[] = [];

  for (const block of blocks) {
    const match = /^(【[^】\n]+】)\s*\n?([\s\S]*)$/.exec(block.trim());
    if (!match) {
      const text = replaceIsoTimestamps(block.trim());
      if (text) cleanedBlocks.push(text);
      continue;
    }

    const rawHeader = match[1];
    let body = match[2].trim();

    if (DROP_HEADERS.has(rawHeader)) continue;

    if (rawHeader === '【时间】') {
      body = cleanTimeSectionBody(body);
      if (!body) continue;
    } else if (rawHeader === '【起卦方式】') {
      body = cleanCastMethodBody(body);
      if (!body) continue;
    } else if (rawHeader in HEADER_REMAP) {
      body = cleanBaziOrZiweiHeaderBody(body);
    } else {
      body = cleanBodyNoise(rawHeader, body, includeClassics);
      if (!body) continue;
    }

    const mapped = HEADER_REMAP[rawHeader] ?? rawHeader;
    const header = mapped.replace(/（(?:基础|独立)?预览）|独立预览|双人合盘预览|本命预览|独立双盘预览|预览/g, '');
    cleanedBlocks.push(`${header}\n${body}`);
  }

  return cleanedBlocks.join('\n\n').trim();
}
