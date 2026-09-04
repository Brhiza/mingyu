/**
 * @file 八宅明镜九星克制与门主气口相生算法
 * @传统依据 《八宅明镜》《阳宅三要》：以贪狼木克绝命金，延年金制祸害土，天医土降六煞水；门主相生化煞。
 */
export interface BaZhaiSuppressionFact {
  star: string;
  element: '木' | '火' | '土' | '金' | '水';
  counterpart: string;
  suppressionRule: string;
  advice: string;
}

export interface BaZhaiGasRegulationResult {
  suppressionLaws: BaZhaiSuppressionFact[];
  doorMasterSummary: string;
  promptSummary: string;
}

export const NINE_STAR_WUXING: Record<string, { star: string; element: '木' | '火' | '土' | '金' | '水'; nature: '吉' | '凶' }> = {
  生气: { star: '贪狼', element: '木', nature: '吉' },
  延年: { star: '武曲', element: '金', nature: '吉' },
  天医: { star: '巨门', element: '土', nature: '吉' },
  伏位: { star: '辅弼', element: '木', nature: '吉' },
  绝命: { star: '破军', element: '金', nature: '凶' },
  五鬼: { star: '廉贞', element: '火', nature: '凶' },
  六煞: { star: '文曲', element: '水', nature: '凶' },
  祸害: { star: '禄存', element: '土', nature: '凶' },
};

/**
 * 依据《八宅明镜》评估九星相制化煞与门主气口配合
 */
export function evaluateBaZhaiRegulation(params: {
  mingGua: string;
  houseGua: string | null;
  mingGroup: '东四命' | '西四命';
  houseGroup: '东四命' | '西四命' | null;
}): BaZhaiGasRegulationResult {
  const { mingGua, houseGua, mingGroup, houseGroup } = params;

  // 1. 古典九星克制法则
  const suppressionLaws: BaZhaiSuppressionFact[] = [
    {
      star: '生气贪狼木',
      element: '木',
      counterpart: '绝命破军金',
      suppressionRule: '生气吉木制化凶煞',
      advice: '逢绝命凶方，宜引入生气吉位生发之气冲和镇抚。',
    },
    {
      star: '延年武曲金',
      element: '金',
      counterpart: '祸害禄存土',
      suppressionRule: '延年刚金制泄祸害土',
      advice: '逢祸害方多生口舌纠葛，以延年金气镇宅纳吉，化土为安。',
    },
    {
      star: '天医巨门土',
      element: '土',
      counterpart: '六煞文曲水',
      suppressionRule: '天医厚土克降六煞淫水',
      advice: '逢六煞桃花水败之位，引天医土气筑基固本，安和身心。',
    },
  ];

  // 2. 门主（命与宅）相生化气配合
  let doorMasterSummary = '';
  if (!houseGua || !houseGroup) {
    doorMasterSummary = `单见${mingGua}命，未入宅气，以命卦四吉方纳气安居。`;
  } else if (mingGroup === houseGroup) {
    doorMasterSummary = `${mingGua}命与${houseGua}宅同属${mingGroup}，门主同元相生相和，吉气纯一，福力深厚。`;
  } else {
    doorMasterSummary = `${mingGua}命属${mingGroup}而${houseGua}宅属${houseGroup}，命宅相悖；依《八宅明镜》宜以命卦吉向为主、调和门主气口化凶为吉。`;
  }

  const promptSummary = `气口制化：${doorMasterSummary}（延年制祸害，天医降六煞，贪狼制绝命）`;

  return {
    suppressionLaws,
    doorMasterSummary,
    promptSummary,
  };
}
