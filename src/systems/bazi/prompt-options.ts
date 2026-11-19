/** 主题是解读任务，不预设具体盘面结论。 */
export const baziTopicIds = [
  'general', 'recent', 'career', 'job-change', 'startup-partnership', 'investment-partnership',
  'wealth', 'marriage', 'relationship', 'relationship-push', 'relationship-decision',
  'reconciliation-decision', 'children', 'family', 'home-move', 'settle-relocate', 'social',
  'emotion', 'health', 'parents', 'study', 'study-advance', 'exam-landing', 'growth', 'talent',
] as const;
type Topic = typeof baziTopicIds[number];
export const baziTopics: Record<Topic, { label: string; focus: string; task: string }> = {
  general: { label: '综合', focus: '月令、四柱、根气、十神及实际列出的干支关系', task: '先梳理主要依据及相互制约，再回答用户最关心的问题。' },
  recent: { label: '近期', focus: '已提供的实际岁运层级与原局关系', task: '说明资料覆盖的时段，与现实中的计划和期限逐项对应。' },
  career: { label: '事业', focus: '月令、官杀、印星、食伤及柱间关系', task: '结合具体工作职责、资源和发展选择，说明可核对的职业条件。' },
  'job-change': { label: '换工作', focus: '官杀、印星、月柱及已列冲合', task: '比较留任和转换选择的条件、代价和需要确认的信息。' },
  'startup-partnership': { label: '创业合作', focus: '财星、官杀、比劫与已列柱间关系', task: '围绕职责分工、资源、合作边界和现金流分析。' },
  'investment-partnership': { label: '投资合作', focus: '财星、比劫及已列合冲刑害', task: '结合出资、风险承担、退出机制与信息缺口分析。' },
  wealth: { label: '财运', focus: '财星、食伤、比劫及其透藏', task: '将传统财星取象与现实收入、支出、负债和风险承受能力分开。' },
  marriage: { label: '婚恋', focus: '日支及相关十神、已列合冲刑害', task: '结合双方实际相处方式讨论婚恋主题，不推断对方意图。' },
  relationship: { label: '关系', focus: '日支及相关十神、已列合冲刑害', task: '结合已知互动、需求和边界讨论关系问题。' },
  'relationship-push': { label: '关系推进', focus: '日支、相关十神和已列合冲', task: '讨论沟通、节奏、双方意愿与需要核实的条件。' },
  'relationship-decision': { label: '关系去留', focus: '日支与实际列出的关系结构', task: '比较不同选择的现实条件、边界与待核实信息。' },
  'reconciliation-decision': { label: '复合判断', focus: '日支及已列合冲刑害', task: '围绕分歧原因、双方意愿与实际改变分析，不预设复合结果。' },
  children: { label: '子女', focus: '时柱、食伤及相关十神', task: '结合亲子关系和已知家庭情况讨论；时柱不确定时分别说明候选差异。' },
  family: { label: '家庭与六亲', focus: '年柱、月柱、时柱、六亲十神及柱间关系', task: '结合家庭成员的实际互动与居住情况分析。' },
  'home-move': { label: '搬家置业', focus: '日支及已列干支关系', task: '将居住需要、成本、期限和现实条件与传统取象分开讨论。' },
  'settle-relocate': { label: '定居换城', focus: '日支和已列干支关系', task: '比较地点选择、工作、家庭和生活成本等条件。' },
  social: { label: '人际', focus: '比劫、食伤及已列柱间关系', task: '联系沟通方式、合作边界及具体人际情境。' },
  emotion: { label: '情绪', focus: '月令、印星、食伤及已列透藏', task: '结合用户描述的压力、作息和支持资源，避免把传统取象当作诊断。' },
  health: { label: '健康', focus: '月令、根气及已列刑冲', task: '只说明传统五行取象，并与症状、检查和作息区分；疾病判断依据医学评估。' },
  parents: { label: '父母', focus: '年柱、月柱、印星及财星', task: '结合已知的家庭互动讨论，避免推断父母的具体状况。' },
  study: { label: '学业', focus: '印星、食伤及官杀的透藏', task: '结合学习目标、时间安排和已有成绩分析。' },
  'study-advance': { label: '考证进修', focus: '印星、食伤及官杀的透藏', task: '结合课程、备考时间、成本和目标资格分析。' },
  'exam-landing': { label: '考试上岸', focus: '印星、食伤及官杀的透藏', task: '结合考试要求、成绩和备考条件分析，不断言录取结果。' },
  growth: { label: '成长', focus: '日主、月令、根气和柱间关系', task: '结合当前目标和实际资源讨论可复盘的成长方向。' },
  talent: { label: '天赋', focus: '日主、食伤、印星及其透藏', task: '将传统能力取象与实际经验、兴趣和训练条件分开讨论。' },
};
export const baziSchoolIds = ['ziping', 'mangpai', 'xinpai', 'tiaohou', 'geju'] as const;
type School = typeof baziSchoolIds[number];
export const baziSchools: Record<School, { label: string; task: string }> = {
  ziping: { label: '子平派', task: '从月令、透干、根气及已列关系入手；旺衰、化气和普通格局成败仅按所列条件模型判断，其他特殊格、完整成败与用神另列待核。' },
  mangpai: { label: '盲派', task: '从四柱宾主宫位、体用十神与柱间合冲穿墓库做功路径切入；仅把所列关系视为做功依据，做功效率与反制需结合岁运核实。' },
  xinpai: { label: '新派', task: '从月令、五行紧贴作用、旬空落支与天干虚实（百神论）观察原局与岁运层级；扶抑喜忌尚未计算时明确待核。' },
  tiaohou: { label: '调候派', task: '以《穷通宝鉴》寒暖燥湿为先，优先核对月令节气气候与调候用神是否透藏得力。' },
  geju: { label: '古法格局派', task: '以《子平真诠》月令立格、司权透干及相神救应为主线，区分顺用逆用与成败制化。' },
};

export function baziPromptTask(options: { topic?: Topic; schools?: School[] } | undefined) {
  const topic = baziTopics[options?.topic ?? 'general'];
  const schools = [...new Set(options?.schools ?? [])].map((id) => `${baziSchools[id].label}：${baziSchools[id].task}`);
  return [`【主题：${topic.label}】\n核对重点：${topic.focus}。${topic.task}`,
    schools.length ? `【解读口径】\n${schools.join('\n')}\n不同口径各自说明依据和差异。` : '',
    '只使用本次列出的盘面和时间层级；资料不足的项目标为待核，不虚构结果。'].filter(Boolean).join('\n\n');
}
