import type { QimenStemPattern } from './types';

export const QIMEN_STEM_PATTERNS: Record<string, QimenStemPattern> = {
  '戊+戊': {
    heavenStem: '戊',
    earthStem: '戊',
    name: '青龙伏吟',
    auspice: '平',
    classicVerse: '戊加戊为青龙伏吟：凡事闭塞阻滞，静守自安，妄动招灾。',
    modernMeaning: '当前局势处于停滞与盘整期，不宜开展新的投资或变动，宜维持现状、稳扎稳打。',
    category: '十干克应',
  },
  '戊+乙': {
    heavenStem: '戊',
    earthStem: '乙',
    name: '青龙合会',
    auspice: '吉',
    classicVerse: '戊加乙为青龙合会：门吉事吉，门凶事凶，求谋有贵人相助。',
    modernMeaning: '利于合作协商、结识贵人；若配合吉门（开、休、生），事半功倍。',
    category: '三奇得使',
  },
  '戊+丙': {
    heavenStem: '戊',
    earthStem: '丙',
    name: '青龙反首',
    auspice: '大吉',
    classicVerse: '戊加丙为青龙反首：动作大利，求名求利百事顺遂，若逢墓迫吉事成空。',
    modernMeaning: '奇门第一大吉格！主动出击、开展项目、求职签约均有极大胜算，乘胜追击之时。',
    category: '三奇贵格',
  },
  '戊+丁': {
    heavenStem: '戊',
    earthStem: '丁',
    name: '青龙耀明',
    auspice: '吉',
    classicVerse: '戊加丁为青龙耀明：宜见上官，求名显达，词讼得理。',
    modernMeaning: '文书、合同、面试、评奖极为有利，利于展现才华与沟通上级。',
    category: '三奇贵格',
  },
  '戊+己': {
    heavenStem: '戊',
    earthStem: '己',
    name: '贵人入狱',
    auspice: '凶',
    classicVerse: '戊加己为贵人入狱：公私不利，阻碍重重，防小人暗中算计。',
    modernMeaning: '自身优势受限，易陷入制度或人情泥潭，务必防范口舌是非与暗箱操作。',
    category: '凶格刑悖',
  },
  '戊+庚': {
    heavenStem: '戊',
    earthStem: '庚',
    name: '值符飞宫',
    auspice: '凶',
    classicVerse: '戊加庚为值符飞宫：吉事化虚，主易位换人，吉事不显，凶事更凶。',
    modernMeaning: '职位变动、居所迁移或管理权旁落，不宜坚守原位，宜主动寻求灵活转型。',
    category: '凶格刑悖',
  },
  '戊+辛': {
    heavenStem: '戊',
    earthStem: '辛',
    name: '青龙折足',
    auspice: '凶',
    classicVerse: '戊加辛为青龙折足：若逢吉门尚可救助，门凶必招折伤、破财与官非。',
    modernMeaning: '行动力受挫、资金链吃紧或下属得咎，需谨防合同漏洞和财务垫资风险。',
    category: '凶格刑悖',
  },
  '戊+壬': {
    heavenStem: '戊',
    earthStem: '壬',
    name: '青龙入天牢',
    auspice: '凶',
    classicVerse: '戊加壬为青龙入天牢：凡占皆阻，阴阳交错，进退维谷。',
    modernMeaning: '事务被动，受到外部不可抗力牵制，切忌强行推进，需耐心等待时机。',
    category: '凶格刑悖',
  },
  '戊+癸': {
    heavenStem: '戊',
    earthStem: '癸',
    name: '青龙华盖',
    auspice: '吉',
    classicVerse: '戊加癸为青龙华盖：门吉招福，门凶多乖，利于隐匿、修养与研学。',
    modernMeaning: '戊癸相合，利于内部整合、技术攻关与低调筹备，不宜过分张扬。',
    category: '十干克应',
  },
  '乙+戊': {
    heavenStem: '乙',
    earthStem: '戊',
    name: '阴害阳门',
    auspice: '平',
    classicVerse: '乙加戊为阴害阳门：利于阴人谋事，利阴害阳，逢吉门尚可，门凶有破。',
    modernMeaning: '利于私下沟通、女性主导或隐蔽渠道推进，公开发力易受体制掣肘。',
    category: '十干克应',
  },
  '乙+乙': {
    heavenStem: '乙',
    earthStem: '乙',
    name: '日奇伏吟',
    auspice: '平',
    classicVerse: '乙加乙为日奇伏吟：不宜见贵求名，只宜安分守己，卧薪尝胆。',
    modernMeaning: '运势平滞，行动迟缓，宜复盘和积蓄实力，不宜贸然扩张。',
    category: '十干克应',
  },
  '乙+丙': {
    heavenStem: '乙',
    earthStem: '丙',
    name: '奇仪顺遂',
    auspice: '大吉',
    classicVerse: '乙加丙为奇仪顺遂：吉星高照，迁官晋职，夫妻和顺，百事可成。',
    modernMeaning: '大吉之兆！团队协作顺畅，贵人提携，极其利于晋升、拓展与合作。',
    category: '三奇贵格',
  },
  '乙+丁': {
    heavenStem: '乙',
    earthStem: '丁',
    name: '奇全相佐',
    auspice: '大吉',
    classicVerse: '乙加丁为奇全相佐：百事亨通，文书即至，词讼有理，升迁有期。',
    modernMeaning: '文书合同、考核晋级、品牌宣传极为顺遂，万事具备东风。',
    category: '三奇贵格',
  },
  '乙+己': {
    heavenStem: '乙',
    earthStem: '己',
    name: '日奇入墓',
    auspice: '凶',
    classicVerse: '乙加己为日奇入墓：门吉尚可，门凶事必乖张，文书暗昧，防小人潜藏。',
    modernMeaning: '自身才华受到压抑，信息不对称严重，需注意合同细节，防止被他人隐瞒真相。',
    category: '门迫入墓',
  },
  '乙+庚': {
    heavenStem: '乙',
    earthStem: '庚',
    name: '日奇被刑',
    auspice: '凶',
    classicVerse: '乙加庚为日奇被刑：争讼难解，夫妻各怀异心，事多阻隔。',
    modernMeaning: '乙庚虽合但暗藏克制，警惕合作方背信弃义或利益分配不均引发纠纷。',
    category: '凶格刑悖',
  },
  '乙+辛': {
    heavenStem: '乙',
    earthStem: '辛',
    name: '青龙逃走',
    auspice: '大凶',
    classicVerse: '乙加辛为青龙逃走：奴仆拐带，六畜皆伤，测婚主女逃男，谋财必失。',
    modernMeaning: '奇门著名凶格！主人员流失、资产缩水、合作解体或主动放弃，宜止损避险。',
    category: '凶格刑悖',
  },
  '乙+壬': {
    heavenStem: '乙',
    earthStem: '壬',
    name: '日奇入地网',
    auspice: '凶',
    classicVerse: '乙加壬为日奇入地网：防奸人谗言，尊卑不睦，身陷是非网罗。',
    modernMeaning: '人际关系错综复杂，谨防卷入多方纷争，切勿轻信口头承诺。',
    category: '凶格刑悖',
  },
  '乙+癸': {
    heavenStem: '乙',
    earthStem: '癸',
    name: '日奇华盖',
    auspice: '平',
    classicVerse: '乙加癸为日奇华盖：只宜退守隐避，求仙访道，不宜主动求名求利。',
    modernMeaning: '宜养精蓄锐、钻研技术与内部整顿，对外拓展收效甚微。',
    category: '十干克应',
  },
  '丙+戊': {
    heavenStem: '丙',
    earthStem: '戊',
    name: '飞鸟跌穴',
    auspice: '大吉',
    classicVerse: '丙加戊为飞鸟跌穴：百事吉利，谋事不求自得，贵人主动相迎。',
    modernMeaning: '奇门顶级吉格！天时地利人和俱备，意想不到的机会主动降临，宜果断抓住。',
    category: '三奇贵格',
  },
  '丙+乙': {
    heavenStem: '丙',
    earthStem: '乙',
    name: '日月并行',
    auspice: '大吉',
    classicVerse: '丙加乙为日月并行：公私皆利，升迁显达，家宅吉庆。',
    modernMeaning: '光明正大之象，利于公开竞争、演讲汇报、项目落地与团队凝聚。',
    category: '三奇贵格',
  },
  '丙+丙': {
    heavenStem: '丙',
    earthStem: '丙',
    name: '月奇悖师',
    auspice: '凶',
    classicVerse: '丙加丙为月奇悖师：文书遗失，火燥生灾，主客相争，乱中出错。',
    modernMeaning: '情绪急躁容易坏事，注意文书遗漏、设备故障或团队争吵，务必冷静从容。',
    category: '凶格刑悖',
  },
  '丙+丁': {
    heavenStem: '丙',
    earthStem: '丁',
    name: '月奇朱雀',
    auspice: '吉',
    classicVerse: '丙加丁为月奇朱雀：贵人提携，文书吉利，常人有喜，功名顺遂。',
    modernMeaning: '利于文教、艺术、传媒、专利申请与对外合作，消息通达。',
    category: '三奇贵格',
  },
  '丙+己': {
    heavenStem: '丙',
    earthStem: '己',
    name: '火入刑悖',
    auspice: '凶',
    classicVerse: '丙加己为火入刑悖：囚人得释，公事逢阻，吉门尚可，凶门招非。',
    modernMeaning: '容易被旧账或琐事纠缠，合规与流程上需格外谨慎。',
    category: '凶格刑悖',
  },
  '丙+庚': {
    heavenStem: '丙',
    earthStem: '庚',
    name: '荧入太白',
    auspice: '大凶',
    classicVerse: '丙加庚为荧入太白：门户破败，盗贼侵夺，凡事逆境，防破大财。',
    modernMeaning: '主客易位，主动进攻反而受挫，严防竞争对手截胡、盗用成果或恶意竞争。',
    category: '凶格刑悖',
  },
  '丙+辛': {
    heavenStem: '丙',
    earthStem: '辛',
    name: '日月相会',
    auspice: '吉',
    classicVerse: '丙加辛为日月相会：谋事成就，和睦融洽，利于合作谈判。',
    modernMeaning: '丙辛化水，利于达成和解、签订合作意向与破冰沟通。',
    category: '三奇得使',
  },
  '丙+壬': {
    heavenStem: '丙',
    earthStem: '壬',
    name: '火入天罗',
    auspice: '凶',
    classicVerse: '丙加壬为火入天罗：水火不相容，为客不利，是非相侵，波折四起。',
    modernMeaning: '意见严重分歧，外力施压巨大，防范突发变故与情绪化决策。',
    category: '凶格刑悖',
  },
  '丙+癸': {
    heavenStem: '丙',
    earthStem: '癸',
    name: '华盖悖师',
    auspice: '凶',
    classicVerse: '丙加癸为华盖悖师：阴阳不调，阴谋私欲，逢吉门尚免灾，逢凶门必殃。',
    modernMeaning: '防暗箱操作受损，遇到模糊不清的条款务必白纸黑字厘清。',
    category: '凶格刑悖',
  },
  '丁+戊': {
    heavenStem: '丁',
    earthStem: '戊',
    name: '青龙得光',
    auspice: '大吉',
    classicVerse: '丁加戊为青龙得光：官职升迁，常人发财，逢吉门百事皆吉。',
    modernMeaning: '才华得到贵人赏识与资本赋能，极其利于融资、立项与升职。',
    category: '三奇贵格',
  },
  '丁+乙': {
    heavenStem: '丁',
    earthStem: '乙',
    name: '玉女伏底',
    auspice: '吉',
    classicVerse: '丁加乙为玉女伏底：人情和美，谋求得遂，利于私下交接与谋策。',
    modernMeaning: '人缘极佳，沟通顺畅，适合私下拜访贵人或深入谈判核心条款。',
    category: '三奇得使',
  },
  '丁+丙': {
    heavenStem: '丁',
    earthStem: '丙',
    name: '星随月转',
    auspice: '吉',
    classicVerse: '丁加丙为星随月转：贵人升迁，常人有喜，不宜急躁，从善如流。',
    modernMeaning: '顺势而为即可获利，多听取团队与行业前辈的建议，切忌独断专行。',
    category: '三奇贵格',
  },
  '丁+丁': {
    heavenStem: '丁',
    earthStem: '丁',
    name: '奇入太阴',
    auspice: '吉',
    classicVerse: '丁加丁为奇入太阴：文书即至，喜事遂心，所求必得。',
    modernMeaning: '消息灵通、文书顺达，适合考试、评审、发榜与喜庆之事。',
    category: '三奇贵格',
  },
  '丁+己': {
    heavenStem: '丁',
    earthStem: '己',
    name: '火入勾陈',
    auspice: '凶',
    classicVerse: '丁加己为火入勾陈：奸私暗害，防阴人中伤，事多变卦。',
    modernMeaning: '提防暗地流言蜚语，注意保护知识产权与商业机密。',
    category: '凶格刑悖',
  },
  '丁+庚': {
    heavenStem: '丁',
    earthStem: '庚',
    name: '太白受制',
    auspice: '平',
    classicVerse: '丁加庚为太白受制：文书阻隔，先凶后吉，事多周折方成。',
    modernMeaning: '过程波折，推进阻力大，但若能坚持原则终有转机。',
    category: '十干克应',
  },
  '丁+辛': {
    heavenStem: '丁',
    earthStem: '辛',
    name: '朱雀入狱',
    auspice: '凶',
    classicVerse: '丁加辛为朱雀入狱：罪人释免，官人失位，文书迟误。',
    modernMeaning: '合同纠纷、考核不及格或言语失误，注意规避公关风险。',
    category: '凶格刑悖',
  },
  '丁+壬': {
    heavenStem: '丁',
    earthStem: '壬',
    name: '星奇得使',
    auspice: '吉',
    classicVerse: '丁加壬为五阴化禽：贵人提携，财帛丰盈，事谋皆顺。',
    modernMeaning: '丁壬化木，利于婚姻结盟、项目签约、商业并购。',
    category: '三奇得使',
  },
  '丁+癸': {
    heavenStem: '丁',
    earthStem: '癸',
    name: '朱雀投江',
    auspice: '大凶',
    classicVerse: '丁加癸为朱雀投江：文书俱失，音信杳无，官非口舌，所谋皆空。',
    modernMeaning: '奇门大凶格！信息中断、合作翻脸、文书失效，重大决策立即暂停。',
    category: '凶格刑悖',
  },
  '庚+戊': {
    heavenStem: '庚',
    earthStem: '戊',
    name: '天乙伏宫',
    auspice: '大凶',
    classicVerse: '庚加戊为天乙伏宫：百事不顺，谋为破败，换主易位，不可轻动。',
    modernMeaning: '不可盲目投资或更换赛道，容易遭遇资金断流或核心资产受损。',
    category: '凶格刑悖',
  },
  '庚+乙': {
    heavenStem: '庚',
    earthStem: '乙',
    name: '太白逢星',
    auspice: '平',
    classicVerse: '庚加乙为太白逢星：退吉进凶，私谋尚可，公干不顺。',
    modernMeaning: '外部拓展受阻，宜退居幕后整顿内部关系与供应链。',
    category: '十干克应',
  },
  '庚+丙': {
    heavenStem: '庚',
    earthStem: '丙',
    name: '太白入荧',
    auspice: '凶',
    classicVerse: '庚加丙为太白入荧：贼人必来，防盗防损，为主吉，为客凶。',
    modernMeaning: '竞争对手主动挑衅，防守反击可占上风，不可主动挑起争端。',
    category: '凶格刑悖',
  },
  '庚+庚': {
    heavenStem: '庚',
    earthStem: '庚',
    name: '太白同宫',
    auspice: '大凶',
    classicVerse: '庚加庚为战格伏吟：官灾横祸，兄弟相残，阻力重重。',
    modernMeaning: '内部矛盾白热化，阻力达到顶点，宜以退为进，化解内耗。',
    category: '凶格刑悖',
  },
  '庚+辛': {
    heavenStem: '庚',
    earthStem: '辛',
    name: '白虎干格',
    auspice: '大凶',
    classicVerse: '庚加辛为白虎干格：远行车折，求财大亏，诸事不顺。',
    modernMeaning: '出行防意外，商务防毁约，重大财务支出务必止步。',
    category: '凶格刑悖',
  },
  '庚+癸': {
    heavenStem: '庚',
    earthStem: '癸',
    name: '大格反覆',
    auspice: '凶',
    classicVerse: '庚加癸为大格冲破：百事阻滞，财散人离，音信不通。',
    modernMeaning: '原有合作框架被打破，人事震荡，需做好危机公关准备。',
    category: '凶格刑悖',
  },
  '辛+乙': {
    heavenStem: '辛',
    earthStem: '乙',
    name: '白虎猖狂',
    auspice: '大凶',
    classicVerse: '辛加乙为白虎猖狂：家败人亡，远行多殃，官司临头，大忌动用。',
    modernMeaning: '奇门大凶格！防突发事故、严厉惩处或重大破耗，宜静不宜动。',
    category: '凶格刑悖',
  },
  '辛+丁': {
    heavenStem: '辛',
    earthStem: '丁',
    name: '狱神得奇',
    auspice: '吉',
    classicVerse: '辛加丁为狱神得奇：经商务本，困境获救，逢凶化吉。',
    modernMeaning: '绝处逢生之象，在最困难时有外部力量出手相助。',
    category: '三奇贵格',
  },
  '壬+戊': {
    heavenStem: '壬',
    earthStem: '戊',
    name: '小蛇化龙',
    auspice: '吉',
    classicVerse: '壬加戊为小蛇化龙：男人显达，女人产厄，谋事得助。',
    modernMeaning: '平台升维、跃迁突破的好时机，把握住可实现阶层或业绩跃迁。',
    category: '三奇贵格',
  },
  '癸+丁': {
    heavenStem: '癸',
    earthStem: '丁',
    name: '螣蛇夭矫',
    auspice: '大凶',
    classicVerse: '癸加丁为螣蛇夭矫：文书官非，火烛惊扰，疾病绵缠，所谋大破。',
    modernMeaning: '奇门大凶格！文书生祸、突发官司或严重阻挠，必须严防死守。',
    category: '凶格刑悖',
  },
  '癸+戊': {
    heavenStem: '癸',
    earthStem: '戊',
    name: '天乙会合',
    auspice: '吉',
    classicVerse: '癸加戊为天乙会合：财喜双美，谋为皆遂，吉门大吉。',
    modernMeaning: '资本与资源完美结合，利于投融资、签约与共赢合作。',
    category: '三奇得使',
  },
};

