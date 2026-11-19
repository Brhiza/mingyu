import { dedupeExcerpts, type ClassicExcerpt } from './types';
import { selectYilinClassic } from './yilin';
import { selectZhouyiWingClassics } from '../zhouyi-text';

interface MeihuaRelationEntry {
  relationType: string;
  classicSummary: string;
  context: string;
}

interface MeihuaTrigramEntry {
  trigram: string;
  name: string;
  nature: string;
  wuxing: string;
  family: string;
  matters: string;
  verse: string;
}

/** 《梅花易数》卷二《体用总诀》的本卦体用关系原句。 */
const CANONICAL_MEIHUA_RELATIONS: Record<string, MeihuaRelationEntry> = {
  体用比和: {
    relationType: '体用比和',
    classicSummary: '体用比和，则百事顺遂。',
    context: '结合体卦旺衰、互卦与变卦判断本局。',
  },
  体克用: {
    relationType: '体克用',
    classicSummary: '体克用，诸事吉。',
    context: '结合体卦旺衰、互卦与变卦判断本局。',
  },
  用克体: {
    relationType: '用克体',
    classicSummary: '用克体，诸事凶。',
    context: '结合体卦旺衰、互卦与变卦判断本局。',
  },
  体生用: {
    relationType: '体生用',
    classicSummary: '体生用，有耗失之患。',
    context: '结合体卦旺衰、互卦与变卦判断本局。',
  },
  用生体: {
    relationType: '用生体',
    classicSummary: '用生体，有进益之喜。',
    context: '结合体卦旺衰、互卦与变卦判断本局。',
  },
};

/**
 * 《梅花易数·八卦万物类象》象数全览
 */
const CANONICAL_MEIHUA_TRIGRAMS: Record<string, MeihuaTrigramEntry> = {
  乾: {
    trigram: '乾',
    name: '乾为天',
    nature: '刚健纯粹、至高无上、圆融权威',
    wuxing: '金',
    family: '父亲、长辈、君主、领袖',
    matters: '高层决策、国家政事、金融核心、重要考试、创始开局',
    verse: '乾为天，天风姤，天山遁，天地否，风地观，山地剥，火地晋，火天大有。乾者健也，纯阳至尊。',
  },
  坤: {
    trigram: '坤',
    name: '坤为地',
    nature: '厚德载物、柔顺包容、承载滋养',
    wuxing: '土',
    family: '母亲、妻子、老妇、众人',
    matters: '土地地产、农业仓储、服务支持、团队培育、长线蓄力',
    verse: '坤为地，地雷复，地泽临，地天泰，雷天大壮，泽天夬，水天需，水地比。坤者顺也，纯阴厚德。',
  },
  震: {
    trigram: '震',
    name: '震为雷',
    nature: '奋发震荡、雷厉风行、开拓革新',
    wuxing: '木',
    family: '长男、兄长、青年骨干、执法者',
    matters: '紧急出击、立项攻坚、车辆交通、发布会、名声大噪',
    verse: '震为雷，雷地豫，雷水解，雷风恒，地风升，水风井，泽风大过，泽雷随。震者动也，阳气初生。',
  },
  巽: {
    trigram: '巽',
    name: '巽为风',
    nature: '顺势而入、无孔不入、流通传播',
    wuxing: '木',
    family: '长女、文人、商人、中介',
    matters: '进出口贸易、信息流通、文化教育、商务谈判、自由职业',
    verse:
      '巽为风，风天小畜，风火家人，风雷益，天雷无妄，火雷噬嗑，山雷颐，山风蛊。巽者入也，柔顺申命。',
  },
  坎: {
    trigram: '坎',
    name: '坎为水',
    nature: '潜藏润下、曲折多艰、深谋睿智',
    wuxing: '水',
    family: '中男、智囊、隐士、探险家',
    matters: '水利航运、隐秘情报、危机公关、学术研发、资金周转',
    verse:
      '坎为水，水泽节，水雷屯，水火既济，泽火革，雷火丰，地火明夷，地水师。坎者陷也，险中求胜。',
  },
  离: {
    trigram: '离',
    name: '离为火',
    nature: '光明丽天、热情文明、虚荣附丽',
    wuxing: '火',
    family: '中女、文士、名人、艺人',
    matters: '文书合同、文化传媒、视觉艺术、名誉评奖、前沿科技',
    verse:
      '离为火，火山旅，火风鼎，火水未济，山水蒙，风水涣，天水讼，天火同人。离者丽也，附丽光明。',
  },
  艮: {
    trigram: '艮',
    name: '艮为山',
    nature: '止而不动、稳重守静、止戈为武',
    wuxing: '土',
    family: '少男、门卫、山民、守护者',
    matters: '守静安分、不动产购置、闭关研发、防守避险、终结归档',
    verse:
      '艮为山，山火贲，山天大畜，山泽损，火泽睽，天泽履，风泽中孚，风山渐。艮者止也，动静不失其时。',
  },
  兑: {
    trigram: '兑',
    name: '兑为泽',
    nature: '喜悦和悦、口舌言辞、破损决断',
    wuxing: '金',
    family: '少女、演说家、律师、翻译、歌者',
    matters: '演说辩论、法律诉讼、娱乐餐饮、商业谈判、公关销售',
    verse:
      '兑为泽，泽水困，泽地萃，泽山咸，水山蹇，地山谦，雷山小过，雷泽归妹。兑者说也，和悦以使民。',
  },
};

export function selectMeihuaClassics({
  trigrams,
  relation,
  originalHexagram,
  changedHexagram,
}: {
  trigrams?: string[];
  relation?: string;
  originalHexagram?: string;
  changedHexagram?: string;
} = {}): ClassicExcerpt[] {
  const results: ClassicExcerpt[] = [];

  if (relation) {
    const matchedKey = Object.keys(CANONICAL_MEIHUA_RELATIONS).find(
      (key) => relation === key || relation.includes(key),
    );
    if (matchedKey) {
      const entry = CANONICAL_MEIHUA_RELATIONS[matchedKey];
      results.push({
        book: '梅花易数',
        chapter: '体用总诀',
        title: entry.relationType,
        quote: entry.classicSummary,
        explanation: entry.context,
        condition: entry.relationType,
      });
    }
  }

  if (trigrams?.length) {
    for (const raw of trigrams) {
      if (!raw) continue;
      const key = [raw.slice(0, 1), raw].find((val) =>
        Object.hasOwn(CANONICAL_MEIHUA_TRIGRAMS, val),
      );
      if (!key) continue;
      const entry = CANONICAL_MEIHUA_TRIGRAMS[key];
      results.push({
        book: '梅花易数',
        chapter: '八卦万物类象',
        title: entry.name,
        quote: entry.verse,
        explanation: `性情：${entry.nature}；五行：${entry.wuxing}；人物：${entry.family}；人事：${entry.matters}`,
        condition: entry.trigram,
      });
    }
  }

  const yilinExcerpt = selectYilinClassic({
    baseHexagram: originalHexagram,
    targetHexagram: changedHexagram,
  });
  if (yilinExcerpt) {
    results.push(yilinExcerpt);
  }

  results.push(
    ...selectZhouyiWingClassics({
      trigrams,
      originalHexagram,
      changedHexagram,
    }),
  );

  return dedupeExcerpts(results);
}
