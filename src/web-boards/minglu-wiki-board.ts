import './boards.css';
import { asArray, asNumber, asRecord, asString, type UnknownRecord } from './dom';
import { el, getWuxing, unwrapBoardData } from './shared';

interface GanArchetype {
  archetype: string;
  nature: string;
  talents: string[];
  advice: string;
}

const GAN_ARCHETYPES: Record<string, GanArchetype> = {
  甲: {
    archetype: '参天乔木 · 顶天立地栋梁之材',
    nature: '如森林参天大木，直爽仁慈，不屈不挠，极具开拓进取精神与担当骨气。',
    talents: ['战略统筹与方向把控', '敢为人先的开拓领导力', '重视信诺与团队保护欲'],
    advice: '多发挥主心骨与带头作用，同时注意刚柔相济，善于接纳他人意见。',
  },
  乙: {
    archetype: '藤萝秀木 · 柔韧借势灵动之华',
    nature: '如幽兰藤萝、春日繁花，柔韧变通，善于在复杂多变的环境中借势生发。',
    talents: ['人际协调与资源整合', '敏锐审美与艺术灵性', '逆境中的极强韧性与适应力'],
    advice: '多借力优质平台与贵人同行，善用巧劲，避免独自硬碰硬。',
  },
  丙: {
    archetype: '普照烈阳 · 光明磊落领袖之光',
    nature: '如夏日骄阳，热情大度，光明磊落，能给予周围人无限温暖、能量与方向感。',
    talents: ['强烈的感染力与公众影响力', '快速决策与全局把控', '大方坦荡的人格魅力'],
    advice: '热情之余注重细节把控与长久沉淀，避免急于求成或单次消耗过大。',
  },
  丁: {
    archetype: '万家灯火 · 洞察精微智慧之烛',
    nature: '如夜空烛火、星汉微光，细腻温厚，思维深邃，极具奉献精神与启发他人之灵光。',
    talents: ['深层洞察与专注钻研', '善于抚慰人心与赋能团队', '独特细腻的洞见与创意灵感'],
    advice: '专注自身擅长领域深耕，保持充沛内心能量，防过度思虑耗神。',
  },
  戊: {
    archetype: '巍峨高山 · 厚德载物坚实大地',
    nature: '如昆仑厚土、崇山峻岭，沉稳厚重，重信守诺，能承载重任与长期托付。',
    talents: ['沉稳从容的定海神针气质', '卓越的抗压与守护能力', '值得信赖的长期信用资本'],
    advice: '保持包容胸怀的同时保持适度灵动，勇于拥抱新变化与新工具。',
  },
  己: {
    archetype: '田园沃土 · 孕育万物多能之壤',
    nature: '如平原沃野、润泽良田，多才多艺，包容温和，善于调和矛盾、成全他人。',
    talents: ['全能多面手与精细化管理', '极佳的亲和力与包容心', '善于把复杂事物落地落实'],
    advice: '多坚持自身核心主见，明确底线，在成全他人的同时成就自我。',
  },
  庚: {
    archetype: '重器神兵 · 刚毅果决先锋之剑',
    nature: '如百炼精钢、开山利刃，性情刚烈，讲义气，重实干，斩断阻滞绝不拖泥带水。',
    talents: ['极高的执行力与攻坚破局力', '鲜明的是非观与正义担当', '大开大合的改革创新魄力'],
    advice: '大勇之后重在大谋，遇事三思而后动，涵养平和中正之气。',
  },
  辛: {
    archetype: '璀璨珍珠 · 秀拔精致清贵之玉',
    nature: '如温润美玉、精雕首饰，灵秀高雅，追求极致完美与生活品质。',
    talents: ['追求卓越的工匠精神与精致度', '敏锐的品味鉴赏与批判思维', '自律自强的清贵气质'],
    advice: '接纳过程中的不完美，放宽眼界，不拘小节则格局更加宏阔。',
  },
  壬: {
    archetype: '奔涌江海 · 汪洋恣肆宏略之水',
    nature: '如长江大河、汪洋大海，奔流不息，富有大格局观，智谋深邃，通达万物。',
    talents: ['宏观视野与前瞻预判能力', '强大的流动性与跨界整合力', '宽广深沉的包容力与应变力'],
    advice: '善建堤防以导汪洋，设定清晰长远目标，持续深耕方成大器。',
  },
  癸: {
    archetype: '润物甘霖 · 随方就圆灵慧之露',
    nature: '如润物细雨、清晨甘露，灵动清幽，善解人意，具有极高的情商与灵性直觉。',
    talents: ['超强的同理心与沟通穿透力', '见微知著的灵感直觉', '润物无声的渗透与转化力'],
    advice: '保持自信笃定，注重身心能量闭环，避免思虑过多而优柔寡断。',
  },
};

const WUXING_HABIT_MAP: Record<string, string> = {
  木: '宜亲近绿植森林、早起舒展、坚持读书进修；适合文化教育、创意策划、设计生长型领域。',
  火: '宜多晒太阳、保持运动热情与社交表达；适合传播演艺、科技互联网、能源与公众影响力领域。',
  土: '宜规律作息、脚踏实地积累信用与不动产；适合实业管理、建筑规划、顾问咨询与稳健运营。',
  金: '宜培养自律秩序、果断断舍离与体能训练；适合金融法务、精密工程、制度管理与技术攻坚。',
  水: '宜临水漫步、深度复盘思考与跨界交流；适合贸易流通、智库谋略、数字自由职业与灵活投资。',
};

const TEN_GOD_PLAIN_STAGE: Record<string, string> = {
  比肩: '独立自主、结交同道、强化个人实力的阶段，宜凭真本事稳扎稳打。',
  劫财: '人脉拓展、合作竞争并存的阶段，宜优势互补并注意财务边界。',
  食神: '才华舒展、深耕专业、注重生活品质与口碑积累的平和充实期。',
  伤官: '思维活跃、突破常规、敢于创新表现与跨界破局的锋芒进取期。',
  偏财: '视野开阔、资源流动加快、把握多元市场机会与副业拓展的活跃期。',
  正财: '深耕主业、稳健积累财富、注重契约与家庭责任的踏实收获期。',
  七杀: '担当重任、直面挑战、开拓新局面的抗压突破期，宜谋定后动。',
  正官: '职位晋升、建立社会声望、讲求规则秩序与平台认可的稳步上升期。',
  偏印: '独辟蹊径、钻研冷门专精技艺、向内沉淀深度思考的洞察期。',
  正印: '贵人提携、考学进修、获得资历背书与长辈庇护的涵养蓄力期。',
};