import type { QimenDeityClassic, QimenDoorClassic, QimenStarClassic } from './types';

/**
 * 奇门遁甲九星《奇门遁甲秘笈大全》释义
 */
export const QIMEN_STAR_CLASSICS: Record<string, QimenStarClassic> = {
  天蓬星: {
    star: '天蓬星',
    originalPalace: '坎一宫',
    wuxing: '水',
    auspice: '凶',
    sourceBook: '奇门遁甲秘笈大全·九星篇',
    verse: '天蓬水星号大凶，行兵远遁喜重重。谋求隐晦宜安分，争斗求财两处空。',
    nature: '大盗水神，聪明胆大、敢于冒险，亦主破财、暗昧与动荡。',
    modernAdvice:
      '利于暗中布局、防守隐匿、远行考察；不利公开争斗与大额投资，谨防资金漏洞与口舌暗箭。',
  },
  天任星: {
    star: '天任星',
    originalPalace: '艮八宫',
    wuxing: '土',
    auspice: '吉',
    sourceBook: '奇门遁甲秘笈大全·九星篇',
    verse: '天任吉宿主生财，祭祀求官百福来。商贾经营多获利，门庭喜庆自天排。',
    nature: '厚重之土，慈祥宽厚、勤勉务实，主百事安定、财富积累。',
    modernAdvice: '大吉星。利于农业、地产、求职、储蓄、修造及长期合作，脚踏实地必有厚报。',
  },
  天冲星: {
    star: '天冲星',
    originalPalace: '震三宫',
    wuxing: '木',
    auspice: '平',
    sourceBook: '奇门遁甲秘笈大全·九星篇',
    verse: '天冲勇猛出征行，求利谋私总不成。唯有开疆辟土利，风雷震荡号威名。',
    nature: '威武雷神，性急果敢、执行力极强，主快速出击与震动。',
    modernAdvice: '利于开拓新市场、紧急公关、打硬仗、诉讼出征；不宜慢工细活、求和或保守蓄势。',
  },
  天辅星: {
    star: '天辅星',
    originalPalace: '巽四宫',
    wuxing: '木',
    auspice: '大吉',
    sourceBook: '奇门遁甲秘笈大全·九星篇',
    verse: '天辅文星号大吉，求官应试夺头名。设帐授徒名利遂，商贾婚娶乐和平。',
    nature: '文曲之星，文雅博学、善于沟通、人缘极好，主教育、文化与贵人。',
    modernAdvice: '奇门文昌第一吉星！利于升学考试、发表学术、文创传媒、签约合作与拜师学艺。',
  },
  天禽星: {
    star: '天禽星',
    originalPalace: '中五宫',
    wuxing: '土',
    auspice: '大吉',
    sourceBook: '奇门遁甲秘笈大全·九星篇',
    verse: '天禽中土尊无上，百事逢之尽吉祥。君子升迁小人利，调和万化福无疆。',
    nature: '中宫贵星，元帅之尊，端庄忠厚、至中至正，百恶不侵。',
    modernAdvice: '至尊吉星。统摄全局，万事皆吉。利于重大决策、政府事务、调解纠纷与权威树立。',
  },
  天心星: {
    star: '天心星',
    originalPalace: '乾六宫',
    wuxing: '金',
    auspice: '大吉',
    sourceBook: '奇门遁甲秘笈大全·九星篇',
    verse: '天心金宿号功曹，求仙炼药遇英豪。经商迁官谋利遂，百事从心乐滔滔。',
    nature: '乾元智星，领导魄力、医道通神、计谋深远，主高层决策与治愈。',
    modernAdvice: '大吉星。利于战略规划、就医看病、求见长辈领导、金融投资与管理体系建立。',
  },
  天柱星: {
    star: '天柱星',
    originalPalace: '兑七宫',
    wuxing: '金',
    auspice: '凶',
    sourceBook: '奇门遁甲秘笈大全·九星篇',
    verse: '天柱肃杀号破败，喜隐守静莫贪求。经商求谋多阻隔，远行防盗起非仇。',
    nature: '兑金肃杀之神，能言善辩、批判挑剔，主口舌是非、破财与质疑。',
    modernAdvice:
      '利于辩论演说、法律诉讼、纪检审计与纠错；不宜经商交易、签订长期合同与大规模投资。',
  },
  天任星_芮: {
    star: '天芮星',
    originalPalace: '坤二宫',
    wuxing: '土',
    auspice: '凶',
    sourceBook: '奇门遁甲秘笈大全·九星篇',
    verse: '天芮授道传玄理，医星疾病最堪防。求官遇此多淹滞，嫁娶遭逢起祸殃。',
    nature: '坤土病星，主问题漏洞、疾病、学生学习、土地与沉滞。',
    modernAdvice:
      '主病灶与缺陷。在占病时代表病情，在测事时代表存在隐藏漏洞；利于求道拜师与农业土地，不宜急进。',
  },
  天英星: {
    star: '天英星',
    originalPalace: '离九宫',
    wuxing: '火',
    auspice: '平',
    sourceBook: '奇门遁甲秘笈大全·九星篇',
    verse: '天英烈火照离明，喜庆交加酒席频。若问功名荣华显，经商借贷莫轻听。',
    nature: '离火之英，热情华丽、名声在外，急性暴烈，主虚荣、文书与名气。',
    modernAdvice:
      '利于品牌宣传、社交聚会、展会发布与文娱活动；不宜借贷求财、防情绪过激与合同虚假。',
  },
};

