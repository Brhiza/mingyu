import type { AlmanacOfficerClassic } from './types';

/**
 * 清代《协纪辨方书》《玉匣记》建除十二神歌诀与吉凶宜忌
 */
export const ALMANAC_OFFICER_CLASSICS: Record<string, AlmanacOfficerClassic> = {
  建: {
    officer: '建日',
    order: 1,
    auspice: '吉',
    sourceBook: '协纪辨方书·卷十',
    verse: '建日相逢万事通，出入开张大吉昌。求官上任迎祥瑞，嫁娶安床福禄长。',
    suitable: ['出行', '开业', '上任', '祈福', '求嗣', '动土'],
    taboo: ['乘船', '开仓', '破土动葬'],
  },
  除: {
    officer: '除日',
    order: 2,
    auspice: '吉',
    sourceBook: '协纪辨方书·卷十',
    verse: '除日扫除万恶消，求医问药病魔逃。破贼除奸皆顺利，清吉平安乐陶陶。',
    suitable: ['扫舍', '求医', '沐浴', '治病', '解除', '破贼'],
    taboo: ['结婚', '开张', '出行'],
  },
  满: {
    officer: '满日',
    order: 3,
    auspice: '吉',
    sourceBook: '协纪辨方书·卷十',
    verse: '满日丰盈福满堂，造屋开市喜非常。栽种进人口益寿，立券交易纳千箱。',
    suitable: ['开市', '交易', '立券', '栽种', '纳畜', '进人'],
    taboo: ['服药', '求医', '动土'],
  },
  平: {
    officer: '平日',
    order: 4,
    auspice: '平',
    sourceBook: '协纪辨方书·卷十',
    verse: '平日平平顺事行，修道安宁莫争衡。治道修堤添美景，造桥砌路保安宁。',
    suitable: ['修路', '涂抹', '整手足甲', '安门', '平整道途'],
    taboo: ['祈福', '嫁娶', '开渠'],
  },
  定: {
    officer: '定日',
    order: 5,
    auspice: '吉',
    sourceBook: '协纪辨方书·卷十',
    verse: '定日安康百福生，冠带纳采喜相迎。安床竖柱皆如意，定局谋为始见成。',
    suitable: ['纳采', '订盟', '进人口', '安床', '竖柱上梁', '开市'],
    taboo: ['诉讼', '出师', '医疗'],
  },
  执: {
    officer: '执日',
    order: 6,
    auspice: '吉',
    sourceBook: '协纪辨方书·卷十',
    verse: '执日执守大吉昌，捕捉盗贼不须忙。立券交易安家宅，执定良规福禄长。',
    suitable: ['捕捉', '纳物', '建醮', '祭祀', '结婚', '立券'],
    taboo: ['开市', '出财', '搬迁'],
  },
  破: {
    officer: '破日',
    order: 7,
    auspice: '凶',
    sourceBook: '协纪辨方书·卷十',
    verse: '破日逢冲万事休，动工嫁娶惹仇休。求医破屋求吉利，余事逢之祸自留。',
    suitable: ['破屋', '拆卸', '除服', '治病', '求医破阵'],
    taboo: ['开张', '结婚', '出行', '签约', '祭祀'],
  },
  危: {
    officer: '危日',
    order: 8,
    auspice: '平',
    sourceBook: '协纪辨方书·卷十',
    verse: '危日登高履险惊，小心谨慎得安宁。安床设醮祈神佑，博弈行险莫乱行。',
    suitable: ['安床', '祭祀', '祈福', '安抚边防'],
    taboo: ['登山', '履险', '乘船渡水', '冒险投机'],
  },
  成: {
    officer: '成日',
    order: 9,
    auspice: '吉',
    sourceBook: '协纪辨方书·卷十',
    verse: '成日大吉百事欢，求名求利上金銮。婚姻开业逢大吉，立业成家享泰安。',
    suitable: ['开业', '结婚', '入学', '签约', '出行', '上任'],
    taboo: ['诉讼', '动土开池'],
  },
  收: {
    officer: '收日',
    order: 10,
    auspice: '吉',
    sourceBook: '协纪辨方书·卷十',
    verse: '收日纳藏聚宝盆，开仓纳谷富门庭。买卖交易迎财喜，埋葬安宁保安存。',
    suitable: ['开仓', '收谷', '进人口', '求财', '捕鱼', '纳财'],
    taboo: ['出行', '针灸', '放债'],
  },
  开: {
    officer: '开日',
    order: 11,
    auspice: '吉',
    sourceBook: '协纪辨方书·卷十',
    verse: '开日大开福门庭，求财见贵两相迎。动工造作皆亨通，百事逢之自显荣。',
    suitable: ['开市', '开工', '求职', '见贵', '结婚', '出行'],
    taboo: ['破土', '安葬', '伏法'],
  },
  闭: {
    officer: '闭日',
    order: 12,
    auspice: '凶',
    sourceBook: '协纪辨方书·卷十',
    verse: '闭日闭塞不通灵，修筑堤防防损倾。造仓筑穴闭固吉，其余诸事莫妄行。',
    suitable: ['修造仓廪', '填坑', '补垣', '筑堤', '关防'],
    taboo: ['开张', '出行', '求医', '诉讼', '结婚'],
  },
};

export function getAlmanacOfficerClassic(officer: string): AlmanacOfficerClassic | undefined {
  if (!officer) return undefined;
  const clean = officer.replace(/[日值神]/gu, '').slice(0, 1);
  return ALMANAC_OFFICER_CLASSICS[clean] || ALMANAC_OFFICER_CLASSICS[officer];
}
