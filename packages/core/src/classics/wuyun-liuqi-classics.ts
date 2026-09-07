import type { WuyunLiuqiClassic } from './types';

/**
 * 《黄帝内经·素问·气交变大论/六元正纪大论》五运六气天道医理全览
 */
export const WUYUN_LIUQI_CLASSICS: Record<string, WuyunLiuqiClassic> = {
  // 十干大运
  甲己化土: {
    factor: '甲己化土',
    category: '大运',
    sourceBook: '素问·天元纪大论',
    verse: '甲己之岁，土运统之。太宫太阴，其政敦厚；湿气乃行，万物土生。',
    climateFeature: '土运主湿，天气敦厚，湿气偏胜，雨水充沛。',
    healthAdvice: '宜健脾利湿，调畅中焦气机，防脾胃虚衰与水湿内停。',
  },
  乙庚化金: {
    factor: '乙庚化金',
    category: '大运',
    sourceBook: '素问·天元纪大论',
    verse: '乙庚之岁，金运统之。少商阳明，其政严峻；燥气流行，万物肃杀。',
    climateFeature: '金运主燥，气候严清干燥，凉风肃杀，秋气偏盛。',
    healthAdvice: '宜养阴润燥，滋润肺胃，防呼吸道与皮肤干燥。',
  },
  丙辛化水: {
    factor: '丙辛化水',
    category: '大运',
    sourceBook: '素问·天元纪大论',
    verse: '丙辛之岁，水运统之。太羽太阳，其政严肃；寒气凝结，水泉坚涸。',
    climateFeature: '水运主寒，气候寒冷凝滞，冰雪较多，严冬偏长。',
    healthAdvice: '宜温阳散寒，补肾固本，防心脑血管与关节受寒。',
  },
  丁壬化木: {
    factor: '丁壬化木',
    category: '大运',
    sourceBook: '素问·天元纪大论',
    verse: '丁壬之岁，木运统之。少角厥阴，其政开发；风气盛行，草木荣茂。',
    climateFeature: '木运主风，春暖早临，多风动荡，万物生机勃发。',
    healthAdvice: '宜疏肝理气，平抑肝阳，防肝风内动与眩晕急躁。',
  },
  戊癸化火: {
    factor: '戊癸化火',
    category: '大运',
    sourceBook: '素问·天元纪大论',
    verse: '戊癸之岁，火运统之。太徵少阳，其政升腾；暑热炎炎，万物蕃鲜。',
    climateFeature: '火运主热，气候炎热酷暑，阳气亢盛，雨热同季。',
    healthAdvice: '宜清热解暑，清心降火，防中暑伤津与心火偏亢。',
  },

  // 司天在泉
  子午少阴君火司天: {
    factor: '少阴君火司天',
    category: '司天',
    sourceBook: '素问·六元正纪大论',
    verse: '子午之岁，少阴君火司天，阳明燥金在泉。天气热，地气清，炎火施化。',
    climateFeature: '上半年炎热温和，下半年清凉干燥。',
    healthAdvice: '上半年防心肺伏热，下半年防燥咳伤津。',
  },
  丑未太阴湿土司天: {
    factor: '太阴湿土司天',
    category: '司天',
    sourceBook: '素问·六元正纪大论',
    verse: '丑未之岁，太阴湿土司天，太阳寒水在泉。天气沉阴，地气大寒，雨湿流行。',
    climateFeature: '上半年多雨湿重，下半年天寒水冻。',
    healthAdvice: '健脾除湿为主，下半年重温肾散寒。',
  },
  寅申少阳相火司天: {
    factor: '少阳相火司天',
    category: '司天',
    sourceBook: '素问·六元正纪大论',
    verse: '寅申之岁，少阳相火司天，厥阴风木在泉。天气炎暑，地气风动，火热流行。',
    climateFeature: '上半年暑热偏盛，下半年风动气旋。',
    healthAdvice: '上半年防热病疮疡，下半年防肝风动血。',
  },
  卯酉阳明燥金司天: {
    factor: '阳明燥金司天',
    category: '司天',
    sourceBook: '素问·六元正纪大论',
    verse: '卯酉之岁，阳明燥金司天，少阴君火在泉。天气清凉，地气热化，燥凉流行。',
    climateFeature: '上半年清凉肃杀，下半年温热如夏。',
    healthAdvice: '上半年润燥养肺，下半年清心泄热。',
  },
  辰戌太阳寒水司天: {
    factor: '太阳寒水司天',
    category: '司天',
    sourceBook: '素问·六元正纪大论',
    verse: '辰戌之岁，太阳寒水司天，太阴湿土在泉。天气大寒，地气蒸湿，寒湿交争。',
    climateFeature: '上半年寒气凛冽，下半年湿重泥泞。',
    healthAdvice: '温中化湿，兼散外寒，固护脾肾。',
  },
  巳亥厥阴风木司天: {
    factor: '厥阴风木司天',
    category: '司天',
    sourceBook: '素问·六元正纪大论',
    verse: '巳亥之岁，厥阴风木司天，少阳相火在泉。天气风动，地气炎热，风热合化。',
    climateFeature: '上半年多大风回旋，下半年暑热伏留。',
    healthAdvice: '平肝熄风，清泄相火，安神定志。',
  },
};

export function getWuyunLiuqiClassic(factor: string): WuyunLiuqiClassic | undefined {
  if (!factor) return undefined;
  for (const [key, val] of Object.entries(WUYUN_LIUQI_CLASSICS)) {
    if (factor.includes(key) || key.includes(factor)) return val;
  }
  return undefined;
}
