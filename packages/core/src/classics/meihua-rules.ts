import type { MeihuaBodyUseJudgement } from './types';

/**
 * 《梅花易数》体用生克与万物类象断语表
 * 原典出处：《梅花易数·体用总断》《观梅数诀》
 */
export const MEIHUA_RELATION_JUDGEMENTS: Record<string, MeihuaBodyUseJudgement> = {
  体用比和: {
    relationType: '体用比和',
    auspice: '大吉',
    classicSummary: '体用比和，百事顺遂。主客意气相投，谋为无阻，彼此互利。',
    actionAdvice: '双方目标一致，沟通极度顺畅，宜乘胜追击，全力推进计划。',
    matterCategories: {
      wishing: '求事必成，顺心遂意，得同道相助。',
      seekingWealth: '利于合伙经商，买卖公平，获利丰厚。',
      marriage: '琴瑟和鸣，门当户对，天作之合。',
      travel: '一路顺风，结伴同欢，平安大吉。',
      illness: '病势平稳，吉星拱照，指日可愈。',
    },
  },
  体克用: {
    relationType: '体克用',
    auspice: '吉',
    classicSummary: '体克用者事必成。我克彼为财，虽费心力，终能制伏对手，夺得主动。',
    actionAdvice: '事在人为，需付出辛劳与耐心方见成效，切忌半途而废。',
    matterCategories: {
      wishing: '虽经波折与竞争，最终由我方胜出。',
      seekingWealth: '求财有利，需主动争取，劳而有获。',
      marriage: '我方处于主导地位，虽有微词终能成婚。',
      travel: '可行，途中有小阻力但不影响大局。',
      illness: '自身体质强健，能克制病魔，无大碍。',
    },
  },
  用克体: {
    relationType: '用克体',
    auspice: '大凶',
    classicSummary: '用克体者事受阻。彼来克我，如泰山压顶，祸患潜藏，切忌盲进。',
    actionAdvice: '当前局势受制于人，强行推进必遭惨败，应当退避三舍、静观其变。',
    matterCategories: {
      wishing: '谋事难成，处处受阻，防小人作祟。',
      seekingWealth: '大忌投资！必见破财受损，宜严控资金。',
      marriage: '多受对方掣肘或家庭反对，难谐琴瑟。',
      travel: '不宜远行，谨防意外受阻或财物遗失。',
      illness: '病情凶险，受克太重，急需名医救治。',
    },
  },
  体生用: {
    relationType: '体生用',
    auspice: '小损',
    classicSummary: '体生用者有耗损。我生彼为泄气，劳碌费力，为他人作嫁衣裳。',
    actionAdvice: '需警惕资源被过度消耗，不可打肿脸充胖子，合理设置投入止损线。',
    matterCategories: {
      wishing: '付出多而收获少，事倍功半。',
      seekingWealth: '成本过高，利润微薄，甚至产生亏空。',
      marriage: '我方单方面付出过多，对方珍惜不足。',
      travel: '奔波劳碌，费用超支，心力交瘁。',
      illness: '元气亏虚，免疫力低下，需大补元气。',
    },
  },
  用生体: {
    relationType: '用生体',
    auspice: '大吉',
    classicSummary: '用生体者进益无穷。彼来生我，如母哺乳，贵人扶持，坐享其成。',
    actionAdvice: '天降良机，外部资源主动靠拢，宜敞开怀抱借力发展。',
    matterCategories: {
      wishing: '贵人鼎力相助，事半功倍，马到成功。',
      seekingWealth: '财源主动送上门，投资回报超乎预期。',
      marriage: '对方倾心相待，得贤良配偶，助益良多。',
      travel: '出入贵人相迎，获益良多，大吉大利。',
      illness: '得良方神药，宿疾速愈，精力倍增。',
    },
  },
};

import type { MeihuaTrigramClassic } from './types';

/**
 * 《梅花易数·八卦万物类象》象数全览
 */
