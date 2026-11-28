const SHIYUE_ORACLE_ART_PATH = '/cards/oracle';
const RECOMPOSED_CARD_IDS = new Set([10, 39, 41, 42, 44, 47, 48, 54, 56]);

export const SHIYUE_ORACLE_BACK_IMAGE_URL = `${SHIYUE_ORACLE_ART_PATH}/back.webp`;

export interface ShiyueOracleCardDefinition {
  id: number;
  ganzhi: string;
  title: string;
  nayin: string;
  meaning: string;
  guidance: string;
}

export interface ShiyueOracleSpreadSpec {
  id: 'single' | 'three' | 'five';
  name: string;
  positions: readonly string[];
}

export interface DrawnShiyueOracleCard extends ShiyueOracleCardDefinition {
  position: string;
}

export const SHIYUE_ORACLE_SPREADS: Record<ShiyueOracleSpreadSpec['id'], ShiyueOracleSpreadSpec> = {
  single: { id: 'single', name: '单牌直断', positions: ['核心指引'] },
  three: { id: 'three', name: '三牌脉络', positions: ['过往根源', '当下课题', '后续指引'] },
  five: { id: 'five', name: '五行五象', positions: ['现状', '助力', '阻碍', '关键转折', '行动方向'] },
};

const RAW_CARDS: ReadonlyArray<Omit<ShiyueOracleCardDefinition, 'id'>> = [
  { ganzhi: '甲子', title: '海藏新生', nayin: '海中金', meaning: '力量尚藏于深处，新局已经萌芽，但暂未到完全显露的时候。', guidance: '先保护最初的想法与资源，小步验证，不必急于证明结果。' },
  { ganzhi: '乙丑', title: '厚土藏珍', nayin: '海中金', meaning: '真正有价值的事物正在稳定环境中积累，耐心比速度更重要。', guidance: '整理基础、保存实力，持续投入能够经受时间检验的事情。' },
  { ganzhi: '丙寅', title: '炉火初燃', nayin: '炉中火', meaning: '热情和行动力刚被点燃，适合启动、试做与唤醒停滞之事。', guidance: '趁动力清晰时迈出第一步，同时控制节奏，避免一开始就耗尽心力。' },
  { ganzhi: '丁卯', title: '心焰成光', nayin: '炉中火', meaning: '内在信念逐渐转化为稳定影响，真诚表达能够照亮方向。', guidance: '把感受说清楚，将热情落实成持续行动，不因外界杂音偏离初心。' },
  { ganzhi: '戊辰', title: '万木参天', nayin: '大林木', meaning: '多方力量共同生长，局面具有扩展、协作和形成规模的潜力。', guidance: '主动连接合适的人与资源，在扩张前先建立清楚的分工和边界。' },
  { ganzhi: '己巳', title: '林深养息', nayin: '大林木', meaning: '繁盛之后需要回到内部修复，暂时的安静是在为下一阶段蓄力。', guidance: '减少无效消耗，照顾身心与核心关系，让重要事情获得恢复空间。' },
  { ganzhi: '庚午', title: '路土承行', nayin: '路旁土', meaning: '方向要靠实际行走才能形成，眼前重在执行而非反复设想。', guidance: '选择一条可行路径持续推进，边走边修正，不必等所有条件完美。' },
  { ganzhi: '辛未', title: '稳步成途', nayin: '路旁土', meaning: '重复而稳定的行动正在铺成可靠道路，进展虽慢却可累积。', guidance: '维持规律、兑现承诺，把大目标拆成能够每日完成的小步骤。' },
  { ganzhi: '壬申', title: '剑锋破障', nayin: '剑锋金', meaning: '需要以清晰判断切开阻碍，拖延和含糊已不再有利。', guidance: '直面核心问题，果断舍弃无效选项，但避免把决断变成伤人的锋芒。' },
  { ganzhi: '癸酉', title: '淬炼成器', nayin: '剑锋金', meaning: '压力正在磨炼能力，严格标准会使成果变得成熟而可用。', guidance: '接受必要的修正与训练，专注打磨关键能力，不因短期不适而放弃。' },
  { ganzhi: '甲戌', title: '山火照途', nayin: '山头火', meaning: '远处的光已经指出方向，愿景能够带领自己越过当前局限。', guidance: '确认长期目标后大胆前进，同时保留现实路线与风险预案。' },
  { ganzhi: '乙亥', title: '星火燎原', nayin: '山头火', meaning: '微小契机可能迅速扩散，影响力正在超出最初预期。', guidance: '把握传播与合作机会，也要及时设定边界，防止局势失去控制。' },
  { ganzhi: '丙子', title: '涧水初鸣', nayin: '涧下水', meaning: '细微信息与直觉开始流动，新方向正通过小迹象出现。', guidance: '安静观察并记录线索，从低成本尝试开始，不要忽略最初的感受。' },
  { ganzhi: '丁丑', title: '静流润物', nayin: '涧下水', meaning: '改变正在不显眼处发生，温和持续比强行推动更有效。', guidance: '以耐心沟通和日常照料改善局面，让结果自然积累。' },
  { ganzhi: '戊寅', title: '城垣初筑', nayin: '城头土', meaning: '新的秩序与安全边界需要建立，基础规则决定后续稳定。', guidance: '先明确责任、底线和资源安排，再扩大投入或作长期承诺。' },
  { ganzhi: '己卯', title: '守土安家', nayin: '城头土', meaning: '守护已有成果与亲近关系是当前重点，稳定本身就是进展。', guidance: '照顾家庭、团队或核心阵地，拒绝侵占边界的额外负担。' },
  { ganzhi: '庚辰', title: '蜡金待琢', nayin: '白蜡金', meaning: '潜质已经具备但尚未定型，需要专业训练与细致塑造。', guidance: '寻找可靠方法或指导者，允许作品经过多轮修改再公开。' },
  { ganzhi: '辛巳', title: '纯光成形', nayin: '白蜡金', meaning: '经过提炼后，价值与方向逐渐清晰，成果开始呈现完整轮廓。', guidance: '聚焦最重要的部分并完成定稿，让清晰胜过繁复装饰。' },
  { ganzhi: '壬午', title: '柳随风起', nayin: '杨柳木', meaning: '环境正在变化，柔韧应对比正面硬碰更容易获得空间。', guidance: '顺应趋势调整方法，同时守住核心立场，不把灵活变成随波逐流。' },
  { ganzhi: '癸未', title: '柔木成荫', nayin: '杨柳木', meaning: '温柔而长期的投入正在形成庇护，关系与成果需要耐心养成。', guidance: '持续给予合适支持，也要照顾自己的需要，避免单方面透支。' },
  { ganzhi: '甲申', title: '泉眼觉醒', nayin: '泉中水', meaning: '被压住的灵感、情感或机会重新涌现，内在源头正在恢复。', guidance: '给真实需求一个出口，重新启动曾让你有生命力的事情。' },
  { ganzhi: '乙酉', title: '清泉映心', nayin: '泉中水', meaning: '情绪沉静后真相更容易被看见，答案来自诚实的自我观照。', guidance: '先分清自己的感受与他人的期待，再作决定或展开沟通。' },
  { ganzhi: '丙戌', title: '屋土庇护', nayin: '屋上土', meaning: '可靠结构能够提供保护，当前需要一个可安顿身心的框架。', guidance: '完善住所、制度或关系中的安全感，用具体安排代替口头保证。' },
  { ganzhi: '丁亥', title: '家园成景', nayin: '屋上土', meaning: '长期经营的空间开始显出温度与归属，适合共享成果。', guidance: '珍惜已经建立的连接，让生活品质与共同记忆继续生长。' },
  { ganzhi: '戊子', title: '惊雷破夜', nayin: '霹雳火', meaning: '突发变化打破沉寂，也揭示了原本无法回避的问题。', guidance: '先稳住情绪和安全，再迅速处理关键事项，不在震荡中仓促扩大决定。' },
  { ganzhi: '己丑', title: '雷火新生', nayin: '霹雳火', meaning: '旧局被震开后出现重启机会，混乱之中孕育新的秩序。', guidance: '清理已经失效的部分，从最必要的环节重建，不执着恢复原样。' },
  { ganzhi: '庚寅', title: '松骨凌云', nayin: '松柏木', meaning: '坚韧与原则支持长期向上，即使环境严苛也能保持成长。', guidance: '守住长期标准，选择困难但正确的路径，以耐力代替短期取巧。' },
  { ganzhi: '辛卯', title: '柏心长青', nayin: '松柏木', meaning: '忠诚、稳定与持久关系经得起时间考验，根基比表面变化重要。', guidance: '维护真正可信的人和事，持续投入，但别把坚持误作拒绝改变。' },
  { ganzhi: '壬辰', title: '长河开运', nayin: '长流水', meaning: '局势开始流通，停滞的资源、关系或机会逐步找到出口。', guidance: '主动疏通关键环节，顺着有效反馈推进，让行动形成连续性。' },
  { ganzhi: '癸巳', title: '流水不息', nayin: '长流水', meaning: '事情依靠持续流动维持生命力，阶段变化并不等于中断。', guidance: '保持节奏和信息交换，及时调整形式，不因一次波折停止长期进程。' },
  { ganzhi: '甲午', title: '沙里淘光', nayin: '沙中金', meaning: '价值混在大量杂讯中，需要筛选、比较和反复验证。', guidance: '减少分心，依据事实留下真正有效的人、信息与机会。' },
  { ganzhi: '乙未', title: '细沙聚金', nayin: '沙中金', meaning: '微小积累正逐渐形成实质成果，细节与复利是当前关键。', guidance: '坚持记录、储备和微小改进，不轻视看起来缓慢的增长。' },
  { ganzhi: '丙申', title: '山火炼心', nayin: '山下火', meaning: '隐藏的压力正在考验内心，真正需要调整的是动机与执念。', guidance: '看清自己为何坚持，放下证明欲，把能量用于可改变的部分。' },
  { ganzhi: '丁酉', title: '灯火归巢', nayin: '山下火', meaning: '外在奔波之后需要回归安定，微小而真实的温暖最能恢复力量。', guidance: '暂缓向外追逐，照顾生活秩序和亲近关系，让心重新落地。' },
  { ganzhi: '戊戌', title: '平野生林', nayin: '平地木', meaning: '空白之地具备长期建设潜力，成果将从平凡起点逐步形成。', guidance: '接受从零开始，先建立可复制的基础，再耐心扩大规模。' },
  { ganzhi: '己亥', title: '众木成森', nayin: '平地木', meaning: '个体力量汇聚后产生整体优势，合作网络已经成为关键资源。', guidance: '重视协作与互惠，明确共同目标，避免各自生长却彼此消耗。' },
  { ganzhi: '庚子', title: '壁土初固', nayin: '壁上土', meaning: '防线和结构刚开始稳固，仍需时间检验其可靠程度。', guidance: '补齐薄弱环节，保留必要缓冲，在基础稳定前不要承受过大压力。' },
  { ganzhi: '辛丑', title: '坚壁守成', nayin: '壁上土', meaning: '已有成果需要坚定守护，外界干扰不应轻易改变核心安排。', guidance: '守住底线和重要资源，同时定期检查防守是否已经变成封闭。' },
  { ganzhi: '壬寅', title: '金箔点睛', nayin: '金箔金', meaning: '关键细节能够显著提升整体价值，当前接近最后完善阶段。', guidance: '找出最影响观感或结果的一处进行精修，不必大规模推翻重来。' },
  { ganzhi: '癸卯', title: '金辉映月', nayin: '金箔金', meaning: '价值通过合适环境和他人反馈被看见，呈现方式与内容同样重要。', guidance: '选择适合的时机展示成果，真实表达优势，不靠夸大换取认可。' },
  { ganzhi: '甲辰', title: '灯启长明', nayin: '覆灯火', meaning: '一个可长期坚持的方向被点亮，稳定信念胜过短暂激情。', guidance: '建立能够持续的习惯与承诺，让每天的小行动守住这束光。' },
  { ganzhi: '乙巳', title: '守灯传光', nayin: '覆灯火', meaning: '经验与善意需要被守护并传递，影响他人也会巩固自身方向。', guidance: '分享真正验证过的方法，以身作则，同时避免替别人承担全部责任。' },
  { ganzhi: '丙午', title: '天河倾辉', nayin: '天河水', meaning: '灵感、情感或机会大量涌入，局面具有突破日常边界的可能。', guidance: '打开接收空间并记录灵感，随后筛选落地，避免被一时丰盛淹没。' },
  { ganzhi: '丁未', title: '星雨润心', nayin: '天河水', meaning: '温柔支持正在缓解疲惫，情绪修复会带来新的理解。', guidance: '允许自己接受安慰和帮助，也把感激转化为具体回应。' },
  { ganzhi: '戊申', title: '驿路通达', nayin: '大驿土', meaning: '通道已经打开，适合迁移、联络、交付或推进跨越边界的事务。', guidance: '主动行动并确认行程、信息和资源衔接，把机会落实到具体节点。' },
  { ganzhi: '己酉', title: '厚土载途', nayin: '大驿土', meaning: '稳定后勤与现实条件能够承载远行，准备充分才走得长久。', guidance: '检查资金、时间、体力和支持系统，再承担更远的目标。' },
  { ganzhi: '庚戌', title: '金钗定约', nayin: '钗钏金', meaning: '关系或合作进入确认阶段，承诺的清晰度比浪漫想象更重要。', guidance: '把共同意愿落实为边界、期限和责任，慎重作出可以兑现的承诺。' },
  { ganzhi: '辛亥', title: '玉环相合', nayin: '钗钏金', meaning: '双方差异有机会形成互补，连接来自尊重与平等交换。', guidance: '寻找共同利益，也保留彼此独立空间，不以控制维持关系。' },
  { ganzhi: '壬子', title: '桑叶育梦', nayin: '桑柘木', meaning: '一个愿望正处于需要细心养育的阶段，环境与日常投入决定成长。', guidance: '为目标提供稳定时间和资源，减少急于收获造成的干扰。' },
  { ganzhi: '癸丑', title: '柘丝成锦', nayin: '桑柘木', meaning: '零散努力开始连成完整成果，耐心工序正在显出价值。', guidance: '继续完成最后的连接与整理，让积累转化为可展示、可使用的成果。' },
  { ganzhi: '甲寅', title: '溪开万壑', nayin: '大溪水', meaning: '强劲流动正在打开多个可能，原有限制已经出现突破口。', guidance: '抓住主航道快速推进，避免同时分散到过多支线。' },
  { ganzhi: '乙卯', title: '清溪择向', nayin: '大溪水', meaning: '机会虽多但需要选择方向，清晰取舍决定能量最终流向。', guidance: '依据长期价值而非一时新鲜感作选择，选定后持续投入。' },
  { ganzhi: '丙辰', title: '沙土塑基', nayin: '沙中土', meaning: '基础仍有可塑性，当前调整成本较低，适合修正结构。', guidance: '通过测试发现问题并及时重做关键环节，不要在松散基础上继续堆高。' },
  { ganzhi: '丁巳', title: '聚沙成塔', nayin: '沙中土', meaning: '分散资源正在汇聚成形，组织和持续投入会带来可见成果。', guidance: '统一目标与标准，把碎片化努力纳入同一计划中。' },
  { ganzhi: '戊午', title: '天火耀世', nayin: '天上火', meaning: '能见度和行动能量达到高点，适合公开、领导和推动重要事务。', guidance: '清楚表达立场并承担影响力，同时防止自信过热或忽视他人。' },
  { ganzhi: '己未', title: '日光普照', nayin: '天上火', meaning: '局面趋于明朗，资源和善意能够被更公平地看见与分享。', guidance: '保持坦诚与开放，把成果惠及相关的人，也留意被光亮掩盖的细节。' },
  { ganzhi: '庚申', title: '榴木破壳', nayin: '石榴木', meaning: '长期压抑的生命力正在突破限制，新阶段需要勇气脱离旧壳。', guidance: '允许身份与方式更新，采取明确行动离开已经不适合的框架。' },
  { ganzhi: '辛酉', title: '丹实盈枝', nayin: '石榴木', meaning: '投入进入收获期，成果丰盛但也需要妥善分配和保存。', guidance: '确认成果、分享回报并为下一周期留种，不因丰收过度消耗。' },
  { ganzhi: '壬戌', title: '海纳百川', nayin: '大海水', meaning: '多种经验与资源正在汇合，包容能够形成更大的格局。', guidance: '听取不同声音并整合共识，但要保留判断标准，避免无边界承接。' },
  { ganzhi: '癸亥', title: '沧海归一', nayin: '大海水', meaning: '一个周期走向完整，纷杂经历需要被理解、整合并放回整体。', guidance: '总结所得、完成告别，让已经成熟的答案成为下一程的起点。' },
];

