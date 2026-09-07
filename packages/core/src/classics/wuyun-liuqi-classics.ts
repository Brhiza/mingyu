import type { WuyunLiuqiClassic } from './types';

/**
 * 《素问·天元纪大论》《素问·至真要大论》五运与司天在泉气化资料
 */
export const WUYUN_LIUQI_CLASSICS: Record<string, WuyunLiuqiClassic> = {
  // 十干大运
  甲己化土: {
    factor: '甲己化土',
    category: '大运',
    sourceBook: '素问·天元纪大论',
    verse: '甲己之岁，土运统之。',
    climateFeature: '甲年为土运太过，己年为土运不及；土运对应湿化。',
  },
  乙庚化金: {
    factor: '乙庚化金',
    category: '大运',
    sourceBook: '素问·天元纪大论',
    verse: '乙庚之岁，金运统之。',
    climateFeature: '乙年为金运不及，庚年为金运太过；金运对应燥化。',
  },
  丙辛化水: {
    factor: '丙辛化水',
    category: '大运',
    sourceBook: '素问·天元纪大论',
    verse: '丙辛之岁，水运统之。',
    climateFeature: '丙年为水运太过，辛年为水运不及；水运对应寒化。',
  },
  丁壬化木: {
    factor: '丁壬化木',
    category: '大运',
    sourceBook: '素问·天元纪大论',
    verse: '丁壬之岁，木运统之。',
    climateFeature: '丁年为木运不及，壬年为木运太过；木运对应风化。',
  },
  戊癸化火: {
    factor: '戊癸化火',
    category: '大运',
    sourceBook: '素问·天元纪大论',
    verse: '戊癸之岁，火运统之。',
    climateFeature: '戊年为火运太过，癸年为火运不及；火运对应热化。',
  },

  // 司天在泉
  子午少阴君火司天: {
    factor: '少阴君火司天',
    category: '司天',
    sourceBook: '素问·至真要大论',
    verse: '少阴司天，其化以热。',
    climateFeature: '少阴君火司天对应热化；具体变化结合中运、在泉与主客气判断。',
  },
  丑未太阴湿土司天: {
    factor: '太阴湿土司天',
    category: '司天',
    sourceBook: '素问·至真要大论',
    verse: '太阴司天，其化以湿。',
    climateFeature: '太阴湿土司天对应湿化；具体变化结合中运、在泉与主客气判断。',
  },
  寅申少阳相火司天: {
    factor: '少阳相火司天',
    category: '司天',
    sourceBook: '素问·至真要大论',
    verse: '少阳司天，其化以火。',
    climateFeature: '少阳相火司天对应火化；具体变化结合中运、在泉与主客气判断。',
  },
  卯酉阳明燥金司天: {
    factor: '阳明燥金司天',
    category: '司天',
    sourceBook: '素问·至真要大论',
    verse: '阳明司天，其化以燥。',
    climateFeature: '阳明燥金司天对应燥化；具体变化结合中运、在泉与主客气判断。',
  },
  辰戌太阳寒水司天: {
    factor: '太阳寒水司天',
    category: '司天',
    sourceBook: '素问·至真要大论',
    verse: '太阳司天，其化以寒。',
    climateFeature: '太阳寒水司天对应寒化；具体变化结合中运、在泉与主客气判断。',
  },
  巳亥厥阴风木司天: {
    factor: '厥阴风木司天',
    category: '司天',
    sourceBook: '素问·至真要大论',
    verse: '厥阴司天，其化以风。',
    climateFeature: '厥阴风木司天对应风化；具体变化结合中运、在泉与主客气判断。',
  },
  寅申厥阴风木在泉: {
    factor: '厥阴风木在泉',
    category: '在泉',
    sourceBook: '素问·至真要大论',
    verse: '厥阴司天为风化，在泉为酸化。',
    climateFeature: '厥阴风木在泉对应酸化，与司天、中运及各步客气合参。',
  },
  卯酉少阴君火在泉: {
    factor: '少阴君火在泉',
    category: '在泉',
    sourceBook: '素问·至真要大论',
    verse: '少阴司天为热化，在泉为苦化。',
    climateFeature: '少阴君火在泉对应苦化，与司天、中运及各步客气合参。',
  },
  辰戌太阴湿土在泉: {
    factor: '太阴湿土在泉',
    category: '在泉',
    sourceBook: '素问·至真要大论',
    verse: '太阴司天为湿化，在泉为甘化。',
    climateFeature: '太阴湿土在泉对应甘化，与司天、中运及各步客气合参。',
  },
  巳亥少阳相火在泉: {
    factor: '少阳相火在泉',
    category: '在泉',
    sourceBook: '素问·至真要大论',
    verse: '少阳司天为火化，在泉为苦化。',
    climateFeature: '少阳相火在泉对应苦化，与司天、中运及各步客气合参。',
  },
  子午阳明燥金在泉: {
    factor: '阳明燥金在泉',
    category: '在泉',
    sourceBook: '素问·至真要大论',
    verse: '阳明司天为燥化，在泉为辛化。',
    climateFeature: '阳明燥金在泉对应辛化，与司天、中运及各步客气合参。',
  },
  丑未太阳寒水在泉: {
    factor: '太阳寒水在泉',
    category: '在泉',
    sourceBook: '素问·至真要大论',
    verse: '太阳司天为寒化，在泉为咸化。',
    climateFeature: '太阳寒水在泉对应咸化，与司天、中运及各步客气合参。',
  },
};

export function getWuyunLiuqiClassic(factor: string): WuyunLiuqiClassic | undefined {
  if (typeof factor !== 'string' || !factor) return undefined;
  const entry = Object.entries(WUYUN_LIUQI_CLASSICS).find(
    ([key, value]) => factor === key || factor === value.factor,
  );
  return entry ? { ...entry[1] } : undefined;
}