const SHENSHA_PLAIN_MAP: Record<string, { badge: '吉神' | '凶煞' | '特征'; desc: string }> = {
  天乙贵人: {
    badge: '吉神',
    desc: '命中最高级别的解厄扶助贵人，遇事易逢凶化吉、得长辈或实力贵人提拔提携。',
  },
  太极贵人: {
    badge: '吉神',
    desc: '主聪明好学、悟性极高，对传统文化、哲学逻辑或深层规律有天然亲和力。',
  },
  文昌贵人: {
    badge: '吉神',
    desc: '主聪明好学、文思敏捷、表达清晰，利于考学升造、写作策划与专业技术名声。',
  },
  天德贵人: {
    badge: '吉神',
    desc: '主心地仁厚、一生少大灾大难，关键时刻常有温和力量化解阻滞。',
  },
  月德贵人: {
    badge: '吉神',
    desc: '主处事温和、人缘宽厚，易得师友与家庭助力，具逢凶化吉之福泽。',
  },
  福星贵人: {
    badge: '吉神',
    desc: '主心态旷达、衣食安稳，日常生活中多小确幸与平稳福气。',
  },
  国印贵人: {
    badge: '吉神',
    desc: '主办事公道、诚实可靠，适合在大型机构、团队管理或正式平台掌印履职。',
  },
  禄神: {
    badge: '吉神',
    desc: '主衣食奉禄、凭自身能力稳健获取正途收入，代表务实充沛的生命底气。',
  },
  金舆: {
    badge: '吉神',
    desc: '古代象征华丽车乘，现代多主出行便利、生活体面，亦利配偶与家庭福气。',
  },
  将星: {
    badge: '吉神',
    desc: '主组织统御力与核心骨干气质，临危不乱，在团队中容易成为掌舵者或主心骨。',
  },
  驿马: {
    badge: '特征',
    desc: '主走动迁移、出差远行、异地发展或跨界变动，越流动越容易打开新局面。',
  },
  华盖: {
    badge: '特征',
    desc: '主独立思考、清高专注，极具艺术审美、哲学宗教或专精学术才华。',
  },
  桃花: {
    badge: '特征',
    desc: '又称咸池，主人缘魅力、审美感知力、社交吸引力与情感机缘。',
  },
  咸池: {
    badge: '特征',
    desc: '又称桃花，主人缘魅力、审美感知力、社交吸引力与情感机缘。',
  },
  红鸾: {
    badge: '吉神',
    desc: '主喜庆良缘、外貌亲和，利于恋爱成家、人际结盟与喜事临门。',
  },
  天喜: {
    badge: '吉神',
    desc: '主开心喜庆、添丁或合作顺遂，能为生活带来温暖明朗的人际氛围。',
  },
  学堂: {
    badge: '吉神',
    desc: '主学习吸收能力强、崇尚知识，利于求学考证与教育科研领域。',
  },
  词馆: {
    badge: '吉神',
    desc: '主口才文采出众、逻辑严密，适合文案、演讲、教研与咨询传播工作。',
  },
  天医: {
    badge: '吉神',
    desc: '主注重身心康养，对医学、心理学、养生护理或助人疗愈有独特缘分。',
  },
  羊刃: {
    badge: '凶煞',
    desc: '主刚毅果决、突破攻坚之锋芒，执行力极强；宜刚柔并济、克制冲动方能化刃为权。',
  },
  魁罡: {
    badge: '特征',
    desc: '主性格刚直聪敏、赏罚分明、极具魄力，宜掌握专业硬核技能与领导权威。',
  },
  金神: {
    badge: '特征',
    desc: '主锋芒锐利、才干突出，经历练打磨后易在专业领域崭露头角。',
  },
  孤辰: {
    badge: '特征',
    desc: '主精神独立、不喜盲从热闹，需要保留独处充电的私人空间。',
  },
  寡宿: {
    badge: '特征',
    desc: '主内心清净、慢热审慎，感情上重精神共鸣胜过表面应酬。',
  },
  劫煞: {
    badge: '凶煞',
    desc: '主行事迅猛、偶有突发变动，日常宜做好备选预案、避免冲动冒险。',
  },
  亡神: {
    badge: '凶煞',
    desc: '主城府深沉、思虑周密，宜将心力用于正途谋略，防过度焦虑内耗。',
  },
  灾煞: {
    badge: '凶煞',
    desc: '提醒出行与日常运动注意安全防护，凡事留有余地、稳中求进。',
  },
  岁煞: {
    badge: '凶煞',
    desc: '属三煞之一，提醒重大变动、修造搬迁或人际磨合期多加谨慎，避免硬碰硬。',
  },
  勾绞煞: {
    badge: '凶煞',
    desc: '提醒在合作签约与人际往来中厘清权责，避免不必要的口舌纠葛。',
  },
  阴差阳错: {
    badge: '特征',
    desc: '提醒在亲密关系与姻缘沟通中多换位思考，减少因误会或逞强带来的隔阂。',
  },
  十恶大败: {
    badge: '特征',
    desc: '提醒做好长期储蓄与预算规划，避免大起大落或冲动消费。',
  },
  空亡: {
    badge: '特征',
    desc: '代表对名利执念较淡、富有跳跃性灵感，适合在务实落地上多下功夫。',
  },
};

const ZIWEI_PALACE_PLAIN: Record<string, { title: string; meaning: string }> = {
  命宫: {
    title: '命宫 · 先天个性与人生总枢',
    meaning: '代表你与生俱来的性格底色、核心天赋与一生运势的总方向盘。',
  },
  身宫: {
    title: '身宫 · 后天努力与中年重心',
    meaning: '代表你后天最执着投入的人生领域，30岁后其影响力尤为显著。',
  },
  官禄: {
    title: '官禄宫 · 事业模式与职场舞台',
    meaning: '展示你适合的工作方式、创业或就业倾向，以及职场晋升能量。',
  },
  财帛: {
    title: '财帛宫 · 理财观念与求财通道',
    meaning: '反映你赚取财富的主要方式、花钱习惯以及适合的财务配置策略。',
  },
  夫妻: {
    title: '夫妻宫 · 感情审美与伴侣互动',
    meaning: '揭示你容易被哪类伴侣吸引，以及亲密关系中的相处之道。',
  },
  迁移: {
    title: '迁移宫 · 外出发展与社交第一印象',
    meaning: '代表你在外地发展的机缘、社交场合给人的印象及外部贵人运。',
  },
  福德: {
    title: '福德宫 · 内心精神世界与福气',
    meaning: '决定你的情绪抗压能力、生活情趣、精神满足感与隐形财源福份。',
  },
};

const BAZHAI_LUCK_PLAIN: Record<string, { title: string; desc: string }> = {
  生气: {
    title: '生气方 · 大吉进取位',
    desc: '象征蓬勃生机、事业进取与贵人活力，最宜作为办公桌朝向、书房或主入口。',
  },
  延年: {
    title: '延年方 · 人际感情位',
    desc: '象征关系融洽、姻缘美满与财务稳固，极利主卧床头、客厅会客与合作洽谈。',
  },
  天医: {
    title: '天医方 · 身心康养位',
    desc: '象征健康疗愈、睡眠安稳与温和贵人，适合长辈休息、卧室养神或日常休整。',
  },
  伏位: {
    title: '伏位方 · 平稳守成位',
    desc: '象征内心安定、静心思考与稳扎稳打，适合阅读静坐、日常稳步积累。',
  },
};