/**
 * 奇门遁甲八门《奇门遁甲秘笈大全》释义
 */
export const QIMEN_DOOR_CLASSICS: Record<string, QimenDoorClassic> = {
  开门: {
    door: '开门',
    originalPalace: '乾六宫',
    wuxing: '金',
    auspice: '大吉',
    sourceBook: '奇门遁甲秘笈大全·八门篇',
    verse: '开门大吉利求谋，创业求官第一筹。经商嫁娶多顺遂，出行赴任自无忧。',
    modernAdvice: '奇门首吉之门。利于开业启动、求职晋升、拓展新业务、公开合作与诉讼申诉。',
  },
  休门: {
    door: '休门',
    originalPalace: '坎一宫',
    wuxing: '水',
    auspice: '大吉',
    sourceBook: '奇门遁甲秘笈大全·八门篇',
    verse: '休门吉庆乐和平，拜见贵人百事成。求财婚姻皆如意，养生修性享安宁。',
    modernAdvice: '养生与贵人之门。利于休养调理、见贵人、家庭和睦、婚姻嫁娶与寻求资助。',
  },
  生门: {
    door: '生门',
    originalPalace: '艮八宫',
    wuxing: '土',
    auspice: '大吉',
    sourceBook: '奇门遁甲秘笈大全·八门篇',
    verse: '生门生生不息方，求财置业最相当。商贾经营获大利，万事如意福绵长。',
    modernAdvice: '求财第一吉门。利于投资、经商、买卖房产、项目启动与求医治病。',
  },
  伤门: {
    door: '伤门',
    originalPalace: '震三宫',
    wuxing: '木',
    auspice: '凶',
    sourceBook: '奇门遁甲秘笈大全·八门篇',
    verse: '伤门争斗起风波，捕盗索债利事多。经商行船防损伤，婚姻嫁娶起蹉跎。',
    nature: '震木损伤之气，主争执、受伤、索债与竞争。',
    modernAdvice: '利于讨债索赔、捕盗追凶、竞技体育与车辆维修；不宜出行业务、签约合作与医疗手术。',
  },
  杜门: {
    door: '杜门',
    originalPalace: '巽四宫',
    wuxing: '木',
    auspice: '平',
    sourceBook: '奇门遁甲秘笈大全·八门篇',
    verse: '杜门闭塞隐深处，避难藏形最可依。求官求财皆闭塞，修道参玄泄天机。',
    modernAdvice:
      '闭塞隐秘之门。利于保密研发、隐蔽防守、闭关修炼与规避风险；不利通商洽谈与公开扩张。',
  },
  景门: {
    door: '景门',
    originalPalace: '离九宫',
    wuxing: '火',
    auspice: '平',
    sourceBook: '奇门遁甲秘笈大全·八门篇',
    verse: '景门绚烂主虚华，文书宴乐锦上花。献策求名虽显达，防非防盗起惊嗟。',
    modernAdvice:
      '火热文采之门。利于宣传造势、考试选拔、文书合同与广告公关；防口舌虚夸与情绪内耗。',
  },
  死门: {
    door: '死门',
    originalPalace: '坤二宫',
    wuxing: '土',
    auspice: '大凶',
    sourceBook: '奇门遁甲秘笈大全·八门篇',
    verse: '死门阴煞百事愁，唯有吊丧安葬投。求谋百事难成就，静守安分度春秋。',
    modernAdvice:
      '终结与寂灭之门。利于丧葬纪念、破产清算、斩断孽缘与处理陈旧遗留；大忌开业与求医。',
  },
  惊门: {
    door: '惊门',
    originalPalace: '兑七宫',
    wuxing: '金',
    auspice: '凶',
    sourceBook: '奇门遁甲秘笈大全·八门篇',
    verse: '惊门震恐起是非，词讼官司惹祸危。捕贼求名当自守，婚姻商贾两相违。',
    modernAdvice:
      '恐慌与辩论之门。利于法律辩护、侦破质疑与危机演练；不利合同签署、和平洽谈与求财。',
  },
};