export const MEIHUA_TRIGRAM_CLASSICS: Record<string, MeihuaTrigramClassic> = {
  乾: {
    trigram: '乾',
    name: '乾为天',
    nature: '刚健纯粹、至高无上、圆融权威',
    wuxing: '金',
    family: '父亲、长辈、君主、领袖',
    bodyPart: '头部、骨骼、肺部、右脑',
    matters: '高层决策、国家政事、金融核心、重要考试、创始开局',
    sourceBook: '梅花易数·八卦万物类象',
    verse: '乾为天，天风姤，天山遁，天地否，风地观，山地剥，火地晋，火天大有。乾者健也，纯阳至尊。',
  },
  坤: {
    trigram: '坤',
    name: '坤为地',
    nature: '厚德载物、柔顺包容、承载滋养',
    wuxing: '土',
    family: '母亲、妻子、老妇、众人',
    bodyPart: '腹部、脾胃、肌肉、右肩',
    matters: '土地地产、农业仓储、服务支持、团队培育、长线蓄力',
    sourceBook: '梅花易数·八卦万物类象',
    verse: '坤为地，地雷复，地泽临，地天泰，雷天大壮，泽天夬，水天需，水地比。坤者顺也，纯阴厚德。',
  },
  震: {
    trigram: '震',
    name: '震为雷',
    nature: '奋发震荡、雷厉风行、开拓革新',
    wuxing: '木',
    family: '长男、兄长、青年骨干、执法者',
    bodyPart: '足部、肝胆、神经、声带',
    matters: '紧急出击、立项攻坚、车辆交通、发布会、名声大噪',
    sourceBook: '梅花易数·八卦万物类象',
    verse: '震为雷，雷地豫，雷水解，雷风恒，地风升，水风井，泽风大过，泽雷随。震者动也，阳气初生。',
  },
  巽: {
    trigram: '巽',
    name: '巽为风',
    nature: '顺势而入、无孔不入、流通传播',
    wuxing: '木',
    family: '长女、文人、商人、中介',
    bodyPart: '大腿、呼吸道、经络、左肩',
    matters: '进出口贸易、信息流通、文化教育、商务谈判、自由职业',
    sourceBook: '梅花易数·八卦万物类象',
    verse:
      '巽为风，风天小畜，风火家人，风雷益，天雷无妄，火雷噬嗑，山雷颐，山风蛊。巽者入也，柔顺申命。',
  },
  坎: {
    trigram: '坎',
    name: '坎为水',
    nature: '潜藏润下、曲折多艰、深谋睿智',
    wuxing: '水',
    family: '中男、智囊、隐士、探险家',
    bodyPart: '肾脏、泌尿生殖、血液、耳部',
    matters: '水利航运、隐秘情报、危机公关、学术研发、资金周转',
    sourceBook: '梅花易数·八卦万物类象',
    verse:
      '坎为水，水泽节，水雷屯，水火既济，泽火革，雷火丰，地火明夷，地水师。坎者陷也，险中求胜。',
  },
  离: {
    trigram: '离',
    name: '离为火',
    nature: '光明丽天、热情文明、虚荣附丽',
    wuxing: '火',
    family: '中女、文士、名人、艺人',
    bodyPart: '眼目、心脏、小肠、脑神经',
    matters: '文书合同、文化传媒、视觉艺术、名誉评奖、前沿科技',
    sourceBook: '梅花易数·八卦万物类象',
    verse:
      '离为火，火山旅，火风鼎，火水未济，山水蒙，风水涣，天水讼，天火同人。离者丽也，附丽光明。',
  },
  艮: {
    trigram: '艮',
    name: '艮为山',
    nature: '止而不动、稳重守静、止戈为武',
    wuxing: '土',
    family: '少男、门卫、山民、守护者',
    bodyPart: '背部、手指、鼻子、关节',
    matters: '守静安分、不动产购置、闭关研发、防守避险、终结归档',
    sourceBook: '梅花易数·八卦万物类象',
    verse:
      '艮为山，山火贲，山天大畜，山泽损，火泽睽，天泽履，风泽中孚，风山渐。艮者止也，动静不失其时。',
  },
  兑: {
    trigram: '兑',
    name: '兑为泽',
    nature: '喜悦和悦、口舌言辞、破损决断',
    wuxing: '金',
    family: '少女、演说家、律师、翻译、歌者',
    bodyPart: '口齿、舌咽、气管、右肋',
    matters: '演说辩论、法律诉讼、娱乐餐饮、商业谈判、公关销售',
    sourceBook: '梅花易数·八卦万物类象',
    verse:
      '兑为泽，泽水困，泽地萃，泽山咸，水山蹇，地山谦，雷山小过，雷泽归妹。兑者说也，和悦以使民。',
  },
};

export function getMeihuaTrigramClassic(trigram: string): MeihuaTrigramClassic | undefined {
  if (!trigram) return undefined;
  const key = trigram.slice(0, 1);
  return MEIHUA_TRIGRAM_CLASSICS[key] || MEIHUA_TRIGRAM_CLASSICS[trigram];
}
