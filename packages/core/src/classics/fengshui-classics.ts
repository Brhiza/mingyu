import type { BazhaiStarClassic } from './types';

/**
 * 《八宅明镜》《紫白诀》《飞星赋》八宅与玄空风水经典释义
 */
export const BAZHAI_STAR_CLASSICS: Record<string, BazhaiStarClassic> = {
  生气: {
    star: '生气',
    auspice: '大吉',
    wuxing: '木',
    sourceBook: '八宅明镜·游年篇',
    verse: '生气贪狼木第一，延年武曲次相宜。求官求贵人丁旺，富贵双全喜气齐。',
    nature: '贪狼木星，主生生不息、事业昌盛、人丁兴旺、功名显赫。',
    placementAdvice: '最宜设大门、主卧、书房、办公室老板位；大忌厕所、厨房压制。',
  },
  延年: {
    star: '延年',
    auspice: '次吉',
    wuxing: '金',
    sourceBook: '八宅明镜·游年篇',
    verse: '延年武曲金最良，财源茂盛寿延长。夫妻和谐家庭睦，内外安宁福满堂。',
    nature: '武曲金星，主人际和睦、婚姻美满、健康长寿、财源广进。',
    placementAdvice: '最宜设主卧、老人房、会客厅、谈判室；利于夫妻感情与长久合作。',
  },
  天医: {
    star: '天医',
    auspice: '中吉',
    wuxing: '土',
    sourceBook: '八宅明镜·游年篇',
    verse: '天医巨门土最嘉，消除疾病享荣华。贵人相扶添财帛，康泰安宁乐万家。',
    nature: '巨门土星，主健康祛病、贵人扶持、财库充盈、身心泰宁。',
    placementAdvice: '最宜设卧室、养生区、餐厅、财务室；利于调养身体与蓄财。',
  },
  伏位: {
    star: '伏位',
    auspice: '小吉',
    wuxing: '木',
    sourceBook: '八宅明镜·游年篇',
    verse: '伏位辅弼本纯和，平安稳定自安泰。蓄势待发根基固，平步青云莫浪过。',
    nature: '左辅右弼木星，主平稳安宁、蓄势待发、子女孝顺、守成无灾。',
    placementAdvice: '宜设书房、静思室、神位、客房；宜静不宜过动。',
  },
  绝命: {
    star: '绝命',
    auspice: '大凶',
    wuxing: '金',
    sourceBook: '八宅明镜·游年篇',
    verse: '绝命破军金最凶，伤残破败祸相从。官非口舌疾病起，人口损伤哭泣重。',
    nature: '破军金星，第一凶星，主伤灾、破财、官非、绝嗣。',
    placementAdvice:
      '大忌大门与主卧！宜设卫生间、储藏室以凶压凶（以毒攻毒），或用泰山石敢当、安忍水化解。',
  },
  五鬼: {
    star: '五鬼',
    auspice: '次凶',
    wuxing: '火',
    sourceBook: '八宅明镜·游年篇',
    verse: '五鬼廉贞火最烈，火灾盗贼病相连。官司口舌小人害，怪异惊疑不安眠。',
    nature: '廉贞火星，主火灾、盗贼、官非小人、破耗连连。',
    placementAdvice: '大忌大门与厨房！宜设卫生间压制；若遇生旺宜用水法化解燥火。',
  },
  六煞: {
    star: '六煞',
    auspice: '中凶',
    wuxing: '水',
    sourceBook: '八宅明镜·游年篇',
    verse: '六煞文曲水荡漾，桃花淫乱惹尘埃。破败家财身多病，口舌是非自招来。',
    nature: '文曲水星，主桃花纠纷、口舌是非、精神困扰、水溺破败。',
    placementAdvice: '不宜设主卧；宜作杂物间、卫生间或设绿植木雕以泄水气。',
  },
  祸害: {
    star: '祸害',
    auspice: '小凶',
    wuxing: '土',
    sourceBook: '八宅明镜·游年篇',
    verse: '祸害禄存土难安，官非口舌斗争顽。财帛耗散多疾病，争执纠缠心不安。',
    nature: '禄存土星，主琐碎纠纷、口角争执、疲惫劳碌、小人作祟。',
    placementAdvice: '不宜设大门与书房；宜用金质摆件泄土气化煞。',
  },
};

export function getBazhaiStarClassic(star: string): BazhaiStarClassic | undefined {
  if (!star) return undefined;
  for (const [key, val] of Object.entries(BAZHAI_STAR_CLASSICS)) {
    if (star.includes(key)) return val;
  }
  return undefined;
}

import type { XuankongStarClassic } from './types';

/**
 * 《紫白诀》《玄空秘旨》《飞星赋》玄空九星全解
 */
