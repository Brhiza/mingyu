import type { JinkoujueMovementClassic } from './types';

/**
 * 《大六壬金口诀》五动、三动与阴阳生克断语全录
 * 原典出处：《金口诀大全》《入式歌解》
 */
export const JINKOUJUE_MOVEMENT_CLASSICS: Record<string, JinkoujueMovementClassic> = {
  妻动: {
    key: '妻动',
    name: '妻动（下克上）',
    category: '五动',
    sourceBook: '金口诀大全',
    verse: '妻动妻愁夫不宁，谋事难成财耗倾；门户不和生变异，求谋迟滞见虚惊。',
    modernAdvice: '家庭或内部合伙之间容易产生分歧与财物耗损。切勿意气用事，宜以退为进、厘清权责。',
  },
  鬼动: {
    key: '鬼动',
    name: '鬼动（上克下）',
    category: '五动',
    sourceBook: '金口诀大全',
    verse: '鬼动官灾祸事侵，病临门户损资身；小人暗算防官讼，静守安分福自臻。',
    modernAdvice: '外部压力或监管阻力较大，易惹是非纠纷。宜依法合规、低调防守，不可强行出头。',
  },
  贼动: {
    key: '贼动',
    name: '贼动（下克上）',
    category: '五动',
    sourceBook: '金口诀大全',
    verse: '贼动失脱盗贼来，防非防损祸胎开；出门在外谨防盗，财物深藏免破灾。',
    modernAdvice: '注意财产安全与合同陷阱，防范暗中窃取利益的小人或突发破费。',
  },
  父母动: {
    key: '父母动',
    name: '父母动（生出/泄气）',
    category: '五动',
    sourceBook: '金口诀大全',
    verse: '父母动出忧子孙，劳碌辛苦耗心神；虽有文书印信在，事多掣肘费精神。',
    modernAdvice: '利文书契约、学习深造与政策申报，但过程较为繁琐劳碌，需要付出较多心血。',
  },
  子孙动: {
    key: '子孙动',
    name: '子孙动（生入/进益）',
    category: '五动',
    sourceBook: '金口诀大全',
    verse: '子孙动入喜事连，求财求谋福禄全；解灾除疾无忧虑，吉庆欢欣喜万般。',
    modernAdvice: '进益之兆！外部资源与好消息主动进入，利于求财、合作开拓、化解危机。',
  },
  方主移动: {
    key: '方主移动',
    name: '方主移动',
    category: '三动',
    sourceBook: '金口诀大全',
    verse: '方主移动心多变，事体迁延不定居；求谋远向他方去，在此无成往彼宜。',
    modernAdvice: '地基与立足点面临变动，适合异地发展、出差拓展或改变现有工作策略。',
  },
  神主移动: {
    key: '神主移动',
    name: '神主移动',
    category: '三动',
    sourceBook: '金口诀大全',
    verse: '神主移动求贵人，官长相催事急迫；吉神动者蒙恩宠，凶神动处起波折。',
    modernAdvice: '领导、贵人或外部环境出现调整，宜紧跟政策与主管指示，灵活应对。',
  },
  将主移动: {
    key: '将主移动',
    name: '将主移动',
    category: '三动',
    sourceBook: '金口诀大全',
    verse: '将主移动自身忙，出门求利走四方；吉将扶持多获益，凶将相随事多妨。',
    modernAdvice: '自身行程奔波忙碌，适合积极主动出击，在动态调整中把握商机。',
  },
};

export function getJinkoujueMovementClassic(key: string): JinkoujueMovementClassic | undefined {
  return JINKOUJUE_MOVEMENT_CLASSICS[key];
}