export const SHIYUE_ORACLE_CARDS: readonly ShiyueOracleCardDefinition[] = RAW_CARDS.map((card, idx) => ({
  id: idx + 1,
  ...card,
}));

export function drawShiyueOracleCards(
  spreadId: ShiyueOracleSpreadSpec['id'],
  selectedIds?: readonly number[],
): DrawnShiyueOracleCard[] {
  const spread = SHIYUE_ORACLE_SPREADS[spreadId];
  const count = spread.positions.length;

  if (selectedIds && selectedIds.length === count) {
    return spread.positions.map((position, idx) => {
      const card = SHIYUE_ORACLE_CARDS.find((c) => c.id === selectedIds[idx]) ?? SHIYUE_ORACLE_CARDS[0]!;
      return { ...card, position };
    });
  }

  const pool = [...SHIYUE_ORACLE_CARDS];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = pool[i]!;
    pool[i] = pool[j]!;
    pool[j] = tmp;
  }
  return spread.positions.map((position, idx) => ({
    ...pool[idx]!,
    position,
  }));
}

export function getShiyueOracleImageUrl(cardId: number): string {
  const id = Number.isInteger(cardId) && cardId >= 1 && cardId <= SHIYUE_ORACLE_CARDS.length
    ? cardId
    : 1;
  const revision = RECOMPOSED_CARD_IDS.has(id) ? '-v2' : '';
  return `${SHIYUE_ORACLE_ART_PATH}/${String(id).padStart(3, '0')}${revision}.webp`;
}

