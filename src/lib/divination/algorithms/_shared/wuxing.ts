/**
 * @file 五行与地支关系共享函数库
 * @description 提供五行生克、地支六合/三合/半合/六冲/六害/三刑/三会/藏干等完整传统关系。
 * @古籍依据 《渊海子平》《三命通会》《协纪辨方书》《蠡海集》
 */

export const BRANCH_WUXING: Record<string, string> = {
  子: '水',
  丑: '土',
  寅: '木',
  卯: '木',
  辰: '土',
  巳: '火',
  午: '火',
  未: '土',
  申: '金',
  酉: '金',
  戌: '土',
  亥: '水',
};

// 月令当令五行（按月建地支本气定当令之神）：
// 同令为旺，令生为相，生令为休，令克为囚，克令为死。
// 六爻、梅花共用，比季节粗分（春夏秋冬）更精确。
export const MONTH_LING_WUXING: Record<string, string> = {
  子: '水',
  丑: '土',
  寅: '木',
  卯: '木',
  辰: '土',
  巳: '火',
  午: '火',
  未: '土',
  申: '金',
  酉: '金',
  戌: '土',
  亥: '水',
};

/**
 * 地支六合（《蠡海集》《三命通会》）：
 * 子丑合土、寅亥合木、卯戌合火、辰酉合金、巳申合水、午未合土
 */
export const LIUHE_MAP: Record<string, string> = {
  子: '丑', 丑: '子',
  寅: '亥', 亥: '寅',
  卯: '戌', 戌: '卯',
  辰: '酉', 酉: '辰',
  巳: '申', 申: '巳',
  午: '未', 未: '午',
};

/** 六合化五行 */
export const LIUHE_WUXING: Record<string, string> = {
  子: '土', 丑: '土',
  寅: '木', 亥: '木',
  卯: '火', 戌: '火',
  辰: '金', 酉: '金',
  巳: '水', 申: '水',
  午: '土', 未: '土',
};

/**
 * 地支三合局（十二支三合化一局）：
 * 申子辰合水局、亥卯未合木局、寅午戌合火局、巳酉丑合金局
 */
export const SANHE_GROUPS: Record<string, string[]> = {
  水局: ['申', '子', '辰'],
  木局: ['亥', '卯', '未'],
  火局: ['寅', '午', '戌'],
  金局: ['巳', '酉', '丑'],
};

/** 各支所属三合局 */
export const BRANCH_SANHE: Record<string, { group: string; partners: string[] }> = {
  申: { group: '水局', partners: ['子', '辰'] },
  子: { group: '水局', partners: ['申', '辰'] },
  辰: { group: '水局', partners: ['申', '子'] },
  亥: { group: '木局', partners: ['卯', '未'] },
  卯: { group: '木局', partners: ['亥', '未'] },
  未: { group: '木局', partners: ['亥', '卯'] },
  寅: { group: '火局', partners: ['午', '戌'] },
  午: { group: '火局', partners: ['寅', '戌'] },
  戌: { group: '火局', partners: ['寅', '午'] },
  巳: { group: '金局', partners: ['酉', '丑'] },
  酉: { group: '金局', partners: ['巳', '丑'] },
  丑: { group: '金局', partners: ['巳', '酉'] },
};

/**
 * 地支半合 — 三合中缺一
 * 如有申子而无辰，为水局半合，合而不全
 */
export function isHalfSanhe(branches: string[]): string | null {
  for (const [group, members] of Object.entries(SANHE_GROUPS)) {
    const present = branches.filter((b) => members.includes(b));
    if (present.length === 2) {
      return group;
    }
  }
  return null;
}

/**
 * 地支三会（《淮南子》《三命通会》）：
 * 寅卯辰会木局（东方）、巳午未会火局（南方）、
 * 申酉戌会金局（西方）、亥子丑会水局（北方）
 */
export const SANHUI_GROUPS: Record<string, string[]> = {
  东方木: ['寅', '卯', '辰'],
  南方火: ['巳', '午', '未'],
  西方金: ['申', '酉', '戌'],
  北方水: ['亥', '子', '丑'],
};

/**
 * 地支相穿/六害（《协纪辨方书》）：
 * 子未害、丑午害、寅巳害、卯辰害、申亥害、酉戌害
 */
export const LIUHAI_MAP: Record<string, string> = {
  子: '未', 未: '子',
  丑: '午', 午: '丑',
  寅: '巳', 巳: '寅',
  卯: '辰', 辰: '卯',
  申: '亥', 亥: '申',
  酉: '戌', 戌: '酉',
};

