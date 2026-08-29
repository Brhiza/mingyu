import type { QizhengStarClassic } from './types';

/**
 * 《果老星宗》《通玄赋》《望斗赋》七政四余十一曜经解
 */
export const QIZHENG_STAR_CLASSICS: Record<string, QizhengStarClassic> = {
  太阳: {
    star: '太阳',
    category: '七政',
    wuxing: '阳火',
    sourceBook: '果老星宗·十一曜定局',
    verse: '日为诸曜之尊，至尊至贵。丽天普照，万汇资生；逢吉拱照，公卿显达。',
    nature: '中天教主、光明化身、尊贵名位、父兄君长、极具威信与领导力。',
    interpretation: '最喜入庙升殿，逢吉星拱照主名满天下、官爵加身、尊荣显贵。',
  },
  太阴: {
    star: '太阴',
    category: '七政',
    wuxing: '阴水',
    sourceBook: '果老星宗·十一曜定局',
    verse: '月为夜明之德，清光润泽。照耀万方，主富厚田宅；逢吉加临，温良贵美。',
    nature: '夜天星主、柔德滋润、财帛田产、母亲妻子、内秀聪颖与精神丰饶。',
    interpretation: '喜夜间生人、入未申水乡，主财源丰茂、家庭温睦、身心恬适。',
  },
  木星: {
    star: '木星',
    category: '七政',
    wuxing: '阳木',
    sourceBook: '果老星宗·十一曜定局',
    verse: '岁星东方木德，仁慈恺悌。化气为福，寿考延年；逢吉同宫，积德累勋。',
    nature: '岁星、第一福星、仁慈善良、文采风流、福寿双全、学术教育与贵人提携。',
    interpretation: '逢之百煞潜消，利于学术深造、师友相助、功名进取与社会慈善。',
  },
  火星: {
    star: '火星',
    category: '七政',
    wuxing: '阳火',
    sourceBook: '果老星宗·十一曜定局',
    verse: '荧惑南方火德，威烈礼节。发机敏捷，决断果毅；陷地多凶，防暴争灾。',
    nature: '荧惑、刚烈果决、执行迅速、礼法威仪，利军政实干，忌燥烈冲克。',
    interpretation: '庙旺主威权显赫、立功边疆；落陷需防官非火烛、血光急躁。',
  },
  土星: {
    star: '土星',
    category: '七政',
    wuxing: '阳土',
    sourceBook: '果老星宗·十一曜定局',
    verse: '镇星中央土德，厚重持中。镇守枢机，安邦定国；逢吉为库，积玉堆金。',
    nature: '镇星、沉稳厚重、信实持重、田产土地、坚韧长久，略带迟缓迟滞。',
    interpretation: '主基业稳固、晚年大成、不动产丰厚；忌失令多阻碍。',
  },
  金星: {
    star: '金星',
    category: '七政',
    wuxing: '阴金',
    sourceBook: '果老星宗·十一曜定局',
    verse: '太白西方金德，至刚尚义。文章锦绣，才艺双绝；逢吉为财，温润生辉。',
    nature: '太白、义气果决、艺术审美、财帛金玉、风雅浪漫与才情出众。',
    interpretation: '利于金融财富、艺术创作、时尚设计与婚姻恋爱。',
  },
  水星: {
    star: '水星',
    category: '七政',
    wuxing: '阴水',
    sourceBook: '果老星宗·十一曜定局',
    verse: '辰星北方水德，聪明多智。博通文史，机变灵通；逢吉化文，妙语连珠。',
    nature: '辰星、机智灵动、辩才无碍、商贸流通、文书信息与逻辑策划。',
    interpretation: '利于商业贸易、科技开发、学术交流、出版写作与谈判。',
  },
  紫炁: {
    star: '紫炁',
    category: '四余',
    wuxing: '木余',
    sourceBook: '果老星宗·十一曜定局',
    verse: '紫炁为木之余，道德之宿。清闲隐逸，玄学真诠；逢吉道骨，逍遥林泉。',
    nature: '木余、大吉神、道德文章、哲学宗教、逢凶化吉、心地光明。',
    interpretation: '主心性高洁、逢灾得救、利于玄学、艺术修养与学术隐逸。',
  },
  月孛: {
    star: '月孛',
    category: '四余',
    wuxing: '水余',
    sourceBook: '果老星宗·十一曜定局',
    verse: '月孛为水之余，风流妖冶。聪明多计，情欲缠绵；庙旺文章，陷地是非。',
    nature: '水余、极聪明诡变、才思敏捷、桃花情欲、极具穿透力与反叛色彩。',
    interpretation: '用之得当才华绝伦、破局立新；不当则防感情纠葛与隐秘是非。',
  },
  罗睺: {
    star: '罗睺',
    category: '四余',
    wuxing: '火余',
    sourceBook: '果老星宗·十一曜定局',
    verse: '罗睺为火之余，首星至烈。吞蚀日月，权威震世；逢吉大贵，逢凶伤残。',
    nature: '火余天首、杀伐霸道、权威雄强、敢为人先、极具爆发力。',
    interpretation: '遇吉化为威权、开拓创业、执掌重柄；失陷需防官非伤灾。',
  },
  计都: {
    star: '计都',
    category: '四余',
    wuxing: '土余',
    sourceBook: '果老星宗·十一曜定局',
    verse: '计都为土之余，尾宿至深。深谋阴郁，隐伏重关；庙旺权谋，陷地险阻。',
    nature: '土余天尾、隐晦深沉、坚韧耐劳、深谋远虑、防守严密。',
    interpretation: '利于暗中布局、技术攻坚与复杂风控；防孤独多疑与拖延。',
  },
};

export function getQizhengStarClassic(star: string): QizhengStarClassic | undefined {
  if (!star) return undefined;
  for (const [key, val] of Object.entries(QIZHENG_STAR_CLASSICS)) {
    if (star.includes(key)) return val;
  }
  return undefined;
}