export const XUANKONG_STAR_CLASSICS: Record<number, XuankongStarClassic> = {
  1: {
    starNumber: 1,
    starName: '一白贪狼水星',
    trigram: '坎',
    wuxing: '水',
    sourceBook: '紫白诀·上篇',
    verse: '一白为官星之应，主宰文章；当令名扬四海，失令漂泊刑伤。',
    timelyMeaning: '生旺当令时主利文凭考学、科甲及第、名利双收、少年早发。',
    untimelyMeaning: '克煞衰死时主酒色荒淫、耳疾肾病、流荡无依、水厄阴疾。',
  },
  2: {
    starNumber: 2,
    starName: '二黑巨门土星',
    trigram: '坤',
    wuxing: '土',
    sourceBook: '紫白诀·上篇',
    verse: '二黑病符之宿，化气为病；当令田产丰饶，失令疮疾缠绵。',
    timelyMeaning: '生旺当令时利置办田产物业、妇女当家、财源厚重、武贵利农。',
    untimelyMeaning: '克煞衰死时为第一病符星，主肠胃皮肤顽疾、妇科隐疾、孤寡寡宿。',
  },
  3: {
    starNumber: 3,
    starName: '三碧禄存木星',
    trigram: '震',
    wuxing: '木',
    sourceBook: '紫白诀·上篇',
    verse: '三碧蚩尤之宿，号为贼星；当令兴家立业，失令官讼连连。',
    timelyMeaning: '生旺当令时主长房得力、敢闯敢拼、富贵声威、产业大发。',
    untimelyMeaning: '克煞衰死时主盗贼侵扰、口舌官非、骨折足疾、刑狱争斗。',
  },
  4: {
    starNumber: 4,
    starName: '四绿文曲木星',
    trigram: '巽',
    wuxing: '木',
    sourceBook: '紫白诀·上篇',
    verse: '四绿文曲文昌，专司品学；当令联登科甲，失令桃花荡漾。',
    timelyMeaning: '生旺当令时为真文曲星，利功名文章、琴棋书画、名扬金榜、得贤良配偶。',
    untimelyMeaning: '克煞衰死时主酒色桃花、自缢伤风、哮喘风疾、漂泊不定。',
  },
  5: {
    starNumber: 5,
    starName: '五黄廉贞土星',
    trigram: '中宫',
    wuxing: '土',
    sourceBook: '紫白诀·上篇',
    verse: '五黄正关煞之尊，威不可犯；当令君临万国，失令死丧重重。',
    timelyMeaning: '生旺当令位极中宫，主九五至尊、掌握生杀大权、威震八方。',
    untimelyMeaning:
      '克煞衰死为玄空第一大煞（五黄大煞），所到之处主伤亡灾病、破财丧命，宜静不宜动。',
  },
  6: {
    starNumber: 6,
    starName: '六白武曲金星',
    trigram: '乾',
    wuxing: '金',
    sourceBook: '紫白诀·上篇',
    verse: '六白武曲官星，权柄威严；当令武职显赫，失令刑妻克子。',
    timelyMeaning: '生旺当令主官爵显赫、权威大发、巨富巨贵、得权威长辈庇佑。',
    untimelyMeaning: '克煞衰死时主官非刑责、肺部头部疾患、孤寒寡合、兵戈刀伤。',
  },
  7: {
    starNumber: 7,
    starName: '七赤破军金星',
    trigram: '兑',
    wuxing: '金',
    sourceBook: '紫白诀·上篇',
    verse: '七赤破军贼星，司盗贼兵戈；当令医卜武权，失令官司横祸。',
    timelyMeaning: '生旺当令主口才雄辩、法务医卜、金融贸易、发家致富。',
    untimelyMeaning: '克煞衰死为贼星刑伤，主火灾盗贼、牢狱伤残、口舌是非、呼吸道病。',
  },
  8: {
    starNumber: 8,
    starName: '八白左辅土星',
    trigram: '艮',
    wuxing: '土',
    sourceBook: '紫白诀·上篇',
    verse: '八白左辅财星，至吉至尊；当令富贵寿考，失令小口损伤。',
    timelyMeaning: '生旺当令为三吉星之首，主地产大发、忠厚富贵、福寿康宁、少年早成。',
    untimelyMeaning: '克煞衰死时主小儿损伤、筋骨腰腿疾痛、停滞不前。',
  },
  9: {
    starNumber: 9,
    starName: '九紫右弼火星',
    trigram: '离',
    wuxing: '火',
    sourceBook: '紫白诀·上篇',
    verse: '九紫右弼吉星，司喜庆光明；当令大红大紫，失令目疾吐血。',
    timelyMeaning: '生旺当令为九运当运大吉星！主喜事重重、名声大噪、科技文化大爆发、富贵显荣。',
    untimelyMeaning: '克煞衰死时主火灾火烛、眼目心脑疾病、血光之灾、狂乱急躁。',
  },
};

export function getXuankongStarClassic(
  starNumber: number | string,
): XuankongStarClassic | undefined {
  const num = typeof starNumber === 'number' ? starNumber : parseInt(starNumber, 10);
  if (isNaN(num)) return undefined;
  return XUANKONG_STAR_CLASSICS[num];
}