/**
 * 地支六冲（六冲为对宫相冲）：
 * 子午冲、丑未冲、寅申冲、卯酉冲、辰戌冲、巳亥冲
 */
export const LIUCHONG_MAP: Record<string, string> = {
  子: '午', 午: '子',
  丑: '未', 未: '丑',
  寅: '申', 申: '寅',
  卯: '酉', 酉: '卯',
  辰: '戌', 戌: '辰',
  巳: '亥', 亥: '巳',
};

/**
 * 地支三刑（《阴符经》三刑定例）：
 * - 无礼之刑：子刑卯、卯刑子
 * - 无恩之刑：寅刑巳、巳刑申、申刑寅（三刑互刑）
 * - 恃势之刑：丑刑戌、戌刑未、未刑丑
 * - 自刑：辰刑辰、午刑午、酉刑酉、亥刑亥
 */
export const SANXING_MAP: Record<string, string> = {
  子: '卯', 卯: '子',
  寅: '巳', 巳: '申', 申: '寅',
  丑: '戌', 戌: '未', 未: '丑',
  辰: '辰', 午: '午', 酉: '酉', 亥: '亥',
};

export enum SanxingType {
  WULI = '无礼之刑',   // 子卯
  WUEN = '无恩之刑',   // 寅巳申
  SHISHI = '恃势之刑', // 丑戌未
  ZIXING = '自刑',      // 辰午酉亥
}

/** 获取三刑类型 */
export function getSanxingType(branch: string): SanxingType | null {
  if (branch === '子' || branch === '卯') return SanxingType.WULI;
  if (['寅', '巳', '申'].includes(branch)) return SanxingType.WUEN;
  if (['丑', '戌', '未'].includes(branch)) return SanxingType.SHISHI;
  if (['辰', '午', '酉', '亥'].includes(branch)) return SanxingType.ZIXING;
  return null;
}

/**
 * 地支藏干（《渊海子平》《三命通会》本气/中气/余气）：
 * 各支所藏天干，按本气（主气）、中气（次气）、余气排列
 */
export const BRANCH_HIDDEN_STEMS: Record<string, string[]> = {
  子: ['癸'],
  丑: ['己', '癸', '辛'],
  寅: ['甲', '丙', '戊'],
  卯: ['乙'],
  辰: ['戊', '乙', '癸'],
  巳: ['丙', '庚', '戊'],
  午: ['丁', '己'],
  未: ['己', '丁', '乙'],
  申: ['庚', '壬', '戊'],
  酉: ['辛'],
  戌: ['戊', '辛', '丁'],
  亥: ['壬', '甲'],
};

/** 地支所藏本气（主气） */
export function getHiddenMainStem(branch: string): string {
  const stems = BRANCH_HIDDEN_STEMS[branch];
  return stems?.[0] || '';
}

/** 地支所藏中气（次气） */
export function getHiddenMediumStem(branch: string): string | undefined {
  return BRANCH_HIDDEN_STEMS[branch]?.[1];
}

/** 地支所藏余气 */
export function getHiddenResidualStem(branch: string): string | undefined {
  return BRANCH_HIDDEN_STEMS[branch]?.[2];
}

/**
 * 天干合化（《三命通会》天干五合）：
 * 甲己合化土、乙庚合化金、丙辛合化水、丁壬合化木、戊癸合化火
 */
export const TIAN_GAN_HE: Record<string, { partner: string; wuxing: string }> = {
  甲: { partner: '己', wuxing: '土' },
  乙: { partner: '庚', wuxing: '金' },
  丙: { partner: '辛', wuxing: '水' },
  丁: { partner: '壬', wuxing: '木' },
  戊: { partner: '癸', wuxing: '火' },
  己: { partner: '甲', wuxing: '土' },
  庚: { partner: '乙', wuxing: '金' },
  辛: { partner: '丙', wuxing: '水' },
  壬: { partner: '丁', wuxing: '木' },
  癸: { partner: '戊', wuxing: '火' },
};

/**
 * 天干相冲：
 * 甲庚冲、乙辛冲、丙壬冲、丁癸冲、戊己冲
 */
export const TIAN_GAN_CHONG: Record<string, string> = {
  甲: '庚', 庚: '甲',
  乙: '辛', 辛: '乙',
  丙: '壬', 壬: '丙',
  丁: '癸', 癸: '丁',
  戊: '己', 己: '戊',
};