export function buildShiyueOraclePrompt(
  question: string,
  spreadName: string,
  cards: readonly DrawnShiyueOracleCard[],
): string {
  const cleanQuestion = question.trim() || '请解读当前局势与行动指引。';
  return [
    '你正在解读「时月神谕」牌阵。时月神谕是六十甲子纳音意象牌组，以下资料是本次解读的唯一牌义标准。',
    '',
    '【固定规则】',
    '1. 每张牌只有正向牌面，不使用逆位。',
    '2. 必须以提供的「核心牌义」和「行动指引」为准，不得仅凭干支或纳音另行猜测牌义。',
    '3. 不得虚构签诗、典故、固定吉凶等级或必然应期。',
    '4. 先用一段话直接回应用户问题，再逐一解释各牌位并说明牌意发展关系，最后给出 2–4 条具体可行建议。',
    '',
    `【用户问题】${cleanQuestion}`,
    `【牌阵】${spreadName}`,
    '',
    '【本次牌面标准资料】',
    ...cards.map((card, index) => [
      `${index + 1}. ${card.position}｜第 ${card.id} 张｜牌名：${card.title}｜干支：${card.ganzhi}｜纳音：${card.nayin}`,
      `核心牌义：${card.meaning}`,
      `行动指引：${card.guidance}`,
    ].join('\n')),
  ].join('\n');
}