const PILLAR_KEYS = ['year', 'month', 'day', 'hour'] as const;
const PILLAR_STAGE_META: Record<
  (typeof PILLAR_KEYS)[number],
  { act: string; label: string; ageSpan: string; metaphorTitle: string; plainRole: string }
> = {
  year: {
    act: '第一幕 · 家族祖荫与早年根基',
    label: '年柱（根）',
    ageSpan: '约 1–18 岁',
    metaphorTitle: '大树之根 · 家庭土壤与童年底色',
    plainRole: '反映你的原生家庭氛围、长辈缘分与少年时期的外在性格基础。',
  },
  month: {
    act: '第二幕 · 青年成长与事业主干',
    label: '月柱（苗）',
    ageSpan: '约 19–36 岁',
    metaphorTitle: '大树之干 · 社会立身与核心赛道',
    plainRole: '决定八字气候（月令）与人生格局，代表青年求学、职场打拼与同辈合作模式。',
  },
  day: {
    act: '第三幕 · 本我心性与婚姻花朵',
    label: '日柱（花）',
    ageSpan: '约 37–54 岁',
    metaphorTitle: '大树之花 · 核心自我与亲密伴侣',
    plainRole: '日干就是你自己（日元），日支则是你的婚姻宫，代表中年黄金期与小家庭生活。',
  },
  hour: {
    act: '第四幕 · 晚年归宿与人生硕果',
    label: '时柱（果）',
    ageSpan: '约 55 岁以后',
    metaphorTitle: '大树之果 · 事业结晶与晚年福泽',
    plainRole: '代表你一生的最终沉淀作品、子女晚辈缘分、下属助力与晚年生活状态。',
  },
};

function resolveBaziChart(baziRec: UnknownRecord | undefined): {
  chart: UnknownRecord | undefined;
  isApproximate: boolean;
} {
  if (!baziRec) return { chart: undefined, isApproximate: false };
  const directChart = asRecord(baziRec.chart);
  if (directChart) return { chart: directChart, isApproximate: false };
  const unknown = asRecord(baziRec.unknown);
  const segments = asArray(unknown?.segments);
  const firstSeg = asRecord(segments[0]);
  if (firstSeg) return { chart: firstSeg, isApproximate: true };
  return { chart: undefined, isApproximate: false };
}

function buildCopyMarkdown(
  dayGan: string,
  dayWuxing: string,
  pillarSummary: string,
  strengthStatus: string,
  patternName: string,
  usefulGodStr: string,
  favorableWuxingStr: string,
  archetypeInfo: GanArchetype,
  strengthPlain: string,
  pillarLines: string[],
  shenshaLines: string[],
  ziweiLines: string[],
  crossLines: string[],
  glossaryLines: string[],
): string {
  const parts: string[] = [
    '# 📖 命录 · 个人命理全息白话档案',
    `> 四柱八字：${pillarSummary}`,
    `> 核心坐标：日主${dayGan}${dayWuxing}（${strengthStatus}） · 格局【${patternName}】 · 喜用神【${usefulGodStr}（${favorableWuxingStr}）】`,
    '',
    '## 💡 一、小白一分钟导读',
    `- **命格核心原型**：${archetypeInfo.archetype}`,
    `- **自然意象**：${archetypeInfo.nature}`,
    `- **旺衰与喜用白话解**：${strengthPlain}`,
    `- **核心天赋与职场发力点**：${archetypeInfo.talents.join('；')}。${archetypeInfo.advice}`,
    '',
    '## 🌳 二、人生四部曲：四柱八字与“根苗花果”',
    ...pillarLines.map((l) => `- ${l}`),
  ];

  if (shenshaLines.length > 0) {
    parts.push('', '## ✨ 三、命盘神煞白话解读', ...shenshaLines.map((l) => `- ${l}`));
  }
  if (ziweiLines.length > 0) {
    parts.push('', '## 🌌 四、紫微斗数核心宫位全景', ...ziweiLines.map((l) => `- ${l}`));
  }
  if (crossLines.length > 0) {
    parts.push('', '## 🧭 五、跨体系生命主题与八宅吉方', ...crossLines.map((l) => `- ${l}`));
  }
  if (glossaryLines.length > 0) {
    parts.push('', '## 📚 六、命盘专属名词白话词典', ...glossaryLines.map((l) => `- ${l}`));
  }
  return parts.join('\n');
}