/**
 * 地支顺序索引
 */
export const BRANCH_ORDER = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

/**
 * 天干顺序索引
 */
export const STEM_ORDER = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];

const SHENG_MAP: Record<string, string> = {
  木: '火',
  火: '土',
  土: '金',
  金: '水',
  水: '木',
};

const KE_MAP: Record<string, string> = {
  木: '土',
  土: '水',
  水: '火',
  火: '金',
  金: '木',
};

/**
 * 按《增删卜易》月令提纲定五行旺相休囚死：
 * 旺=同令，相=令生，休=生令，囚=令克，死=克令。
 */
export function getSeasonState(
  yaoWuxing: string,
  monthBranch: string,
): '旺' | '相' | '休' | '囚' | '死' | '平' {
  const lingWuxing = MONTH_LING_WUXING[monthBranch];
  if (!lingWuxing || !yaoWuxing) {
    return '平';
  }
  if (lingWuxing === yaoWuxing) return '旺';
  if (isSheng(lingWuxing, yaoWuxing)) return '相';
  if (isSheng(yaoWuxing, lingWuxing)) return '休';
  if (isKe(lingWuxing, yaoWuxing)) return '囚';
  if (isKe(yaoWuxing, lingWuxing)) return '死';
  return '平';
}

export function getBranchWuxing(branch: string): string {
  return BRANCH_WUXING[branch] || '';
}

export function isSheng(source: string, target: string): boolean {
  return SHENG_MAP[source] === target;
}

export function isKe(source: string, target: string): boolean {
  return KE_MAP[source] === target;
}

/** 检查两个地支是否为六合关系 */
export function isLiuhe(a: string, b: string): boolean {
  return LIUHE_MAP[a] === b;
}

/** 检查两个地支是否为六冲关系 */
export function isLiuchong(a: string, b: string): boolean {
  return LIUCHONG_MAP[a] === b;
}

/** 检查两个地支是否为六害关系 */
export function isLiuhai(a: string, b: string): boolean {
  return LIUHAI_MAP[a] === b;
}

/** 检查两个地支是否为三刑关系 */
export function isSanxing(a: string, b: string): boolean {
  return SANXING_MAP[a] === b;
}

/** 检查数组中是否构成完整的三合局 */
export function isCompleteSanhe(branches: string[]): string | null {
  for (const [group, members] of Object.entries(SANHE_GROUPS)) {
    if (members.every((m) => branches.includes(m))) {
      return group;
    }
  }
  return null;
}

/** 检查数组中是否构成三会局 */
export function isCompleteSanhui(branches: string[]): string | null {
  for (const [group, members] of Object.entries(SANHUI_GROUPS)) {
    if (members.every((m) => branches.includes(m))) {
      return group;
    }
  }
  return null;
}

/** 检查两个天干是否为五合关系 */
export function isTianGanHe(a: string, b: string): boolean {
  return TIAN_GAN_HE[a]?.partner === b;
}

/** 获取天干五合的化气五行 */
export function getTianGanHeWuxing(stem: string): string | null {
  return TIAN_GAN_HE[stem]?.wuxing || null;
}

/** 检查地支是否为驿马（寅午戌年马在申等） */
export function getYiMa(yearBranch: string): string {
  const map: Record<string, string> = {
    寅: '申', 午: '申', 戌: '申',
    申: '寅', 子: '寅', 辰: '寅',
    巳: '亥', 酉: '亥', 丑: '亥',
    亥: '巳', 卯: '巳', 未: '巳',
  };
  return map[yearBranch] || '';
}

/** 检查地支是否为桃花（寅午戌年卯等） */
export function getTaoHua(yearBranch: string): string {
  const map: Record<string, string> = {
    寅: '卯', 午: '卯', 戌: '卯',
    申: '酉', 子: '酉', 辰: '酉',
    巳: '午', 酉: '午', 丑: '午',
    亥: '子', 卯: '子', 未: '子',
  };
  return map[yearBranch] || '';
}

/** 获取地支对冲（对宫位） */
export function getOppositeBranch(branch: string): string {
  return LIUCHONG_MAP[branch] || branch;
}

/** 获取地支的三合局中对应长生位 */
export function getChangSheng(branch: string): string {
  const map: Record<string, string> = {
    寅: '亥', // 火局长生在寅，但其本身为取用
  };
  return map[branch] || '';
}