/**
 * 奇门遁甲八神释义
 */
export const QIMEN_DEITY_CLASSICS: Record<string, QimenDeityClassic> = {
  值符: {
    deity: '值符',
    wuxing: '土',
    auspice: '大吉',
    sourceBook: '奇门遁甲秘笈大全·八神篇',
    verse: '值符九星之领袖，万恶潜消百福臻。所向之处皆大吉，贵人相助庆无垠。',
    modernAdvice: '八神之首，至尊庇佑。万事遇之均有大贵人提携，格局端正，谋事必成。',
  },
  螣蛇: {
    deity: '螣蛇',
    wuxing: '火',
    auspice: '凶',
    sourceBook: '奇门遁甲秘笈大全·八神篇',
    verse: '螣蛇虚诈并惊疑，怪异梦魂常作祟。口舌缠绵心不定，守正防奸莫自迷。',
    modernAdvice: '主虚惊怪异、反复无常、口舌是非。需防合同诈骗与心理焦虑，以静制动。',
  },
  太阴: {
    deity: '太阴',
    wuxing: '金',
    auspice: '吉',
    sourceBook: '奇门遁甲秘笈大全·八神篇',
    verse: '太阴潜藏护身宁，密谋策划最称情。阴庇贵人多得力，行藏无碍自通亨。',
    modernAdvice: '主隐蔽、阴庇、细致周密。利于幕后策划、保密研发、求助女性贵人与静养。',
  },
  六合: {
    deity: '六合',
    wuxing: '木',
    auspice: '大吉',
    sourceBook: '奇门遁甲秘笈大全·八神篇',
    verse: '六合和合百事欢，婚姻合伙共谋安。买卖交涉皆获利，中介调停化险艰。',
    modernAdvice: '主和合、中介、团队、婚姻。利于商业谈判、居间斡旋、签约联姻与资源撮合。',
  },
  白虎: {
    deity: '白虎',
    wuxing: '金',
    auspice: '大凶',
    sourceBook: '奇门遁甲秘笈大全·八神篇',
    verse: '白虎威严杀气凝，伤残刑狱祸相仍。行兵捕盗虽得力，百事逢之受折摧。',
    modernAdvice: '主血光伤灾、道路阻碍、凶煞威猛。利于执纪执法与竞技攻坚，余事大忌。',
  },
  玄武: {
    deity: '玄武',
    wuxing: '水',
    auspice: '凶',
    sourceBook: '奇门遁甲秘笈大全·八神篇',
    verse: '玄武盗贼并奸谗，暗中损耗计谋繁。小人暗害须防范，破财遗失莫贪残。',
    modernAdvice: '主暗昧、盗贼、遗失、小人与虚假。需严防信息泄露、欺诈骗局与财务破耗。',
  },
  九地: {
    deity: '九地',
    wuxing: '土',
    auspice: '吉',
    sourceBook: '奇门遁甲秘笈大全·八神篇',
    verse: '九地坤元厚德存，养生蓄锐静如林。利于伏匿安宁事，妄动招尤损福深。',
    modernAdvice: '主稳固、迟缓、蓄势、长久。利于防守、长期投资、买房置地，忌急躁冒进。',
  },
  九天: {
    deity: '九天',
    wuxing: '金',
    auspice: '大吉',
    sourceBook: '奇门遁甲秘笈大全·八神篇',
    verse: '九天刚健好扬威，高瞻远瞩展雄飞。乘势直上青云路，广纳名声百事宜。',
    modernAdvice: '主高远、远行、开拓、名气。利于主动出击、长途旅行、跨界扩张与舆论造势。',
  },
};