export function renderMingluWikiBoard(container: HTMLElement, value: unknown): boolean {
  container.replaceChildren();
  const data = unwrapBoardData(value);
  if (!data) return false;

  const baziRec = asRecord(data.bazi);
  const { chart: baziChart, isApproximate } = resolveBaziChart(baziRec);
  const pillarsRec = asRecord(baziChart?.pillars);
  if (!baziChart || !pillarsRec) return false;

  const yearP = asRecord(pillarsRec.year);
  const monthP = asRecord(pillarsRec.month);
  const dayP = asRecord(pillarsRec.day);
  const hourP = asRecord(pillarsRec.hour);

  const dayGan = asString(dayP?.gan) ?? '甲';
  const dayWuxing = asString(dayP?.stemElement) ?? getWuxing(dayGan) ?? '木';
  const archetypeInfo = GAN_ARCHETYPES[dayGan] ?? GAN_ARCHETYPES['甲']!;

  const strengthRec = asRecord(baziChart.strength);
  const strengthStatus = asString(strengthRec?.status) ?? '中和';
  const patternRec = asRecord(baziChart.patternOverview);
  const patternName = asString(patternRec?.pattern) ?? '普通格局';
  const usefulRec = asRecord(baziChart.usefulGod);
  const usefulGodName = asString(usefulRec?.useful) ?? '待定';
  const avoidGodName = asString(usefulRec?.avoid) ?? '待定';
  const favWuxingList = asArray(usefulRec?.favorableWuxing)
    .map(asString)
    .filter((x): x is string => Boolean(x));
  const unfavWuxingList = asArray(usefulRec?.unfavorableWuxing)
    .map(asString)
    .filter((x): x is string => Boolean(x));
  const favWuxingStr = favWuxingList.join('、') || '水、木';

  const pillarSummary = [
    asString(yearP?.ganZhi) ?? '—',
    asString(monthP?.ganZhi) ?? '—',
    asString(dayP?.ganZhi) ?? '—',
    asString(hourP?.ganZhi) ?? '—',
  ].join('  ');

  const strengthExplanation =
    strengthStatus.includes('强')
      ? '你的本命日主能量充沛、底气足，像一棵枝叶繁茂的大树，最适合通过发挥才华（食伤）、开拓目标与事业管理（财官）来释放能量，在主动创造中收获成就。'
      : strengthStatus.includes('弱')
        ? '你的本命日主偏向细腻灵巧，最喜贵人师长扶持、学历技能加持（印星）以及志同道合的伙伴协作（比劫），善借平台与团队之力往往事半功倍。'
        : '你的本命能量较为均衡协调，进退有据，遇到扶持运能稳固根基，遇到发挥运能施展才干。';

  const strengthPlain = `你是【${dayGan}${dayWuxing}】命人，命局状态为【${strengthStatus}】，核心格局为【${patternName}】。${strengthExplanation} 你的命盘核心调和力量（喜用神）为【${usefulGodName}（喜${favWuxingStr}）】，平时多接触【${favWuxingStr}】属性的行业、习惯与合作搭档，能让整张命盘运转得更加顺畅。`;

  const habitTips: string[] = [];
  for (const wx of favWuxingList) {
    if (WUXING_HABIT_MAP[wx]) {
      habitTips.push(`【喜${wx}调和】${WUXING_HABIT_MAP[wx]}`);
    }
  }
  if (habitTips.length === 0 && WUXING_HABIT_MAP[dayWuxing]) {
    habitTips.push(`【五行调和】${WUXING_HABIT_MAP[dayWuxing]}`);
  }
  habitTips.push(`【格局发力】你的核心格局为「${patternName}」，这是你人生实现自我价值的头号引擎。`);
  habitTips.push('【人际磁场】多与情绪稳定、优势互补的良师益友同行，减少无谓的情绪内耗。');

  const root = el('div', { className: 'minglu-dossier-root v2-result-board-stack' });

  // Prepare lines for Markdown copy
  const mdPillarLines: string[] = [];
  const mdShenshaLines: string[] = [];
  const mdZiweiLines: string[] = [];
  const mdCrossLines: string[] = [];
  const mdGlossaryLines: string[] = [];

  // =========================================================================
  // 1. Top Dossier Banner (.minglu-dossier-header)
  // =========================================================================
  const headerBanner = el('header', { className: 'board-card minglu-dossier-header' });
  const headerTop = el('div', { className: 'minglu-dossier-header-top' });

  const titleWrap = el('div', { className: 'minglu-dossier-title-wrap' });
  titleWrap.append(
    el('div', { className: 'minglu-dossier-eyebrow', text: '个人命理全景白话档案 · 零基础一页读懂' }),
    el('h2', { className: 'minglu-dossier-title board-title', text: '📖 命录 · 个人命理全息白话档案' }),
  );

  const subtitleRow = el('div', { className: 'minglu-dossier-badges' });
  subtitleRow.append(
    el('span', { className: 'board-chip is-accent', text: `四柱：${pillarSummary}` }),
    el('span', { className: 'board-chip', text: `日主：${dayGan}${dayWuxing}（${strengthStatus}）` }),
    el('span', { className: 'board-chip', text: `格局：${patternName}` }),
    el('span', { className: 'board-chip is-accent', text: `喜用神：${usefulGodName}（喜${favWuxingStr}）` }),
  );
  if (isApproximate) {
    subtitleRow.append(
      el('span', { className: 'board-chip', text: '提示：按所选时辰/时段代表性排盘展示' }),
    );
  }
  titleWrap.append(subtitleRow);

  const copyBtn = el('button', {
    type: 'button',
    className: 'minglu-copy-report-btn',
    text: '📋 复制完整命录报告',
    onClick: async () => {
      const md = buildCopyMarkdown(
        dayGan,
        dayWuxing,
        pillarSummary,
        strengthStatus,
        patternName,
        usefulGodName,
        favWuxingStr,
        archetypeInfo,
        strengthPlain,
        mdPillarLines,
        mdShenshaLines,
        mdZiweiLines,
        mdCrossLines,
        mdGlossaryLines,
      );
      try {
        await navigator.clipboard.writeText(md);
        copyBtn.textContent = '✅ 已复制完整命录报告';
        setTimeout(() => {
          copyBtn.textContent = '📋 复制完整命录报告';
        }, 2000);
      } catch {
        copyBtn.textContent = '请手动选择文本复制';
      }
    },
  });

  headerTop.append(titleWrap, copyBtn);
  headerBanner.append(headerTop);
  root.append(headerBanner);

  // =========================================================================
  // 2. Chapter Navigation Pill Bar (.minglu-toc-bar)
  // =========================================================================
  const ziweiRec = asRecord(data.ziwei);
  const ziweiNatal = asRecord(ziweiRec?.natal);
  const hasZiwei = Boolean(ziweiNatal && Array.isArray(ziweiNatal.palaces));
  const hasCrossOrBazhai = Boolean(data.astrolabe || data.bazhai || data.crossSynthesis);
  const glossaryList = asArray(data.matchedGlossary)
    .map(asRecord)
    .filter((x): x is UnknownRecord => Boolean(x));

  const tocItems: Array<{ id: string; label: string }> = [
    { id: 'minglu-sec-guide', label: '💡 小白一分钟导读' },
    { id: 'minglu-sec-pillars', label: '🌳 四柱与根苗花果' },
    { id: 'minglu-sec-wuxing', label: '⚖️ 五行与喜用指南' },
    { id: 'minglu-sec-shensha', label: '✨ 吉神与凶煞白话解' },
  ];
  if (hasZiwei) {
    tocItems.push({ id: 'minglu-sec-ziwei', label: '🌌 紫微十二宫全景' });
  }
  if (hasCrossOrBazhai) {
    tocItems.push({ id: 'minglu-sec-cross', label: '🧭 星盘与八宅吉方' });
  }
  if (glossaryList.length > 0) {
    tocItems.push({ id: 'minglu-sec-glossary', label: '📚 命盘专属名词词典' });
  }

  const tocBar = el('nav', {
    className: 'minglu-toc-bar',
    ariaLabel: '命录章节快速导航',
  });
  for (const item of tocItems) {
    const pill = el('button', {
      type: 'button',
      className: 'minglu-toc-pill',
      text: item.label,
      onClick: () => {
        const target = root.querySelector<HTMLElement>(`#${item.id}`);
        target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
    });
    tocBar.append(pill);
  }
  const dossierBody = el('div', { className: 'minglu-dossier-body' });
  const dossierMain = el('div', { className: 'minglu-dossier-main v2-result-board-stack' });
  dossierBody.append(tocBar, dossierMain);
  root.append(dossierBody);

  // =========================================================================
  // 3. Section 0: 💡 小白入门导读 · 一分钟极速读懂你的命理全景 (.minglu-beginner-hero)
  // =========================================================================
  const secGuide = el('section', { className: 'board-card minglu-beginner-hero' });
  secGuide.id = 'minglu-sec-guide';

  const guideHead = el('div', { className: 'board-head' });
  const guideTitleGrp = el('div', { className: 'board-title-group' });
  guideTitleGrp.append(
    el('h3', {
      className: 'board-title',
      text: '💡 小白入门导读 · 一分钟极速读懂你的命理全景',
    }),
    el('span', {
      className: 'board-subtitle',
      text: '跳过晦涩古文，用自然万物意象直接看懂你的性格底色、天赋优势与开运方向',
    }),
  );
  guideHead.append(guideTitleGrp);
  secGuide.append(guideHead);

  const archetypeBox = el('div', { className: 'minglu-archetype-banner' });
  const archetypeBadgeRow = el('div', { className: 'minglu-archetype-top' });
  archetypeBadgeRow.append(
    el('span', { className: 'minglu-archetype-tag', text: `你的本命日元：${dayGan}${dayWuxing}` }),
    el('span', { className: 'minglu-archetype-sub', text: '天人合一 · 自然万物意象' }),
  );
  archetypeBox.append(
    archetypeBadgeRow,
    el('h4', { className: 'minglu-archetype-headline', text: archetypeInfo.archetype }),
    el('p', { className: 'minglu-archetype-desc', text: archetypeInfo.nature }),
  );
  secGuide.append(archetypeBox);

  const strengthPlainBox = el('div', { className: 'minglu-plain-callout' });
  strengthPlainBox.append(
    el('strong', { text: '🔍 身强身弱与喜用神大白话解读：' }),
    el('span', { text: strengthPlain }),
  );
  secGuide.append(strengthPlainBox);

  const guideDualGrid = el('div', { className: 'minglu-dual-grid' });

  // 左卡：核心天赋与职场发力点
  const talentCard = el('div', { className: 'minglu-guide-subcard' });
  talentCard.append(
    el('h5', { className: 'minglu-subcard-title', text: '🎯 你的核心天赋与职场发力点' }),
  );
  const talentList = el('ul', { className: 'minglu-bullet-list' });
  for (const t of archetypeInfo.talents) {
    talentList.append(el('li', { text: t }));
  }
  talentList.append(el('li', { text: `成长心法：${archetypeInfo.advice}` }));
  talentCard.append(talentList);

  // 右卡：日常生活习惯与调和建议
  const habitCard = el('div', { className: 'minglu-guide-subcard' });
  habitCard.append(
    el('h5', { className: 'minglu-subcard-title', text: '🌿 日常生活习惯与调和建议' }),
  );
  const habitList = el('ul', { className: 'minglu-bullet-list' });
  for (const h of habitTips) {
    habitList.append(el('li', { text: h }));
  }
  habitCard.append(habitList);

  guideDualGrid.append(talentCard, habitCard);
  secGuide.append(guideDualGrid);
  dossierMain.append(secGuide);

  // =========================================================================
  // 4. Section 1: 🌳 人生四部曲：四柱八字与“根苗花果”生命节律
  // =========================================================================
  const secPillars = el('section', { className: 'board-card minglu-section-card' });
  secPillars.id = 'minglu-sec-pillars';
  const pillarsHead = el('div', { className: 'board-head' });
  const pillarsTitleGrp = el('div', { className: 'board-title-group' });
  pillarsTitleGrp.append(
    el('h3', {
      className: 'board-title',
      text: '🌳 人生四部曲：四柱八字与“根苗花果”生命节律',
    }),
    el('span', {
      className: 'board-subtitle',
      text: '古人把人生比作一棵树：年柱为根、月柱为苗、日柱为花、时柱为果，对应人生四个阶段',
    }),
  );
  pillarsHead.append(pillarsTitleGrp);
  secPillars.append(pillarsHead);

  const pillarsGrid = el('div', { className: 'minglu-pillars-grid' });
  for (const key of PILLAR_KEYS) {
    const p = asRecord(pillarsRec[key]);
    const meta = PILLAR_STAGE_META[key];
    const gz = asString(p?.ganZhi) ?? '—';
    const gan = asString(p?.gan) ?? '';
    const zhi = asString(p?.zhi) ?? '';
    const tenGod = asString(p?.tenGod) ?? (key === 'day' ? '日主本人' : '—');
    const naYin = asString(p?.naYin) ?? '—';
    const lifeStage = asString(p?.lifeStage) ?? '—';
    const hiddenArr = asArray(p?.hiddenStems)
      .map(asRecord)
      .filter((x): x is UnknownRecord => Boolean(x))
      .map((h) => `${asString(h.stem) ?? ''}(${asString(h.tenGod) ?? ''})`)
      .filter(Boolean);

    const tenGodHint =
      key === 'day'
        ? `日干「${gan}」代表你自己，日支「${zhi}」代表伴侣宫与内在安全感。`
        : TEN_GOD_PLAIN_STAGE[tenGod] ?? '展现该人生阶段的外在互动模式与资源重心。';

    mdPillarLines.push(
      `**${meta.label}（${meta.ageSpan}）**：${gz}（十神：${tenGod}，纳音：${naYin}，十二长生：${lifeStage}，藏干：${hiddenArr.join('、') || '—'}）—— ${meta.plainRole}`,
    );

    const card = el('article', { className: 'minglu-pillar-story-card' });
    const topBar = el('div', { className: 'minglu-pillar-card-top' });
    topBar.append(
      el('span', { className: 'minglu-pillar-act', text: meta.act }),
      el('span', { className: 'minglu-pillar-age', text: meta.ageSpan }),
    );

    const mainRow = el('div', { className: 'minglu-pillar-main-row' });
    const gzBadge = el('div', {
      className: 'minglu-pillar-gz',
      dataset: { wuxing: getWuxing(gan) },
      text: gz,
    });
    const tagsCol = el('div', { className: 'minglu-pillar-tags' });
    tagsCol.append(
      el('span', { className: 'board-chip is-accent', text: `${meta.label} · ${tenGod}` }),
      el('span', { className: 'board-chip', text: `纳音：${naYin}` }),
      el('span', { className: 'board-chip', text: `长生：${lifeStage}` }),
    );
    mainRow.append(gzBadge, tagsCol);

    const hiddenLine = el('div', {
      className: 'minglu-pillar-hidden',
      text: `支藏潜能：${hiddenArr.join(' · ') || '—'}`,
    });

    const descP = el('p', {
      className: 'minglu-pillar-desc',
      text: `${meta.plainRole} ${tenGodHint}`,
    });

    card.append(topBar, mainRow, hiddenLine, descP);
    pillarsGrid.append(card);
  }
  secPillars.append(pillarsGrid);
  dossierMain.append(secPillars);

  // =========================================================================
  // 5. Section 2: ⚖️ 五行能量分布、格局与大运节奏
  // =========================================================================
  const secWuxing = el('section', { className: 'board-card minglu-section-card' });
  secWuxing.id = 'minglu-sec-wuxing';
  const wxHead = el('div', { className: 'board-head' });
  const wxTitleGrp = el('div', { className: 'board-title-group' });
  wxTitleGrp.append(
    el('h3', { className: 'board-title', text: '⚖️ 五行能量分布、格局与大运十年节奏' }),
    el('span', {
      className: 'board-subtitle',
      text: '原局八字好比你的原厂车型，而十年一步的“大运”则是你人生不同阶段行驶的道路气候',
    }),
  );
  wxHead.append(wxTitleGrp);
  secWuxing.append(wxHead);

  // 统计四柱天干地支与藏干中的五行分布
  const wxCounts: Record<string, { visible: number; hidden: number; labels: string[] }> = {
    木: { visible: 0, hidden: 0, labels: [] },
    火: { visible: 0, hidden: 0, labels: [] },
    土: { visible: 0, hidden: 0, labels: [] },
    金: { visible: 0, hidden: 0, labels: [] },
    水: { visible: 0, hidden: 0, labels: [] },
  };
  for (const key of PILLAR_KEYS) {
    const p = asRecord(pillarsRec[key]);
    const gan = asString(p?.gan);
    const zhi = asString(p?.zhi);
    const gWx = getWuxing(gan);
    const zWx = getWuxing(zhi);
    if (gan && gWx && wxCounts[gWx]) {
      wxCounts[gWx].visible += 1;
      wxCounts[gWx].labels.push(gan);
    }
    if (zhi && zWx && wxCounts[zWx]) {
      wxCounts[zWx].visible += 1;
      wxCounts[zWx].labels.push(zhi);
    }
    for (const h of asArray(p?.hiddenStems)) {
      const hs = asString(asRecord(h)?.stem);
      const hWx = getWuxing(hs);
      if (hs && hWx && wxCounts[hWx]) {
        wxCounts[hWx].hidden += 1;
      }
    }
  }

  const wxBarGrid = el('div', { className: 'minglu-wuxing-grid' });
  for (const wx of ['木', '火', '土', '金', '水'] as const) {
    const item = wxCounts[wx]!;
    const isFav = favWuxingList.includes(wx);
    const isAvoid = unfavWuxingList.includes(wx);
    const wxCard = el('div', {
      className: `minglu-wuxing-card${isFav ? ' is-favorable' : ''}`,
    });
    const top = el('div', { className: 'minglu-wuxing-card-top' });
    top.append(
      el('strong', {
        className: 'minglu-wuxing-name',
        dataset: { wuxing: wx },
        text: `${wx}行`,
      }),
      el('span', {
        className: `board-chip ${isFav ? 'is-accent' : ''}`.trim(),
        text: isFav ? '喜用加分' : isAvoid ? '注意节制' : '平和协调',
      }),
    );
    const countText =
      item.visible === 0 && item.hidden === 0
        ? '明字 0 · 藏干 0（原局偏缺，日常可多补充）'
        : `明字 ${item.visible} 处（${item.labels.join('')}）· 藏干 ${item.hidden} 处`;
    wxCard.append(top, el('div', { className: 'minglu-wuxing-detail', text: countText }));
    wxBarGrid.append(wxCard);
  }
  secWuxing.append(wxBarGrid);

  // 格局与喜忌一句话总结条
  const patternSummaryBar = el('div', { className: 'minglu-plain-callout' });
  patternSummaryBar.append(
    el('strong', { text: `📌 格局与用神速记：` }),
    el('span', {
      text: `本命格局为【${patternName}】，首取【${usefulGodName}（喜${favWuxingStr}）】为调和关键；日常行事注意规避【${avoidGodName}（忌${unfavWuxingList.join('、') || '过度失衡'}）】带来的急躁或内耗。`,
    }),
  );
  secWuxing.append(patternSummaryBar);

  // 大运十年节奏卡片
  const fortuneRec = asRecord(baziRec?.fortune);
  const cycles = asArray(fortuneRec?.cycles)
    .map(asRecord)
    .filter((x): x is UnknownRecord => Boolean(x));
  if (cycles.length > 0) {
    const startAgeYears = asNumber(asRecord(fortuneRec?.startAge)?.years) ?? 1;
    const fortuneSubhead = el('h4', {
      className: 'minglu-subblock-title',
      text: `🛤️ 你的十年大运人生阶梯（约 ${startAgeYears} 岁起运）`,
    });
    secWuxing.append(fortuneSubhead);

    const cycleGrid = el('div', { className: 'minglu-cycles-grid' });
    const nowMs = Date.now();
    for (const c of cycles.slice(0, 8)) {
      const idx = asNumber(c.index) ?? 0;
      const gz = asString(c.ganZhi) ?? '—';
      const startTs = asNumber(c.startTimestamp);
      const endTs = asNumber(c.endTimestamp);
      const startYear = startTs ? new Date(startTs).getUTCFullYear() : undefined;
      const endYear = endTs ? new Date(endTs).getUTCFullYear() : undefined;
      const ageStart = startAgeYears + idx * 10;
      const ageEnd = ageStart + 9;
      const isCurrent = Boolean(startTs && endTs && nowMs >= startTs && nowMs < endTs);
      const cPillar = asRecord(c.pillar);
      const cTenGod = asString(cPillar?.tenGod) ?? '';
      const cNaYin = asString(cPillar?.naYin) ?? '';
      const stageMeaning =
        TEN_GOD_PLAIN_STAGE[cTenGod] ?? '顺应时势、稳步推进个人成长与外部机缘。';

      const cCard = el('div', {
        className: `minglu-cycle-card${isCurrent ? ' is-current' : ''}`,
      });
      const cTop = el('div', { className: 'minglu-cycle-top' });
      cTop.append(
        el('strong', {
          className: 'minglu-cycle-gz',
          dataset: { wuxing: getWuxing(gz[0]) },
          text: `${gz}运${cTenGod ? ` · ${cTenGod}` : ''}`,
        }),
        el('span', {
          className: `board-chip ${isCurrent ? 'is-accent' : ''}`.trim(),
          text: isCurrent ? '当前大运' : `${ageStart}–${ageEnd}岁`,
        }),
      );
      const yearText =
        startYear && endYear
          ? `${startYear}–${endYear}年（${ageStart}–${ageEnd}岁）${cNaYin ? ` · ${cNaYin}` : ''}`
          : `${ageStart}–${ageEnd}岁`;
      cCard.append(
        cTop,
        el('div', { className: 'minglu-cycle-years', text: yearText }),
        el('p', { className: 'minglu-cycle-desc', text: stageMeaning }),
      );
      cycleGrid.append(cCard);
    }
    secWuxing.append(cycleGrid);
  }
  dossierMain.append(secWuxing);

  // =========================================================================
  // 6. Section 3: ✨ 你的命盘神煞白话解读
  // =========================================================================
  const secShensha = el('section', { className: 'board-card minglu-section-card' });
  secShensha.id = 'minglu-sec-shensha';
  const ssHead = el('div', { className: 'board-head' });
  const ssTitleGrp = el('div', { className: 'board-title-group' });
  ssTitleGrp.append(
    el('h3', { className: 'board-title', text: '✨ 你的命盘吉神与凶煞白话解读' }),
    el('span', {
      className: 'board-subtitle',
      text: '神煞是古人总结的人生彩蛋与风险路标：吉神代表潜在贵人与天赋，凶煞则是提醒你留意的性格棱角',
    }),
  );
  ssHead.append(ssTitleGrp);
  secShensha.append(ssHead);

  const shenshaRec = asRecord(baziChart.shensha);
  const groupedShensha = new Map<string, Set<string>>();
  const posLabels: Record<string, string> = {
    year: '年柱',
    month: '月柱',
    day: '日柱',
    hour: '时柱',
  };
  for (const g of asArray(shenshaRec?.global)) {
    const rec = asRecord(g);
    const name = asString(rec?.name);
    if (!name) continue;
    if (!groupedShensha.has(name)) groupedShensha.set(name, new Set());
    groupedShensha.get(name)!.add('全局');
  }
  for (const e of asArray(shenshaRec?.entries)) {
    const rec = asRecord(e);
    const name = asString(rec?.name);
    const pos = asString(rec?.position);
    if (!name) continue;
    if (!groupedShensha.has(name)) groupedShensha.set(name, new Set());
    groupedShensha.get(name)!.add(pos && posLabels[pos] ? posLabels[pos] : '四柱');
  }

  if (groupedShensha.size === 0) {
    secShensha.append(
      el('p', {
        className: 'minglu-empty-hint',
        text: '当前四柱未命中特殊神煞，以四柱五行与十神格局本身为主。',
      }),
    );
  } else {
    const ssGrid = el('div', { className: 'minglu-shensha-grid' });
    for (const [name, posSet] of groupedShensha.entries()) {
      const known = SHENSHA_PLAIN_MAP[name];
      const glossaryFallback = glossaryList.find((g) => asString(g.term)?.includes(name));
      const badgeType = known?.badge ?? '特征';
      const plainDesc =
        known?.desc ??
        asString(glossaryFallback?.shortDesc) ??
        '传统命理星煞标记，代表特定的性格侧面或阶段际遇提醒。';
      const posText = Array.from(posSet).join('、');

      mdShenshaLines.push(`**${name}**（${badgeType} · 落于${posText}）：${plainDesc}`);

      const ssCard = el('div', {
        className: `minglu-shensha-card is-${badgeType === '吉神' ? 'lucky' : badgeType === '凶煞' ? 'warn' : 'neutral'}`,
      });
      const top = el('div', { className: 'minglu-shensha-top' });
      top.append(
        el('strong', { className: 'minglu-shensha-name', text: name }),
        el('div', { className: 'minglu-shensha-chips' },
          el('span', {
            className: `board-chip ${badgeType === '吉神' ? 'is-accent' : ''}`.trim(),
            text: badgeType,
          }),
          el('span', { className: 'board-chip', text: posText }),
        ),
      );
      ssCard.append(top, el('p', { className: 'minglu-shensha-desc', text: plainDesc }));
      ssGrid.append(ssCard);
    }
    secShensha.append(ssGrid);
  }
  dossierMain.append(secShensha);

  // =========================================================================
  // 7. Section 4: 🌌 紫微斗数十二宫与人生核心领域全景 (if data.ziwei?.natal exists)
  // =========================================================================
  if (hasZiwei && ziweiNatal) {
    const secZiwei = el('section', { className: 'board-card minglu-section-card' });
    secZiwei.id = 'minglu-sec-ziwei';
    const zwHead = el('div', { className: 'board-head' });
    const zwTitleGrp = el('div', { className: 'board-title-group' });
    const fiveClass = asString(ziweiNatal.fiveElementsClass) ?? '';
    const soulStar = asString(ziweiNatal.soul) ?? '';
    const bodyStar = asString(ziweiNatal.body) ?? '';
    zwTitleGrp.append(
      el('h3', { className: 'board-title', text: '🌌 紫微斗数十二宫与人生核心领域全景' }),
      el('span', {
        className: 'board-subtitle',
        text: `紫微斗数将人生划分为十二个房间（宫位），直观展现你在事业、财富、感情与内心的具体表现${fiveClass ? ` · ${fiveClass}` : ''}${soulStar ? ` · 命主${soulStar}` : ''}${bodyStar ? ` · 身主${bodyStar}` : ''}`,
      }),
    );
    zwHead.append(zwTitleGrp);
    secZiwei.append(zwHead);

    const palaces = asArray(ziweiNatal.palaces)
      .map(asRecord)
      .filter((x): x is UnknownRecord => Boolean(x));

    const focusOrder = ['命宫', '官禄', '财帛', '夫妻', '迁移', '福德'];
    const selectedPalaces: Array<{ palace: UnknownRecord; customHeader?: { title: string; meaning: string } }> = [];

    for (const pName of focusOrder) {
      const found = palaces.find((p) => asString(p.name) === pName);
      if (found) {
        selectedPalaces.push({ palace: found, customHeader: ZIWEI_PALACE_PLAIN[pName] });
      }
    }
    const bodyPalace = palaces.find((p) => Boolean(p.isBodyPalace));
    if (bodyPalace) {
      selectedPalaces.splice(1, 0, {
        palace: bodyPalace,
        customHeader: {
          title: `身宫（寄于${asString(bodyPalace.name) ?? ''}宫）· 后天着力点`,
          meaning: ZIWEI_PALACE_PLAIN['身宫']!.meaning,
        },
      });
    }

    const zwGrid = el('div', { className: 'minglu-ziwei-grid' });
    for (const { palace, customHeader } of selectedPalaces) {
      const pName = asString(palace.name) ?? '宫位';
      const stem = asString(palace.heavenlyStem) ?? '';
      const branch = asString(palace.earthlyBranch) ?? '';
      const majorStars = asArray(palace.majorStars)
        .map(asRecord)
        .filter((x): x is UnknownRecord => Boolean(x));
      const minorStars = asArray(palace.minorStars)
        .map(asRecord)
        .filter((x): x is UnknownRecord => Boolean(x));

      const starTexts = majorStars.map((s) => {
        const sName = asString(s.name) ?? '';
        const bright = asString(s.brightness) ? `(${asString(s.brightness)})` : '';
        const mut = asString(s.mutagen) ? ` [化${asString(s.mutagen)}]` : '';
        return `${sName}${bright}${mut}`;
      });
      const minorTexts = minorStars
        .slice(0, 4)
        .map((s) => {
          const sName = asString(s.name) ?? '';
          const mut = asString(s.mutagen) ? `[化${asString(s.mutagen)}]` : '';
          return `${sName}${mut}`;
        })
        .filter(Boolean);

      const headerInfo = customHeader ??
        ZIWEI_PALACE_PLAIN[pName] ?? {
          title: `${pName}宫`,
          meaning: '反映该人生领域的星曜配置与能量重心。',
        };
      const starsDisplay =
        starTexts.length > 0 ? starTexts.join('、') : '本宫无主星（弹性较大，常借对宫星曜参看）';

      mdZiweiLines.push(
        `**${headerInfo.title}**（${stem}${branch}）：主星【${starsDisplay}】${minorTexts.length ? `，辅曜【${minorTexts.join('、')}】` : ''} —— ${headerInfo.meaning}`,
      );

      const pCard = el('div', { className: 'minglu-ziwei-card' });
      const top = el('div', { className: 'minglu-ziwei-card-top' });
      top.append(
        el('strong', { className: 'minglu-ziwei-title', text: headerInfo.title }),
        el('span', { className: 'board-chip', text: `${stem}${branch}宫` }),
      );
      const starsRow = el('div', {
        className: 'minglu-ziwei-stars',
        text: `主星：${starsDisplay}`,
      });
      pCard.append(top, starsRow);
      if (minorTexts.length > 0) {
        pCard.append(
          el('div', {
            className: 'minglu-ziwei-minors',
            text: `吉辅/四化：${minorTexts.join(' · ')}`,
          }),
        );
      }
      pCard.append(el('p', { className: 'minglu-ziwei-desc', text: headerInfo.meaning }));
      zwGrid.append(pCard);
    }
    secZiwei.append(zwGrid);
    dossierMain.append(secZiwei);
  }

  // =========================================================================
  // 8. Section 5: 🧭 西洋星盘三大核心落座与八宅吉利方位
  // =========================================================================
  if (hasCrossOrBazhai) {
    const secCross = el('section', { className: 'board-card minglu-section-card' });
    secCross.id = 'minglu-sec-cross';
    const crossHead = el('div', { className: 'board-head' });
    const crossTitleGrp = el('div', { className: 'board-title-group' });
    crossTitleGrp.append(
      el('h3', { className: 'board-title', text: '🧭 西洋星盘三大核心主题与八宅吉利方位' }),
      el('span', {
        className: 'board-subtitle',
        text: '从中西跨体系视角综合对照你的本命心性、事业财富通道，以及最适合你的日常办公与居住吉方',
      }),
    );
    crossHead.append(crossTitleGrp);
    secCross.append(crossHead);

    const crossRec = asRecord(data.crossSynthesis);
    const dims = asArray(crossRec?.dimensions)
      .map(asRecord)
      .filter((x): x is UnknownRecord => Boolean(x));

    if (dims.length > 0) {
      const dimGrid = el('div', { className: 'minglu-cross-grid' });
      for (const d of dims) {
        const label = asString(d.label) ?? '核心维度';
        const dCard = el('div', { className: 'minglu-cross-card' });
        dCard.append(el('h4', { className: 'minglu-cross-title', text: `📌 ${label}` }));
        const list = el('ul', { className: 'minglu-bullet-list' });
        const baziF = asString(d.baziFocus);
        const ziweiF = asString(d.ziweiFocus);
        const astroF = asString(d.astrolabeFocus);
        const bazhaiF = asString(d.bazhaiFocus);
        if (baziF) list.append(el('li', { text: `八字视角：${baziF}` }));
        if (ziweiF) list.append(el('li', { text: `紫微视角：${ziweiF}` }));
        if (astroF) list.append(el('li', { text: `星盘视角：${astroF}` }));
        if (bazhaiF) list.append(el('li', { text: `八宅方位：${bazhaiF}` }));
        dCard.append(list);
        dimGrid.append(dCard);

        mdCrossLines.push(
          `**${label}**：${[baziF && `八字(${baziF})`, ziweiF && `紫微(${ziweiF})`, astroF && `星盘(${astroF})`, bazhaiF && `八宅(${bazhaiF})`].filter(Boolean).join(' ｜ ')}`,
        );
      }
      secCross.append(dimGrid);
    }

    // 八宅四吉方卡片
    const bazhaiRec = asRecord(data.bazhai);
    const mingPalaces = asArray(bazhaiRec?.mingPalaces)
      .map(asRecord)
      .filter((x): x is UnknownRecord => Boolean(x));
    const firstMing = mingPalaces[0];
    if (firstMing) {
      const guaName = asString(firstMing.gua) ?? '';
      const bzPalaces = asArray(firstMing.palaces)
        .map(asRecord)
        .filter((x): x is UnknownRecord => Boolean(x));
      const auspicious = bzPalaces.filter((p) => {
        const lbl = asString(p.label);
        return lbl && lbl in BAZHAI_LUCK_PLAIN;
      });
      if (auspicious.length > 0) {
        secCross.append(
          el('h4', {
            className: 'minglu-subblock-title',
            text: `🏠 你的本命卦【${guaName}卦】四大吉利方位指南`,
          }),
        );
        const bzGrid = el('div', { className: 'minglu-bazhai-grid' });
        for (const p of auspicious) {
          const lbl = asString(p.label) ?? '';
          const dir = asString(p.direction) ?? '';
          const info = BAZHAI_LUCK_PLAIN[lbl]!;
          const bCard = el('div', { className: 'minglu-bazhai-card' });
          const top = el('div', { className: 'minglu-bazhai-top' });
          top.append(
            el('strong', { text: info.title }),
            el('span', { className: 'board-chip is-accent', text: `正${dir} / ${dir}方` }),
          );
          bCard.append(top, el('p', { className: 'minglu-bazhai-desc', text: info.desc }));
          bzGrid.append(bCard);
        }
        secCross.append(bzGrid);
      }
    }

    dossierMain.append(secCross);
  }

  // =========================================================================
  // 9. Section 6: 📚 你的命盘专属名词白话小词典 (data.matchedGlossary)
  // =========================================================================
  if (glossaryList.length > 0) {
    const secGlossary = el('section', { className: 'board-card minglu-section-card' });
    secGlossary.id = 'minglu-sec-glossary';
    const glHead = el('div', { className: 'board-head' });
    const glTitleGrp = el('div', { className: 'board-title-group' });
    glTitleGrp.append(
      el('h3', {
        className: 'board-title',
        text: `📚 你的命盘专属名词白话小词典（共命中 ${glossaryList.length} 项）`,
      }),
      el('span', {
        className: 'board-subtitle',
        text: '自动提取你命盘里出现的专业名词并翻译成大白话，零基础也能轻松查明白',
      }),
    );
    glHead.append(glTitleGrp);
    secGlossary.append(glHead);

    const glGrid = el('div', { className: 'minglu-glossary-grid' });
    for (const g of glossaryList) {
      const term = asString(g.term) ?? '';
      const category = asString(g.category) ?? '术语';
      const pinyin = asString(g.pinyin) ?? '';
      const shortDesc = asString(g.shortDesc) ?? '';
      const classicSource = asString(g.classicSource);

      mdGlossaryLines.push(`**${term}**（${category}）：${shortDesc}`);

      const gCard = el('div', { className: 'minglu-glossary-card' });
      const top = el('div', { className: 'minglu-glossary-top' });
      const left = el('div', { className: 'minglu-glossary-term-wrap' });
      left.append(el('strong', { className: 'minglu-glossary-term', text: term }));
      if (pinyin) {
        left.append(el('span', { className: 'minglu-glossary-pinyin', text: pinyin }));
      }
      top.append(left, el('span', { className: 'board-chip', text: category }));
      gCard.append(top, el('p', { className: 'minglu-glossary-desc', text: shortDesc }));
      if (classicSource) {
        gCard.append(el('div', { className: 'minglu-glossary-source', text: classicSource }));
      }
      glGrid.append(gCard);
    }
    secGlossary.append(glGrid);
    dossierMain.append(secGlossary);
  }

  container.append(root);
  return true;
}