/**
 * 查询奇门遁甲九星释义
 */
export function getQimenStarClassic(star: string): QimenStarClassic | undefined {
  if (!star) return undefined;
  const clean = star.replace(/星$/, '');
  return (
    QIMEN_STAR_CLASSICS[star] ||
    QIMEN_STAR_CLASSICS[`${clean}星`] ||
    (star === '天芮' ? QIMEN_STAR_CLASSICS['天任星_芮'] : undefined)
  );
}

/**
 * 查询奇门遁甲八门释义
 */
export function getQimenDoorClassic(door: string): QimenDoorClassic | undefined {
  if (!door) return undefined;
  const clean = door.replace(/门$/, '');
  return QIMEN_DOOR_CLASSICS[door] || QIMEN_DOOR_CLASSICS[`${clean}门`];
}

/**
 * 查询奇门遁甲八神释义
 */
export function getQimenDeityClassic(deity: string): QimenDeityClassic | undefined {
  if (!deity) return undefined;
  return QIMEN_DEITY_CLASSICS[deity];
}

/**
 * 宋代《烟波钓叟歌》精义节选
 */
export const QIMEN_YANBO_CLASSICS: Array<{
  title: string;
  verse: string;
  explanation: string;
}> = [
  {
    title: '阴阳顺逆篇',
    verse: '阴阳顺逆妙难穷，二至还乡一九宫。若能了达阴阳理，天地都在一掌中。',
    explanation: '冬至一阳生，顺布六仪逆布三奇；夏至一阴生，逆布六仪顺布三奇。',
  },
  {
    title: '三奇得使篇',
    verse: '三奇得使诚堪使，六甲黄金不可逢。乙逢犬马丙鼠猴，六丁玉女骑龙虎。',
    explanation: '乙丙丁三奇得值使门所催发，谋为大吉，百事称心。',
  },
  {
    title: '九星吉凶篇',
    verse: '蓬任冲辅禽心柱，芮英九星按方布。天辅天禽大吉昌，蓬芮凶危须防虑。',
    explanation: '九星各司其职，辅禽冲任为吉星，逢之谋为有利；蓬芮柱英多凶险，需审慎趋避。',
  },
  {
    title: '八门开闭篇',
    verse: '开休生三吉门逢，死惊伤杜四门凶。更有景门居中局，万事推求理相同。',
    explanation: '开休生三吉门逢吉神吉星无往不利；伤杜景死惊需辨明主客与用神相生相克。',
  },
];

export function getQimenYanboClassic(keyword: string) {
  if (!keyword) return undefined;
  return QIMEN_YANBO_CLASSICS.find((y) => y.title.includes(keyword) || y.verse.includes(keyword));
}

export function getAllQimenYanboClassics() {
  return QIMEN_YANBO_CLASSICS;
}
