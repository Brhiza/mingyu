/**
 * @file 八字全息分析与全量衍生计算器 (Bazi Natal Dossier & Enhanced Calculation)
 * @description 为命录补齐所有能计算的八字数据，包括三垣、五行加权、全量柱间作用、神煞典故、十神流通与大运流年矩阵。
 */

import {
  getShenShaType,
  getTenGod,
  getTenGodForBranch,
  getWuxing,
  type BaziChartResult,
  type Wuxing,
} from '../bazi';
import {
  getBaziDitiansuiAdvice,
  getBaziQiongtongAdvice,
  getBaziZipingPatternAdvice,
} from '../classics';
import {
  EARTHLY_BRANCHES,
  HEAVENLY_STEMS,
  HIDDEN_STEMS,
  NAYIN_MAP,
} from '../bazi/baziMappingsData';
import { getLifeStage } from '../bazi/baziValues';
import { calculateKongWangBranches } from '../bazi/kongWang';
import { tallyWuxing } from '../wuxing';
import { getBaZhaiPalace, type BaZhaiLabel } from '../direction';
import type {
  MingluAnnualYearItem,
  MingluBeginnerGuide,
  MingluFiveElementsSectionData,
  MingluInteractionItem,
  MingluLifeStagesSectionData,
  MingluLuckChronicleSectionData,
  MingluMonthlyData,
  MingluPatternUsefulGodSectionData,
  MingluPillarColumn,
  MingluPillarsSectionData,
  MingluShenShaItem,
  MingluTenGodsSectionData,
} from './types';

const PILLAR_KEYS = ['year', 'month', 'day', 'hour'] as const;
const PILLAR_LABELS = ['年柱', '月柱', '日柱', '时柱'] as const;

// 天干五合
const STEM_COMBOS = [
  {
    pair: ['甲', '己'],
    name: '甲己合化土',
    targetWuxing: '土',
    desc: '中正之合，厚德重信，尊崇礼义，宽和稳重。',
  },
  {
    pair: ['乙', '庚'],
    name: '乙庚合化金',
    targetWuxing: '金',
    desc: '仁义之合，刚柔相济，果敢坚决，重诺守信。',
  },
  {
    pair: ['丙', '辛'],
    name: '丙辛合化水',
    targetWuxing: '水',
    desc: '威制之合，智谋权变，仪表端庄，灵动通达。',
  },
  {
    pair: ['丁', '壬'],
    name: '丁壬合化木',
    targetWuxing: '木',
    desc: '仁寿之合，多情重义，温和慈爱，生机生发。',
  },
  {
    pair: ['戊', '癸'],
    name: '戊癸合化火',
    targetWuxing: '火',
    desc: '无情之合，聪明俊朗，老少相配，热情内敛。',
  },
];

// 天干相冲
const STEM_CHONGS = [
  { pair: ['甲', '庚'], name: '甲庚相冲', desc: '金木交加，多主动荡变动、筋骨关节或事业转折。' },
  { pair: ['乙', '辛'], name: '乙辛相冲', desc: '阴金克阴木，多主门户变迁、情思起伏或神经敏锐。' },
  {
    pair: ['丙', '壬'],
    name: '丙壬相冲',
    desc: '水火相战，多主心肾水火不调、奔波劳碌、声势显露。',
  },
  {
    pair: ['丁', '癸'],
    name: '丁癸相冲',
    desc: '阴火阴水激荡，多主思虑纠结、文书变化或人际波澜。',
  },
];

// 地支三会
const BRANCH_SANHUI = [
  {
    branches: ['寅', '卯', '辰'],
    name: '寅卯辰三会东方木',
    wuxing: '木',
    desc: '东方春令，全盘木气鼎盛，仁义生发，条达昂扬。',
  },
  {
    branches: ['巳', '午', '未'],
    name: '巳午未三会南方火',
    wuxing: '火',
    desc: '南方夏令，全盘火气炽烈，礼仪通明，热情果敢。',
  },
  {
    branches: ['申', '酉', '戌'],
    name: '申酉戌三会西方金',
    wuxing: '金',
    desc: '西方秋令，全盘金气刚肃，义气威严，肃杀决断。',
  },
  {
    branches: ['亥', '子', '丑'],
    name: '亥子丑三会北方水',
    wuxing: '水',
    desc: '北方冬令，全盘水气浩荡，智谋潜沉，汪洋通达。',
  },
];

// 地支三合
const BRANCH_SANHE = [
  {
    branches: ['申', '子', '辰'],
    name: '申子辰三合水局',
    wuxing: '水',
    desc: '润下汇聚，江河归海，智谋通达，顺流而下。',
  },
  {
    branches: ['亥', '卯', '未'],
    name: '亥卯未三合木局',
    wuxing: '木',
    desc: '曲直向上，生机盎然，文华秀出，仁德广被。',
  },
  {
    branches: ['寅', '午', '戌'],
    name: '寅午戌三合火局',
    wuxing: '火',
    desc: '炎上普照，光明磊落，礼敬热诚，事业开拓。',
  },
  {
    branches: ['巳', '酉', '丑'],
    name: '巳酉丑三合金局',
    wuxing: '金',
    desc: '从革刚健，坚韧果决，威严肃穆，成就非凡。',
  },
];

// 地支半合
const BRANCH_BANHE = [
  {
    pair: ['申', '子'],
    name: '申子半合水局（生地半合）',
    wuxing: '水',
    desc: '金水相涵，源头活水，生发有力。',
  },
  {
    pair: ['子', '辰'],
    name: '子辰半合水局（墓地半合）',
    wuxing: '水',
    desc: '汪洋归库，蓄势深沉，财智丰隆。',
  },
  {
    pair: ['亥', '卯'],
    name: '亥卯半合木局（生地半合）',
    wuxing: '木',
    desc: '水木相生，春意盎然，文才华茂。',
  },
  {
    pair: ['卯', '未'],
    name: '卯未半合木局（墓地半合）',
    wuxing: '木',
    desc: '繁花入林，稳健厚实，情意深长。',
  },
  {
    pair: ['寅', '午'],
    name: '寅午半合火局（生地半合）',
    wuxing: '火',
    desc: '木火通明，热诚直爽，贵气彰显。',
  },
  {
    pair: ['午', '戌'],
    name: '午戌半合火局（墓地半合）',
    wuxing: '火',
    desc: '火照库藏，内敛笃定，蓄势待发。',
  },
  {
    pair: ['巳', '酉'],
    name: '巳酉半合金局（生地半合）',
    wuxing: '金',
    desc: '金气长生，坚韧不拔，执行力强。',
  },
  {
    pair: ['酉', '丑'],
    name: '酉丑半合金局（墓地半合）',
    wuxing: '金',
    desc: '湿土生金，金入库藏，厚重沉稳。',
  },
];

// 地支六合
const BRANCH_LIUHE = [
  {
    pair: ['子', '丑'],
    name: '子丑六合化土',
    wuxing: '土',
    desc: '泥水相涵，亲和忠厚，善结善缘。',
  },
  {
    pair: ['寅', '亥'],
    name: '寅亥六合化木',
    wuxing: '木',
    desc: '水生木发，破中有合，生机勃勃。',
  },
  {
    pair: ['卯', '戌'],
    name: '卯戌六合化火',
    wuxing: '火',
    desc: '春入深秋，热情内敛，晚景光明。',
  },
  {
    pair: ['辰', '酉'],
    name: '辰酉六合化金',
    wuxing: '金',
    desc: '湿土生金，相辅相成，贵气相投。',
  },
  {
    pair: ['巳', '申'],
    name: '巳申六合化水',
    wuxing: '水',
    desc: '刑中有合，智勇兼备，权谋机变。',
  },
  {
    pair: ['午', '未'],
    name: '午未六合化火土',
    wuxing: '土',
    desc: '日月同辉，尊贵高洁，温厚明朗。',
  },
];

// 地支六冲
const BRANCH_CHONGS = [
  { pair: ['子', '午'], name: '子午相冲', desc: '水火交战，多主心肾不安、动荡奔波、是非显露。' },
  {
    pair: ['丑', '未'],
    name: '丑未相冲',
    desc: '湿燥相激，多主田宅产业变动、脾胃调理或长辈事宜。',
  },
  { pair: ['寅', '申'], name: '寅申相冲', desc: '金木交加，驿马驰骋，多主道路奔波、出行远游。' },
  { pair: ['卯', '酉'], name: '卯酉相冲', desc: '金木相伤，门户变迁、情思纠葛、喜怒分明。' },
  { pair: ['辰', '戌'], name: '辰戌相冲', desc: '魁罡相激，官非权柄或住所变换，开库之象。' },
  { pair: ['巳', '亥'], name: '巳亥相冲', desc: '水火相激，文书波折或涉远迁移，变易频繁。' },
];

// 地支相刑
const BRANCH_XINGS = [
  {
    group: ['寅', '巳', '申'],
    name: '寅巳申三刑（无恩之刑）',
    desc: '性格刚毅，防恩将仇报或因好心反受牵连，宜重修养信义。',
  },
  {
    group: ['丑', '戌', '未'],
    name: '丑戌未三刑（持势之刑）',
    desc: '竞争张力大，多争进执着，宜防争执官非，贵在谦逊。',
  },
  {
    pair: ['子', '卯'],
    name: '子卯相刑（无礼之刑）',
    desc: '长幼失序，多生嫌隙口舌，宜重礼法尊卑与人际和谐。',
  },
  { self: '辰', name: '辰辰自刑', desc: '土多沉郁，思虑过重心结难解，宜豁达心胸。' },
  { self: '午', name: '午午自刑', desc: '火旺性燥，急于求成容易心烦，宜修心静气。' },
  { self: '酉', name: '酉酉自刑', desc: '金刚自伤，过分追求完美反受其累，宜宽待人事。' },
  { self: '亥', name: '亥亥自刑', desc: '水旺迷茫，多思善感欲望纠结，宜定心立志。' },
];

// 地支相害（穿）
const BRANCH_HARMS = [
  { pair: ['子', '未'], name: '子未相害', desc: '水土相阻，骨肉生隙，事多牵绊。' },
  { pair: ['丑', '午'], name: '丑午相害', desc: '湿燥相激，性情急躁，防暗疾官非。' },
  { pair: ['寅', '巳'], name: '寅巳相害', desc: '恩中有怨，进退两难，合作多磨。' },
  { pair: ['卯', '辰'], name: '卯辰相害', desc: '长幼失和，东木克土，事多掣肘。' },
  { pair: ['申', '亥'], name: '申亥相害', desc: '争嫉破耗，先热后疑，防小人是非。' },
  { pair: ['酉', '戌'], name: '酉戌相害', desc: '嫉妒相伤，多生口舌，文书有碍。' },
];

// 地支相破
const BRANCH_BREAKS = [
  { pair: ['子', '酉'], name: '子酉相破', desc: '金沉水底，做事有头无尾，重始敬终为宜。' },
  { pair: ['卯', '午'], name: '卯午相破', desc: '木火旺极，劳碌心神，耗费心血。' },
  { pair: ['辰', '丑'], name: '辰丑相破', desc: '泥土相杂，破耗不宁，田宅多耗。' },
  { pair: ['未', '戌'], name: '未戌相破', desc: '燥土相凌，刑伤阻滞，重在和顺。' },
  { pair: ['寅', '亥'], name: '寅亥相破', desc: '生中有破，好中有损，吉凶相伴。' },
  { pair: ['巳', '申'], name: '巳申相破', desc: '合中带破，吉凶参半，谋定后动。' },
];

// 地支暗合
const BRANCH_ANHE = [
  {
    pair: ['寅', '丑'],
    name: '寅丑暗合',
    desc: '寅中戊丙甲与丑中己癸辛暗中相合，暗藏贵人相助或隐秘机缘。',
  },
  {
    pair: ['午', '亥'],
    name: '午亥暗合',
    desc: '午中丁己与亥中壬甲暗合，多主暗生情愫、隐密财源或暗度陈仓。',
  },
  { pair: ['卯', '申'], name: '卯申暗合', desc: '卯中乙木与申中庚金暗合，仁义内敛，暗地协作。' },
  { pair: ['子', '巳'], name: '子巳暗合', desc: '子中癸水与巳中戊土暗合，水火交融，暗生默契。' },
];

// 神煞典故库
const SHENSHA_DETAILS_MAP: Record<
  string,
  { type: '吉' | '凶' | '中性'; origin: string; desc: string; significance: string }
> = {
  天乙贵人: {
    type: '吉',
    origin: '《李虚中命书》：“天乙者，乃天上之神，在紫微垣、阊阖门外，与太乙并列。”',
    desc: '百神之首，遇难呈祥，逢凶化吉，一生少灾少病，常得长辈贵人提携。',
    significance: '主清高尊贵、事业机遇多、关键时刻逢凶化吉。',
  },
  太极贵人: {
    type: '吉',
    origin: '《渊海子平》：“太极者，太初也，始也。造化始终相保，故名太极。”',
    desc: '主为人端庄正直、好学深思、喜玄学哲学、终有成就。',
    significance: '主学问通达、行事有始有终、福寿双全。',
  },
  天德贵人: {
    type: '吉',
    origin: '《三命通会》：“天德者，三合之德也，天之所祐，诸煞避之。”',
    desc: '天降福德，主一生安康、少受刑伤、品行宽厚、名望清吉。',
    significance: '消灾免祸，遇凶化解，提升名誉与人缘。',
  },
  月德贵人: {
    type: '吉',
    origin: '《三命通会》：“月德者，三合之德也。与天德同，主仁慈福寿。”',
    desc: '月令德秀，主心地善良、福泽深厚、人见人爱、福禄悠远。',
    significance: '化解凶煞，提升贵人运与家庭福气。',
  },
  文昌贵人: {
    type: '吉',
    origin: '《星平会海》：“文昌者，食神之禄也。主聪明秀拔，利于科考文章。”',
    desc: '文采斐然，才思敏捷，学业优异，擅长思考与文字创作。',
    significance: '主考学顺遂、文化功名、专业领域脱颖而出。',
  },
  学堂: {
    type: '吉',
    origin: '《三命通会》：“学堂者，长生之位也，如人入官学，有学问名誉。”',
    desc: '主文思泉涌、好学博闻、利于学术研究与名校深造。',
    significance: '主学力深厚，多为书香世家或学者导师之才。',
  },
  词馆: {
    type: '吉',
    origin: '《三命通会》：“词馆者，临官之所也。词章翰墨，灿然成文。”',
    desc: '文辞华美，口才出众，著作等身，名扬四方。',
    significance: '利于写作、演讲、教育、宣传与文化事业。',
  },
  国印贵人: {
    type: '吉',
    origin: '《三命通会》：“国印者，禄前九位也。掌印秉权，守信重节。”',
    desc: '主为人诚实稳重、掌权秉印、严谨守则、受人重托。',
    significance: '主职权升迁、管理才能、企事业单位掌章印。',
  },
  将星: {
    type: '吉',
    origin: '《三命通会》：“将星者，三合之旺位也。常欲吉星相助，贵气威武。”',
    desc: '领导才能，威严决断，临危不惧，能统领团队或掌权柄。',
    significance: '主管理领导力、军警政界或企业高管之象。',
  },
  金舆: {
    type: '吉',
    origin: '《三命通会》：“金舆者，黄金之车也，君子居之有车马之富。”',
    desc: '主出入豪轩、享福康宁、得配偶家力相助、财源丰厚。',
    significance: '主物质富足、出行平安、配偶贤惠富贵。',
  },
  华盖: {
    type: '吉',
    origin: '《渊海子平》：“华盖者，喻如宝盖，天星之名也。性喜幽静，好佛道艺术。”',
    desc: '才华超群，清高孤傲，喜好哲学、心理、艺术、宗教，具玄学灵性。',
    significance: '主才华与艺术灵感，但略显孤高出世。',
  },
  驿马: {
    type: '中性',
    origin: '《三命通会》：“驿马者，少阳之气，主动不主静。吉神乘之多升迁，凶煞乘之多奔波。”',
    desc: '主迁变远行、出国进修、经商走动、事业开拓。',
    significance: '逢吉神则步步高升，逢冲刑则劳碌奔波。',
  },
  红鸾: {
    type: '吉',
    origin: '《三命通会》：“红鸾星动，喜气盈门。主婚姻喜庆、人缘和美。”',
    desc: '主容貌秀美、桃花正缘、人缘上佳、婚恋喜庆。',
    significance: '主正缘桃花、异性贵人相助、情感幸福。',
  },
  天喜: {
    type: '吉',
    origin: '《三命通会》：“天喜为红鸾对宫，主开朗吉祥、添丁进禄。”',
    desc: '主性格乐观、喜笑颜开、逢凶化吉、喜事连连。',
    significance: '主身心愉悦、家庭和顺、带来吉祥福运。',
  },
  天赦: {
    type: '吉',
    origin: '《渊海子平》：“天赦者，天帝赦免众罪之日也。命中逢之，诸凶化解。”',
    desc: '至德吉神，遇险消灾，免除刑罚官非，绝处逢生。',
    significance: '主官非不侵、遇险逢生、晚景福寿绵长。',
  },
  禄神: {
    type: '吉',
    origin: '《三命通会》：“禄，爵禄也。当得势而享福，丰衣足食之本。”',
    desc: '福禄丰厚，自立自强，衣食无忧，事业财运根基扎实。',
    significance: '主身强任财官、薪禄优厚、一生食禄无亏。',
  },
  金神: {
    type: '吉',
    origin: '《相心赋》：“金神入火乡，富贵天下响。”',
    desc: '性情坚毅威严，聪慧果敢，行火运大发富贵。',
    significance: '主威武不屈、敢作敢当、后劲十足。',
  },
  魁罡: {
    type: '吉',
    origin: '《三命通会》：“魁罡四位日最昌，叠叠相逢大异常。聪明果断，掌生杀之权。”',
    desc: '性格刚烈，才思敏捷，见义勇为，临事果决，具非凡魄力。',
    significance: '主掌权得势、领袖风范，忌逢财官冲破。',
  },
  羊刃: {
    type: '凶',
    origin: '《滴天髓》：“羊刃者，极旺之所，司掌刑伤与威武。”',
    desc: '刚烈果决，胆识过人。有制化则成大将威权，无制化则性躁易伤。',
    significance: '配七杀为“羊刃驾杀”大贵，无制防冲动与损伤。',
  },
  咸池: {
    type: '中性',
    origin: '《三命通会》：“咸池者，沐浴之乡，主风雅多情，艺术才华。”',
    desc: '容貌清秀，多情多思，人缘极佳，具审美与表演艺术天分。',
    significance: '主艺术审美与异性人缘，须重克己修身。',
  },
  童子煞: {
    type: '中性',
    origin: '传统命理术数传抄：“童子清修，仙缘夙慧，清奇俊秀。”',
    desc: '容貌俊秀，聪颖灵动，体质略显敏感，常带玄学道缘或艺术天分。',
    significance: '多主悟性极高、心思纯粹，宜重身心养护与修身。',
  },
  阴差阳错: {
    type: '中性',
    origin: '《三命通会》：“阴差阳错日，多主姻缘迟缓或波折，先难后顺。”',
    desc: '情路波折，沟通需多包容理解，宜晚婚或同舟共济。',
    significance: '提醒在婚恋交往中多体谅沟通，化解误会。',
  },
  孤辰: {
    type: '凶',
    origin: '《三命通会》：“男怕孤辰，女怕寡宿。主独立清冷，个性自立。”',
    desc: '性格独立清高，喜静不喜喧闹，耐得住寂寞，宜科研艺术。',
    significance: '主内心独具天地，独立创业或专注专研可成大器。',
  },
  寡宿: {
    type: '凶',
    origin: '《三命通会》：“寡宿独守，清净自修。”',
    desc: '孤芳自赏，思想深邃，重精神追求，少逐世俗名利。',
    significance: '主精神世界丰富，利于学术、技术精深钻研。',
  },
  亡神: {
    type: '凶',
    origin: '《三命通会》：“亡神者，吉则深谋远虑，凶则争讼是非。”',
    desc: '城府深密，智谋过人，敏锐洞察。吉则谋略超群，凶则思虑过度。',
    significance: '主深谋远虑与策略策划能力。',
  },
  劫煞: {
    type: '凶',
    origin: '《三命通会》：“劫煞主执拗，吉则威严刚决，凶则破耗阻隔。”',
    desc: '刚毅果决，行动迅猛。吉则果断成就，凶则防突发波折。',
    significance: '主魄力担当，宜谋定而后动。',
  },
  灾煞: {
    type: '凶',
    origin: '《三命通会》：“灾煞者，冲太岁之位也，常防外来阻滞。”',
    desc: '警惕外在风险，宜防口舌争端与行车安全，小心谨慎为上。',
    significance: '提醒居安思危、防微杜渐。',
  },
  元辰: {
    type: '凶',
    origin: '《三命通会》：“元辰者，大耗也。形貌清癯，喜怒不形于色。”',
    desc: '思维深沉，善于观察，不拘俗礼，防口舌误解。',
    significance: '宜多表达沟通，广结善缘。',
  },
  天罗地网: {
    type: '凶',
    origin: '《渊海子平》：“辰戌为天罗，丑未为地网。主滞留羁绊，宜修心破局。”',
    desc: '行事常遇瓶颈羁绊，须耐住性子，沉潜蓄力，突破方见光明。',
    significance: '主磨炼心志、突破瓶颈后格局更广。',
  },
  十恶大败: {
    type: '凶',
    origin: '《三命通会》：“六甲旬中，无禄之日为大败。”',
    desc: '开销慷慨，散财聚人，金钱观念豁达，须重理性规划储蓄。',
    significance: '提醒加强财务预算与稳健投资。',
  },
};

/** 计算增强版四柱全息信息（含三垣、月令、命卦） */
export function buildEnhancedPillarsSection(baziResult: BaziChartResult): MingluPillarsSectionData {
  const { pillars, dayMaster } = baziResult;
  const dayMasterGan = dayMaster.gan;

  const dayOwnerLabel =
    baziResult.gender === 'male' ? '元男' : baziResult.gender === 'female' ? '元女' : '日主';

  const columns: MingluPillarColumn[] = PILLAR_KEYS.map((key, index) => {
    const p = pillars[key];
    const rawHiddenStems = HIDDEN_STEMS[p.zhi] || [];
    const roles: Array<'本气' | '中气' | '余气'> = ['本气', '中气', '余气'];

    const hiddenStems = rawHiddenStems.map((stem, i) => ({
      stem,
      wuxing: (getWuxing(stem) || '木') as Wuxing,
      tenGod: getTenGod(stem, dayMasterGan),
      role: roles[i] || '余气',
    }));

    return {
      key,
      label: PILLAR_LABELS[index],
      caption: key === 'day' ? '日元日主' : key === 'month' ? '提纲令星' : undefined,
      gan: p.gan,
      zhi: p.zhi,
      ganWuxing: (getWuxing(p.gan) || '木') as Wuxing,
      zhiWuxing: (getWuxing(p.zhi) || '木') as Wuxing,
      ganTenGod:
        key === 'day' ? dayOwnerLabel : baziResult.tenGods[key] || getTenGod(p.gan, dayMasterGan),
      zhiTenGod: getTenGodForBranch(p.zhi, dayMasterGan),
      hiddenStems,
      nayin: baziResult.nayin[key] || NAYIN_MAP[p.ganZhi] || '—',
      ziZuo: baziResult.ziZuo[key] || getLifeStage(p.gan, p.zhi),
      lifeStage: baziResult.lifeStages[key] || getLifeStage(dayMasterGan, p.zhi),
      kongWang: baziResult.kongWang[key] || calculateKongWangBranches(p.gan, p.zhi),
      shensha:
        key === 'year'
          ? [...(baziResult.shensha.global ?? []), ...(baziResult.shensha[key] || [])]
          : baziResult.shensha[key] || [],
      isDayMaster: key === 'day',
    };
  });

  // 三垣推算
  const taiYuan = baziResult.taiYuan || '—';
  const taiXi = baziResult.taiXi || '—';
  const mingGong = baziResult.mingGong || '—';
  const shenGong = baziResult.shenGong || '—';

  const sanYuan = {
    taiYuan: {
      ganZhi: taiYuan,
      nayin: NAYIN_MAP[taiYuan] || '—',
      desc: '月柱顺推，受气成胎之所，主人生命源流与先天根底。',
    },
    taiXi: {
      ganZhi: taiXi,
      nayin: NAYIN_MAP[taiXi] || '—',
      desc: '日柱干合支合所取，为命主精神寄托与元气归聚。',
    },
    mingGong: {
      ganZhi: mingGong,
      nayin: NAYIN_MAP[mingGong] || '—',
      desc: '立命安身之本，主一生大纲、志向气魄与命格层次。',
    },
    shenGong: {
      ganZhi: shenGong,
      nayin: NAYIN_MAP[shenGong] || '—',
      desc: '后天着力之所，主后天修为、事业归宿与中晚年运势。',
    },
  };

  const monthCommander = baziResult.monthCommander || '—';
  const seasonInfo = {
    jieqiName: baziResult.seasonInfo.currentJieqi || '节气交接',
    currentSeason: baziResult.seasonInfo.currentSeason || '当令',
    monthCommander,
    monthCommanderDesc: `月令由【${monthCommander}】司权用事，为命局五行气数之枢机提纲。`,
  };

  let mingGuaInfo = undefined;
  if (baziResult.mingGua) {
    const mg = baziResult.mingGua;
    // 逐卦取公共八宅大游年表，避免按东四/西四分组固定方位而丢失具体命卦
    const palaces = getBaZhaiPalace(mg.gua);
    const pickDirection = (label: BaZhaiLabel): string => {
      const palace = palaces.find((item) => item.label === label);
      if (!palace) {
        throw new Error(`命卦${mg.gua}大游年缺少${label}宫`);
      }
      return palace.direction;
    };
    mingGuaInfo = {
      name: `${mg.gua}卦 (${mg.number}宫)`,
      number: mg.number,
      eastWest: mg.eastWest,
      wuxing: mg.element,
      directions: [
        {
          type: '吉' as const,
          name: '生气方',
          direction: pickDirection('生气'),
          desc: '大吉，事业开拓与精力充沛',
        },
        {
          type: '吉' as const,
          name: '延年方',
          direction: pickDirection('延年'),
          desc: '中吉，健康长寿与人缘和谐',
        },
        {
          type: '凶' as const,
          name: '绝命方',
          direction: pickDirection('绝命'),
          desc: '大凶，宜避开大门与床头',
        },
      ],
    };
  }

  return {
    columns,
    sanYuan,
    seasonInfo,
    mingGuaInfo,
  };
}

/** 计算五行能量加权分布与日主旺衰得分 */
export function buildEnhancedFiveElementsSection(
  baziResult: BaziChartResult,
): MingluFiveElementsSectionData {
  const { pillars, dayMaster } = baziResult;
  const dayMasterWuxing = dayMaster.element;

  // 统计八字所有天干、地支、藏干五行打分
  const items: string[] = [
    pillars.year.gan,
    pillars.year.zhi,
    pillars.month.gan,
    pillars.month.zhi,
    pillars.day.gan,
    pillars.day.zhi,
    pillars.hour.gan,
    pillars.hour.zhi,
  ];

  const rawCounts = tallyWuxing(items, { weightHidden: true });
  const wuxingList: Wuxing[] = ['木', '火', '土', '金', '水'];

  // 月令司令加权 1.2
  const commanderStem = baziResult.monthCommander ? baziResult.monthCommander.slice(0, 1) : '';
  const commanderWuxing = commanderStem ? getWuxing(commanderStem) : null;
  if (commanderWuxing && rawCounts[commanderWuxing]) {
    rawCounts[commanderWuxing] += 1.2;
  }

  // 总分在司令加权之后统计，保证五行比例的分母与分子同一口径
  const totalScore = Object.values(rawCounts).reduce((a, b) => a + b, 0) || 1;

  const maxScore = Math.max(...Object.values(rawCounts));
  const minScore = Math.min(...Object.values(rawCounts));

  const elements = wuxingList.map((wx) => {
    const score = Number((rawCounts[wx] || 0).toFixed(1));
    const percentage = Number(((score / totalScore) * 100).toFixed(1));
    const seasonStatus = baziResult.wuxingSeasonStatus?.[wx] || '平';
    const isDominant = score === maxScore;
    const isWeakest = score === minScore && score > 0;
    const isMissing = score === 0;

    return {
      wuxing: wx,
      count: baziResult.wuxingStrength.present.filter((w) => w === wx).length,
      score,
      percentage,
      seasonStatus,
      isDominant,
      isWeakest,
      isMissing,
    };
  });

  // 同类 vs 异类分数计算
  let sameKindScore = 0;
  let diffKindScore = 0;

  elements.forEach((el) => {
    if (el.wuxing === dayMasterWuxing) {
      sameKindScore += el.score;
    } else if (
      (dayMasterWuxing === '木' && el.wuxing === '水') ||
      (dayMasterWuxing === '火' && el.wuxing === '木') ||
      (dayMasterWuxing === '土' && el.wuxing === '火') ||
      (dayMasterWuxing === '金' && el.wuxing === '土') ||
      (dayMasterWuxing === '水' && el.wuxing === '金')
    ) {
      sameKindScore += el.score;
    } else {
      diffKindScore += el.score;
    }
  });

  const sumKind = sameKindScore + diffKindScore || 1;
  const sameRatio = Number(((sameKindScore / sumKind) * 100).toFixed(1));
  const diffRatio = Number(((diffKindScore / sumKind) * 100).toFixed(1));

  const dayMasterDetails = baziResult.analysis.dayMasterStrength.details;

  // 中医五行脏腑健康与调摄分析
  const tcmMap: Record<Wuxing, { organPair: string; over: string; under: string; diet: string }> = {
    木: {
      organPair: '肝胆 · 筋腱 · 目力 · 神经',
      over: '木盛化火，易情绪急躁、目赤头晕、筋络紧绷或睡眠偏浅。',
      under: '木气不足，易视力疲劳、筋骨酸软、指甲干脆、气血郁结。',
      diet: '宜食枸杞、菊花茶、菠菜、绿豆、黑豆，常做拉伸养肝疏经。',
    },
    火: {
      organPair: '心小肠 · 血液循环 · 舌面 · 神志',
      over: '心火偏亢，易心悸失眠、口舌生疮、烦躁多梦、血压起伏。',
      under: '心阳不足，易手足畏寒、神疲乏力、气血推动迟缓、面色少华。',
      diet: '宜食红枣、桂圆、茯苓、莲子心、百合，保持平和作息与舒缓运动。',
    },
    土: {
      organPair: '脾胃 · 消化吸收 · 肌肉四肢 · 唇口',
      over: '土重湿滞，易腹胀胃滞、四肢困重、口黏苔厚、代谢放缓。',
      under: '脾胃虚弱，易消化吸收不佳、食欲不振、中气不足、形体易疲。',
      diet: '宜食山药、小米、芡实、陈皮、南瓜，三餐定时温养脾胃。',
    },
    金: {
      organPair: '肺大肠 · 呼吸系统 · 鼻咽 · 皮毛',
      over: '燥金太旺，易咽干口燥、皮肤干涩、干咳少痰、大便偏干。',
      under: '肺气虚亏，易卫表不固、怕风易汗、抵抗力减弱、易患鼻咽呼吸敏感。',
      diet: '宜食百合、银耳、雪梨、杏仁、白萝卜，滋阴润肺防秋燥。',
    },
    水: {
      organPair: '肾膀胱 · 骨骼骨髓 · 生殖泌尿 · 耳部',
      over: '水湿过甚，易畏寒水肿、腰重膝软、体内阳气受遏。',
      under: '肾精不足，易腰酸腿软、耳鸣神疲、发丝干枯、精力持久度不足。',
      diet: '宜食黑芝麻、黑米、黑豆、桑葚、核桃，戒熬夜以固摄先天肾水。',
    },
  };

  const healthTcmAdvice = elements.map((el) => {
    const tcm = tcmMap[el.wuxing];
    // 阈值采用五行占比口径：占比达到 30% 视为过旺，不超过 10% 视为虚弱
    const isOver = el.percentage >= 30;
    const isUnder = el.percentage <= 10 || el.isMissing;
    const status = isOver
      ? ('过旺耗伤' as const)
      : isUnder
        ? ('虚弱不足' as const)
        : ('平衡中和' as const);
    const manifestations = isOver
      ? tcm.over
      : isUnder
        ? tcm.under
        : '五行生克平顺，脏腑功能相对协调稳健。';

    return {
      wuxing: el.wuxing,
      organPair: tcm.organPair,
      status,
      manifestations,
      wellnessDiet: tcm.diet,
    };
  });

  return {
    elements,
    dayMasterStrength: {
      status: baziResult.analysis.dayMasterStrength.status,
      score: Number(sameKindScore.toFixed(1)),
      sameKindScore: Number(sameKindScore.toFixed(1)),
      diffKindScore: Number(diffKindScore.toFixed(1)),
      sameRatio,
      diffRatio,
      dimensions: {
        timely: dayMasterDetails.timely,
        seasonalEffect: dayMasterDetails.seasonalEffect,
        grounded: dayMasterDetails.hasRoot,
        supported: dayMasterDetails.hasSupport,
        assisted: dayMasterDetails.hasSupport,
        hasRoot: dayMasterDetails.hasRoot,
        hasStrongRoot: dayMasterDetails.hasStrongRoot,
      },
      ruleBasis: dayMasterDetails.ruleBasis,
      judgmentSummary: `日主${dayMaster.gan}(${dayMasterWuxing})在${pillars.month.zhi}月${dayMasterDetails.seasonalEffect}，同类力量占比${sameRatio}%，异类力量占比${diffRatio}%，综合评定为【${baziResult.analysis.dayMasterStrength.status}】。`,
    },
    healthTcmAdvice,
  };
}

/** 提取格局成败、喜忌用神与古籍评注 */
export function buildEnhancedPatternUsefulGodSection(
  baziResult: BaziChartResult,
): MingluPatternUsefulGodSectionData {
  const dayMasterGan = baziResult.dayMaster.gan;
  const monthBranchZhi = baziResult.pillars.month.zhi;

  const qiongtongRaw = getBaziQiongtongAdvice(dayMasterGan, monthBranchZhi);
  const ditiansuiRaw = getBaziDitiansuiAdvice(dayMasterGan);
  const zipingRaw = getBaziZipingPatternAdvice(baziResult.analysis.mingGe.pattern);

  const useful = baziResult.analysis.usefulGod;

  return {
    pattern: {
      name: baziResult.analysis.mingGe.pattern,
      isSpecial: baziResult.analysis.mingGe.isSpecial,
      type: baziResult.analysis.mingGe.isSpecial ? '特殊格局/专旺从格' : '正五行月令取格',
      basis:
        baziResult.analysis.mingGe.basis || `由月令${baziResult.pillars.month.zhi}藏干透出立格`,
      formationAnalysis: baziResult.analysis.mingGe.isSpecial
        ? '全局气势专一或极度顺应某类五行，取顺势化裁为用。'
        : '依子平正理以月令提纲为枢机，兼看透干会局以定格局清浊高下。',
    },
    usefulGods: {
      primaryUseful: useful.primaryUseful || useful.useful || '待定',
      primaryAvoid: useful.primaryAvoid || useful.avoid || '待定',
      favorable: useful.favorable || [],
      unfavorable: useful.unfavorable || [],
      usefulGodCategory: useful.primaryReason || '扶抑取中',
      reasoning: useful.strategyTrace?.join('；') || '综合日主旺衰与全局五行流通评定。',
      strategyTrace: useful.strategyTrace || [],
    },
    qiongtongAdvice: qiongtongRaw
      ? {
          title: `${qiongtongRaw.dayMaster}木生于${qiongtongRaw.monthBranch}月`,
          source: '《穷通宝鉴》十干四季调候',
          summary: qiongtongRaw.seasonSummary,
          quotes: [qiongtongRaw.classicVerse],
        }
      : undefined,
    ditiansuiAdvice: ditiansuiRaw
      ? {
          title: `${ditiansuiRaw.stem}（${ditiansuiRaw.wuxing}）`,
          source: ditiansuiRaw.sourceBook || '《滴天髓》干支论性',
          summary: ditiansuiRaw.modernAdvice,
          quotes: [ditiansuiRaw.verse],
        }
      : undefined,
    zipingAdvice: zipingRaw
      ? {
          title: zipingRaw.pattern,
          source: zipingRaw.sourceBook || '《子平真诠》格局精微',
          summary: zipingRaw.modernAdvice,
          quotes: [zipingRaw.verse, zipingRaw.rule].filter((q): q is string => Boolean(q)),
        }
      : undefined,
  };
}

/** 挖掘全量柱间作用网络（合冲刑害破暗合伏吟反吟） */
export function buildEnhancedInteractions(baziResult: BaziChartResult): MingluInteractionItem[] {
  const items: MingluInteractionItem[] = [];
  const { pillars } = baziResult;
  const pillarEntries = [
    { label: '年柱', gan: pillars.year.gan, zhi: pillars.year.zhi },
    { label: '月柱', gan: pillars.month.gan, zhi: pillars.month.zhi },
    { label: '日柱', gan: pillars.day.gan, zhi: pillars.day.zhi },
    { label: '时柱', gan: pillars.hour.gan, zhi: pillars.hour.zhi },
  ];

  // 1. 天干五合
  for (let i = 0; i < pillarEntries.length; i++) {
    for (let j = i + 1; j < pillarEntries.length; j++) {
      const g1 = pillarEntries[i].gan;
      const g2 = pillarEntries[j].gan;
      const match = STEM_COMBOS.find(
        (c) => (c.pair[0] === g1 && c.pair[1] === g2) || (c.pair[0] === g2 && c.pair[1] === g1),
      );
      if (match) {
        items.push({
          id: `stem-he-${i}-${j}`,
          category: '天干五合',
          name: match.name,
          involvedPillars: [pillarEntries[i].label, pillarEntries[j].label],
          involvedStemsBranches: [g1, g2],
          transformElement: match.targetWuxing,
          nature: '吉',
          description: match.desc,
          influence: `${pillarEntries[i].label}${g1}与${pillarEntries[j].label}${g2}相合，增进两柱情义；此处为结构之合，成化与否须依日干参与、紧贴与化神透干另行判定。`,
          anchorId: `interaction-stem-he-${i}-${j}`,
        });
      }
    }
  }

  // 2. 天干相冲
  for (let i = 0; i < pillarEntries.length; i++) {
    for (let j = i + 1; j < pillarEntries.length; j++) {
      const g1 = pillarEntries[i].gan;
      const g2 = pillarEntries[j].gan;
      const match = STEM_CHONGS.find(
        (c) => (c.pair[0] === g1 && c.pair[1] === g2) || (c.pair[0] === g2 && c.pair[1] === g1),
      );
      if (match) {
        items.push({
          id: `stem-chong-${i}-${j}`,
          category: '天干相冲',
          name: match.name,
          involvedPillars: [pillarEntries[i].label, pillarEntries[j].label],
          involvedStemsBranches: [g1, g2],
          nature: '凶',
          description: match.desc,
          influence: `${pillarEntries[i].label}${g1}与${pillarEntries[j].label}${g2}相冲，天干气机互相激荡。`,
          anchorId: `interaction-stem-chong-${i}-${j}`,
        });
      }
    }
  }

  const allZhis = pillarEntries.map((p) => ({ label: p.label, zhi: p.zhi }));

  // 3. 地支三会局
  for (const hui of BRANCH_SANHUI) {
    const matched = hui.branches.every((b) => allZhis.some((z) => z.zhi === b));
    if (matched) {
      const involved = allZhis.filter((z) => hui.branches.includes(z.zhi)).map((z) => z.label);
      items.push({
        id: `branch-sanhui-${hui.name}`,
        category: '地支三会',
        name: hui.name,
        involvedPillars: Array.from(new Set(involved)),
        involvedStemsBranches: hui.branches,
        transformElement: hui.wuxing,
        nature: '吉',
        description: hui.desc,
        influence: `原局聚齐${hui.name}，东方/南方/西方/北方一气浑然。`,
        anchorId: `interaction-sanhui-${hui.wuxing}`,
      });
    }
  }

  // 4. 地支三合局
  for (const sanhe of BRANCH_SANHE) {
    const matched = sanhe.branches.every((b) => allZhis.some((z) => z.zhi === b));
    if (matched) {
      const involved = allZhis.filter((z) => sanhe.branches.includes(z.zhi)).map((z) => z.label);
      items.push({
        id: `branch-sanhe-${sanhe.name}`,
        category: '地支三合',
        name: sanhe.name,
        involvedPillars: Array.from(new Set(involved)),
        involvedStemsBranches: sanhe.branches,
        transformElement: sanhe.wuxing,
        nature: '吉',
        description: sanhe.desc,
        influence: `地支汇成${sanhe.name}，${sanhe.wuxing}气汇聚；此处为结构之聚，成化与否须依月令与透干另行判定。`,
        anchorId: `interaction-sanhe-${sanhe.wuxing}`,
      });
    }
  }

  // 5. 地支半合局
  for (const banhe of BRANCH_BANHE) {
    const z1 = banhe.pair[0];
    const z2 = banhe.pair[1];
    const hasZ1 = allZhis.some((z) => z.zhi === z1);
    const hasZ2 = allZhis.some((z) => z.zhi === z2);
    if (hasZ1 && hasZ2) {
      const involved = allZhis.filter((z) => z.zhi === z1 || z.zhi === z2).map((z) => z.label);
      items.push({
        id: `branch-banhe-${z1}-${z2}`,
        category: '地支半合',
        name: banhe.name,
        involvedPillars: Array.from(new Set(involved)),
        involvedStemsBranches: banhe.pair,
        transformElement: banhe.wuxing,
        nature: '吉',
        description: banhe.desc,
        influence: `拱出${banhe.wuxing}局气势，强化相应十神之生生不息。`,
        anchorId: `interaction-banhe-${z1}-${z2}`,
      });
    }
  }

  // 6. 地支六合
  for (let i = 0; i < allZhis.length; i++) {
    for (let j = i + 1; j < allZhis.length; j++) {
      const z1 = allZhis[i].zhi;
      const z2 = allZhis[j].zhi;
      const match = BRANCH_LIUHE.find(
        (c) => (c.pair[0] === z1 && c.pair[1] === z2) || (c.pair[0] === z2 && c.pair[1] === z1),
      );
      if (match) {
        items.push({
          id: `branch-liuhe-${i}-${j}`,
          category: '地支六合',
          name: match.name,
          involvedPillars: [allZhis[i].label, allZhis[j].label],
          involvedStemsBranches: [z1, z2],
          transformElement: match.wuxing,
          nature: '吉',
          description: match.desc,
          influence: `${allZhis[i].label}${z1}与${allZhis[j].label}${z2}六合有情，增进安定稳固；能否解冲化气，须依月令旺衰另行判定。`,
          anchorId: `interaction-liuhe-${i}-${j}`,
        });
      }
    }
  }

  // 7. 地支六冲
  for (let i = 0; i < allZhis.length; i++) {
    for (let j = i + 1; j < allZhis.length; j++) {
      const z1 = allZhis[i].zhi;
      const z2 = allZhis[j].zhi;
      const match = BRANCH_CHONGS.find(
        (c) => (c.pair[0] === z1 && c.pair[1] === z2) || (c.pair[0] === z2 && c.pair[1] === z1),
      );
      if (match) {
        items.push({
          id: `branch-chong-${i}-${j}`,
          category: '地支六冲',
          name: match.name,
          involvedPillars: [allZhis[i].label, allZhis[j].label],
          involvedStemsBranches: [z1, z2],
          nature: '凶',
          description: match.desc,
          influence: `${allZhis[i].label}${z1}与${allZhis[j].label}${z2}六冲对峙，主对应宫位所代表的人事物产生变动、奔波或挑战。`,
          anchorId: `interaction-chong-${i}-${j}`,
        });
      }
    }
  }

  // 8. 地支相刑
  for (const xing of BRANCH_XINGS) {
    if (xing.group) {
      const matched = xing.group.every((b) => allZhis.some((z) => z.zhi === b));
      if (matched) {
        const involved = allZhis.filter((z) => xing.group!.includes(z.zhi)).map((z) => z.label);
        items.push({
          id: `branch-xing-${xing.name}`,
          category: '地支相刑',
          name: xing.name,
          involvedPillars: Array.from(new Set(involved)),
          involvedStemsBranches: xing.group,
          nature: '凶',
          description: xing.desc,
          influence: `原局聚齐${xing.name}，须注意人际相处之宽厚包容与规则守正。`,
          anchorId: `interaction-xing-${xing.name}`,
        });
      }
    } else if (xing.self) {
      const count = allZhis.filter((z) => z.zhi === xing.self).length;
      if (count >= 2) {
        const involved = allZhis.filter((z) => z.zhi === xing.self).map((z) => z.label);
        items.push({
          id: `branch-zixing-${xing.name}`,
          category: '地支相刑',
          name: xing.name,
          involvedPillars: involved,
          involvedStemsBranches: [xing.self, xing.self],
          nature: '凶',
          description: xing.desc,
          influence: `地支见两处${xing.self}成自刑，多主内心思虑纠结，宜宽怀自省。`,
          anchorId: `interaction-zixing-${xing.self}`,
        });
      }
    } else if (xing.pair) {
      const has1 = allZhis.some((z) => z.zhi === xing.pair![0]);
      const has2 = allZhis.some((z) => z.zhi === xing.pair![1]);
      if (has1 && has2) {
        const involved = allZhis.filter((z) => xing.pair!.includes(z.zhi)).map((z) => z.label);
        items.push({
          id: `branch-xing-${xing.name}`,
          category: '地支相刑',
          name: xing.name,
          involvedPillars: Array.from(new Set(involved)),
          involvedStemsBranches: xing.pair,
          nature: '凶',
          description: xing.desc,
          influence: `见${xing.name}，提示注重言行礼仪与规矩秩序。`,
          anchorId: `interaction-xing-${xing.pair[0]}-${xing.pair[1]}`,
        });
      }
    }
  }

  // 9. 地支相害
  for (let i = 0; i < allZhis.length; i++) {
    for (let j = i + 1; j < allZhis.length; j++) {
      const z1 = allZhis[i].zhi;
      const z2 = allZhis[j].zhi;
      const match = BRANCH_HARMS.find(
        (c) => (c.pair[0] === z1 && c.pair[1] === z2) || (c.pair[0] === z2 && c.pair[1] === z1),
      );
      if (match) {
        items.push({
          id: `branch-harm-${i}-${j}`,
          category: '地支相害',
          name: match.name,
          involvedPillars: [allZhis[i].label, allZhis[j].label],
          involvedStemsBranches: [z1, z2],
          nature: '凶',
          description: match.desc,
          influence: `${allZhis[i].label}${z1}与${allZhis[j].label}${z2}相穿害，事多阻碍或人际掣肘。`,
          anchorId: `interaction-harm-${i}-${j}`,
        });
      }
    }
  }

  // 10. 地支相破
  for (let i = 0; i < allZhis.length; i++) {
    for (let j = i + 1; j < allZhis.length; j++) {
      const z1 = allZhis[i].zhi;
      const z2 = allZhis[j].zhi;
      const match = BRANCH_BREAKS.find(
        (c) => (c.pair[0] === z1 && c.pair[1] === z2) || (c.pair[0] === z2 && c.pair[1] === z1),
      );
      if (match) {
        items.push({
          id: `branch-break-${i}-${j}`,
          category: '地支相破',
          name: match.name,
          involvedPillars: [allZhis[i].label, allZhis[j].label],
          involvedStemsBranches: [z1, z2],
          nature: '中性',
          description: match.desc,
          influence: `${allZhis[i].label}${z1}与${allZhis[j].label}${z2}相破，提示行事善始善终。`,
          anchorId: `interaction-break-${i}-${j}`,
        });
      }
    }
  }

  // 11. 地支暗合
  for (let i = 0; i < allZhis.length; i++) {
    for (let j = i + 1; j < allZhis.length; j++) {
      const z1 = allZhis[i].zhi;
      const z2 = allZhis[j].zhi;
      const match = BRANCH_ANHE.find(
        (c) => (c.pair[0] === z1 && c.pair[1] === z2) || (c.pair[0] === z2 && c.pair[1] === z1),
      );
      if (match) {
        items.push({
          id: `branch-anhe-${i}-${j}`,
          category: '地支暗合',
          name: match.name,
          involvedPillars: [allZhis[i].label, allZhis[j].label],
          involvedStemsBranches: [z1, z2],
          nature: '吉',
          description: match.desc,
          influence: `${allZhis[i].label}${z1}与${allZhis[j].label}${z2}暗中相合，常有意外隐密之支持机缘。`,
          anchorId: `interaction-anhe-${i}-${j}`,
        });
      }
    }
  }

  // 12. 柱间伏吟
  for (let i = 0; i < pillarEntries.length; i++) {
    for (let j = i + 1; j < pillarEntries.length; j++) {
      const p1 = pillarEntries[i];
      const p2 = pillarEntries[j];
      if (p1.gan === p2.gan && p1.zhi === p2.zhi) {
        items.push({
          id: `fuxin-${i}-${j}`,
          category: '柱间伏吟',
          name: `${p1.label}${p2.label}伏吟 (${p1.gan}${p1.zhi})`,
          involvedPillars: [p1.label, p2.label],
          involvedStemsBranches: [`${p1.gan}${p1.zhi}`],
          nature: '中性',
          description:
            '两柱干支完全相同为伏吟。古云：伏吟伏吟，泪水涔涔。主思虑反复或同类之事重现。',
          influence: `${p1.label}与${p2.label}干支相同，加强该柱五行之力量，亦主情绪细腻反复。`,
          anchorId: `interaction-fuxin-${i}-${j}`,
        });
      }
    }
  }

  return items;
}

/** 整理全息神煞谱系与典故考据 */
export function buildEnhancedShenShaSection(baziResult: BaziChartResult): MingluShenShaItem[] {
  const items: MingluShenShaItem[] = [];
  const rawShensha = baziResult.shensha;
  const rawAnalysis = baziResult.shenShaAnalysis;

  const pillarKeys = ['year', 'month', 'day', 'hour'] as const;
  const pillarLabels = ['年柱', '月柱', '日柱', '时柱'];

  // 收集并去重所有神煞
  const shenshaMap = new Map<string, { pillars: Set<string>; tenGodCombos: Set<string> }>();

  // 全局神煞
  if (rawShensha.global) {
    rawShensha.global.forEach((name) => {
      const cleanName = name === '天罗地网' ? '天罗地网' : name;
      if (!shenshaMap.has(cleanName)) {
        shenshaMap.set(cleanName, { pillars: new Set(['全局']), tenGodCombos: new Set() });
      } else {
        shenshaMap.get(cleanName)!.pillars.add('全局');
      }
    });
  }

  // 四柱神煞
  pillarKeys.forEach((key, index) => {
    const list = rawShensha[key] || [];
    const analysisList = rawAnalysis?.[key] || [];
    list.forEach((name) => {
      const cleanName = name === '天罗地网' ? '天罗地网' : name;
      // 十神配合解释按条目开头归属对应神煞，避免整柱解释被复制到每个神煞卡片
      const ownAnalysis = analysisList.filter((a) => a.startsWith(`${cleanName}逢`));
      if (!shenshaMap.has(cleanName)) {
        shenshaMap.set(cleanName, {
          pillars: new Set([pillarLabels[index]]),
          tenGodCombos: new Set(ownAnalysis),
        });
      } else {
        shenshaMap.get(cleanName)!.pillars.add(pillarLabels[index]);
        ownAnalysis.forEach((a) => shenshaMap.get(cleanName)!.tenGodCombos.add(a));
      }
    });
  });

  // 组装神煞详细卡片
  shenshaMap.forEach((info, name) => {
    const detail = SHENSHA_DETAILS_MAP[name] || {
      type: getShenShaType(name === '天罗地网' ? '天罗' : name),
      origin: '《三命通会》与《渊海子平》诸篇所载吉凶神煞。',
      desc: '传统经典吉凶神煞，主命局所受特殊能量磁场之感应。',
      significance: '依所在柱位与喜忌神配合参看。',
    };

    items.push({
      id: `shensha-${name}`,
      name,
      type: detail.type,
      pillars: Array.from(info.pillars),
      foundRuleBasis: '查四柱干支与日干月令而得',
      traditionalDescription: detail.origin + ' ' + detail.desc,
      significance: detail.significance,
      tenGodCombo: Array.from(info.tenGodCombos).join('；') || undefined,
      anchorId: `shensha-${name}`,
    });
  });

  return items;
}

/** 整理十神心性透藏与生克流通分析 */
export function buildEnhancedTenGodsSection(baziResult: BaziChartResult): MingluTenGodsSectionData {
  const { pillars, dayMaster } = baziResult;
  const dayMasterGan = dayMaster.gan;

  const allGods = ['正官', '七杀', '正印', '偏印', '正财', '偏财', '食神', '伤官', '比肩', '劫财'];
  const pillarNames = ['年柱', '月柱', '日柱', '时柱'];

  const godsList = allGods.map((god) => {
    const involvedPillars: string[] = [];
    let isExposed = false;
    let isHidden = false;
    let count = 0;

    PILLAR_KEYS.forEach((key, index) => {
      const ganGod = baziResult.tenGods[key] || getTenGod(pillars[key].gan, dayMasterGan);
      if (ganGod === god && key !== 'day') {
        isExposed = true;
        involvedPillars.push(`${pillarNames[index]}天干`);
        count += 1;
      }
      const hidden = HIDDEN_STEMS[pillars[key].zhi] || [];
      hidden.forEach((stem) => {
        if (getTenGod(stem, dayMasterGan) === god) {
          isHidden = true;
          involvedPillars.push(`${pillarNames[index]}地支藏干(${stem})`);
          count += 1;
        }
      });
    });

    return {
      tenGod: god,
      count,
      isExposed,
      isHidden,
      pillars: Array.from(new Set(involvedPillars)),
      psychology: `${god}心性：代表内在思维驱动力与行事风格。`,
      careerSymbol: '在事业中象征相关资源与发展路径。',
      wealthSymbol: '在财富中体现求财模式与管理格局。',
      relationshipSymbol: '在人际六亲中对应相应伦理关系。',
    };
  });

  const channels = [
    { from: '比劫', to: '食伤', flowType: '相生', desc: '自我能量转化为才华创意与表达行动。' },
    { from: '食伤', to: '财星', flowType: '相生', desc: '才华与技能转化为物质财富与商业价值。' },
    { from: '财星', to: '官杀', flowType: '相生', desc: '资本与资源转化为社会地位与管理权力。' },
    { from: '官杀', to: '印星', flowType: '相生', desc: '权力与威望转化为学术文化与庇护名誉。' },
    { from: '印星', to: '日主比劫', flowType: '相生', desc: '文化知识与长辈庇护滋养自身成长。' },
  ];

  const housesSixKin = [
    {
      pillar: 'year',
      pillarLabel: '年柱 (祖上/父母/早年)',
      ageRange: '1 - 16 岁',
      sixKinSignificance: '代表祖辈家风、父母庇荫与早年生活环境。',
      environmentSignificance: '外部宏观环境、早期根基与社会大背景。',
      actualTenGods: [
        baziResult.tenGods.year,
        getTenGodForBranch(pillars.year.zhi, dayMasterGan),
      ].filter(Boolean),
    },
    {
      pillar: 'month',
      pillarLabel: '月柱 (父母/兄弟/青年/提纲)',
      ageRange: '17 - 32 岁',
      sixKinSignificance: '代表父母手足、同侪人脉与青年学业事业开端。',
      environmentSignificance: '职场平台、核心机遇与人际核心圈。',
      actualTenGods: [
        baziResult.tenGods.month,
        getTenGodForBranch(pillars.month.zhi, dayMasterGan),
      ].filter(Boolean),
    },
    {
      pillar: 'day',
      pillarLabel: '日柱 (自身/配偶/中年)',
      ageRange: '33 - 48 岁',
      sixKinSignificance: '日干为命主自身，日支为配偶宫，代表夫妻关系与家庭核心。',
      environmentSignificance: '中年立业安家、婚姻家庭与自我价值实现。',
      actualTenGods: ['日元自身', getTenGodForBranch(pillars.day.zhi, dayMasterGan)].filter(
        Boolean,
      ),
    },
    {
      pillar: 'hour',
      pillarLabel: '时柱 (子女/晚年/归宿)',
      ageRange: '49 岁以后',
      sixKinSignificance: '代表子女晚辈、下属团队与晚年福禄归宿。',
      environmentSignificance: '事业终极成就、晚年安康与精神传承。',
      actualTenGods: [
        baziResult.tenGods.hour,
        getTenGodForBranch(pillars.hour.zhi, dayMasterGan),
      ].filter(Boolean),
    },
  ];

  const dominantGods = godsList
    .filter((g) => g.count > 0)
    .sort((a, b) => b.count - a.count)
    .map((g) => g.tenGod);

  return {
    godsList,
    dominantGods,
    flowAnalysis: {
      channels,
      summary: '五行十神生克循环流转，五气相通则命局清奇顺畅。',
    },
    housesSixKin,
  };
}

/** 生成十二长生全息对照表与四柱自坐长生 */
export function buildEnhancedLifeStagesSection(
  baziResult: BaziChartResult,
): MingluLifeStagesSectionData {
  const { pillars, dayMaster } = baziResult;
  const dayMasterGan = dayMaster.gan;

  const stems = HEAVENLY_STEMS;
  const branches = EARTHLY_BRANCHES;

  const tableMatrix = stems.map((stem) => {
    const stages: Record<string, string> = {};
    branches.forEach((branch) => {
      stages[branch] = getLifeStage(stem, branch);
    });
    return {
      stem,
      wuxing: (getWuxing(stem) || '木') as Wuxing,
      stages,
    };
  });

  const natalStages = PILLAR_KEYS.map((key, index) => {
    const stem = pillars[key].gan;
    const branch = pillars[key].zhi;
    const dayMasterStage = getLifeStage(dayMasterGan, branch);
    const ziZuoStage = getLifeStage(stem, branch);

    return {
      pillar: key,
      pillarLabel: PILLAR_LABELS[index],
      stem,
      branch,
      dayMasterStage,
      dayMasterStageDesc: `日主${dayMasterGan}行至${branch}为【${dayMasterStage}】运势`,
      ziZuoStage,
      ziZuoStageDesc: `天干${stem}自坐${branch}为【${ziZuoStage}】之位`,
    };
  });

  return {
    tableMatrix,
    natalStages,
  };
}

const MONTH_BRANCHES = [
  '寅',
  '卯',
  '辰',
  '巳',
  '午',
  '未',
  '申',
  '酉',
  '戌',
  '亥',
  '子',
  '丑',
] as const;

const MONTH_NAMES = [
  '正月 (孟春)',
  '二月 (仲春)',
  '三月 (季春)',
  '四月 (孟夏)',
  '五月 (仲夏)',
  '六月 (季夏)',
  '七月 (孟秋)',
  '八月 (仲秋)',
  '九月 (季秋)',
  '十月 (孟冬)',
  '冬月 (仲冬)',
  '腊月 (季冬)',
];

const SOLAR_TERMS = [
  '立春 · 雨水',
  '惊蛰 · 春分',
  '清明 · 谷雨',
  '立夏 · 小满',
  '芒种 · 夏至',
  '小暑 · 大暑',
  '立秋 · 处暑',
  '白露 · 秋分',
  '寒露 · 霜降',
  '立冬 · 小雪',
  '大雪 · 冬至',
  '小寒 · 大寒',
];

const MONTH_COMMANDERS = [
  '戊丙甲 (甲木主权)',
  '甲乙 (乙木专权)',
  '乙癸戊 (戊土当令)',
  '戊庚丙 (丙火司令)',
  '丙己丁 (丁火司权)',
  '丁乙己 (己土主政)',
  '戊己壬庚 (庚金司令)',
  '庚辛 (辛金专旺)',
  '辛丁戊 (戊土权盛)',
  '戊甲壬 (壬水司令)',
  '壬癸 (癸水专权)',
  '癸辛己 (己土司权)',
];

function isHeavenlyStem(val: string): val is (typeof HEAVENLY_STEMS)[number] {
  return (HEAVENLY_STEMS as readonly string[]).includes(val);
}

function isEarthlyBranch(val: string): val is (typeof EARTHLY_BRANCHES)[number] {
  return (EARTHLY_BRANCHES as readonly string[]).includes(val);
}

/** 判定两字是否构成合/冲等二元关系：须分属组内两个不同成员，同字不成合冲 */
function formsPairRelation(
  pairs: Array<{ pair: readonly string[] }>,
  a: string,
  b: string,
): boolean {
  if (!a || !b || a === b) return false;
  return pairs.some((c) => c.pair.includes(a) && c.pair.includes(b));
}

// 五虎遁正月起法
function getFirstMonthStem(yearStem: string): string {
  if (yearStem === '甲' || yearStem === '己') return '丙';
  if (yearStem === '乙' || yearStem === '庚') return '戊';
  if (yearStem === '丙' || yearStem === '辛') return '庚';
  if (yearStem === '丁' || yearStem === '壬') return '壬';
  return '甲';
}

function calculateYearlyMonths(yearGanZhi: string, dayMasterGan: string): MingluMonthlyData[] {
  const yGan = yearGanZhi.slice(0, 1);
  const firstStem = getFirstMonthStem(yGan);
  const startStemIndex = HEAVENLY_STEMS.indexOf(firstStem as (typeof HEAVENLY_STEMS)[number]);

  return MONTH_BRANCHES.map((branch, idx) => {
    const stem = HEAVENLY_STEMS[(startStemIndex + idx) % 10]!;
    const gz = `${stem}${branch}`;
    return {
      monthIndex: idx + 1,
      monthName: MONTH_NAMES[idx]!,
      solarTerm: SOLAR_TERMS[idx]!,
      ganZhi: gz,
      ganTenGod: getTenGod(stem, dayMasterGan),
      zhiTenGod: getTenGodForBranch(branch, dayMasterGan),
      nayin: NAYIN_MAP[gz] || '—',
      commander: MONTH_COMMANDERS[idx]!,
    };
  });
}

function detectSpecialEvents(
  baziResult: BaziChartResult,
  luckGanZhi: string,
  yearGanZhi: string,
): {
  specialEvents: string[];
  natalInteractions: string[];
  luckInteractions: string[];
  yearTheme: string;
} {
  const specialEvents: string[] = [];
  const natalInteractions: string[] = [];
  const luckInteractions: string[] = [];

  const yGan = yearGanZhi.slice(0, 1);
  const yZhi = yearGanZhi.slice(1, 2);
  const lGan = luckGanZhi.slice(0, 1);
  const lZhi = luckGanZhi.slice(1, 2);
  const { pillars, dayMaster } = baziResult;
  const dayMasterGan = dayMaster.gan;
  const yTenGod = isHeavenlyStem(yGan) ? getTenGod(yGan, dayMasterGan) : '—';

  // 1. 岁运并临
  if (yearGanZhi === luckGanZhi) {
    specialEvents.push(
      '【岁运并临】：流年干支与大运干支完全一致，五行能量高度汇聚，为人生关键转折与蜕变契机。',
    );
  }

  // 2. 岁运天合地合
  const isLuckStemHe = formsPairRelation(STEM_COMBOS, yGan, lGan);
  const isLuckBranchHe = formsPairRelation(BRANCH_LIUHE, yZhi, lZhi);
  if (isLuckStemHe && isLuckBranchHe) {
    specialEvents.push(
      '【岁运天地合】：流年与大运天干相合、地支相合，岁运有情，主贵人引路、协同发力、诸事和顺。',
    );
  }

  // 3. 岁运天克地冲
  const isLuckStemChong = formsPairRelation(STEM_CHONGS, yGan, lGan);
  const isLuckBranchChong = formsPairRelation(BRANCH_CHONGS, yZhi, lZhi);
  if (isLuckStemChong && isLuckBranchChong) {
    specialEvents.push(
      '【岁运天克地冲】：流年与大运天干相克、地支六冲，激荡震荡，主外部环境刷新、跨界开拓或奔波历练。',
    );
  }

  // 4. 岁命日柱天地合
  const isDayStemHe = formsPairRelation(STEM_COMBOS, yGan, pillars.day.gan);
  const isDayBranchHe = formsPairRelation(BRANCH_LIUHE, yZhi, pillars.day.zhi);
  if (isDayStemHe && isDayBranchHe) {
    specialEvents.push(
      '【岁命天地合】：流年与日柱干合支合，主情意深浓、良缘相聚、重要合作与生活喜庆。',
    );
  }

  // 5. 冲日支（配偶宫动）
  if (formsPairRelation(BRANCH_CHONGS, yZhi, pillars.day.zhi)) {
    specialEvents.push(
      `【太岁冲日支】：流年${yZhi}与日支${pillars.day.zhi}相冲，主家庭生活环境变迁、居所修葺或出行，宜多沟通互谅。`,
    );
    natalInteractions.push(`流年地支${yZhi}冲动日支${pillars.day.zhi}`);
  }

  // 6. 冲月令（冲提纲）
  if (formsPairRelation(BRANCH_CHONGS, yZhi, pillars.month.zhi)) {
    specialEvents.push(
      `【太岁冲提纲】：流年${yZhi}与月令提纲${pillars.month.zhi}相冲，主事业赛道拓展、岗位转型、出外开拓新空间。`,
    );
    natalInteractions.push(`流年地支${yZhi}冲动月令${pillars.month.zhi}`);
  }

  // 7. 伤官见官
  const hasZhengGuan =
    Object.values(baziResult.tenGods).includes('正官') ||
    (isHeavenlyStem(lGan) && getTenGod(lGan, dayMasterGan) === '正官');
  if (yTenGod === '伤官' && hasZhengGuan) {
    specialEvents.push(
      '【伤官见官】：流年伤官透出与原局/大运官星相见，主突破常规思维、创新攻坚，宜遵规守信、防口舌是非。',
    );
  }

  // 8. 枭神夺食
  const hasShiShen =
    Object.values(baziResult.tenGods).includes('食神') ||
    (isHeavenlyStem(lGan) && getTenGod(lGan, dayMasterGan) === '食神');
  if (yTenGod === '偏印' && hasShiShen) {
    specialEvents.push(
      '【枭神夺食】：流年偏印与食神交汇，主深层思虑沉淀，宜调控压力、保障充沛睡眠与精神休养。',
    );
  }

  // 9. 常态感应记录
  luckInteractions.push(`流年${yearGanZhi}受大运${luckGanZhi}统摄`);
  natalInteractions.push(`流年天干${yGan}（${yTenGod}）主事`);

  const yearTheme =
    specialEvents.length > 0
      ? specialEvents[0]!.replace(/^[^【]*【/, '').replace(/】.*$/, '') + ' · 顺势而为'
      : `岁行${yearGanZhi}（${yTenGod}）· 笃行致远`;

  return { specialEvents, natalInteractions, luckInteractions, yearTheme };
}

function getLuckThemeAndAdvice(
  startAge: number,
  tenGod: string,
  zhiTenGod: string,
  ganZhi: string,
): { lifeTheme: string; careerAdvice: string; healthAdvice: string } {
  let lifeTheme: string;
  let careerAdvice: string;
  let healthAdvice: string;

  if (startAge < 20) {
    lifeTheme = `学业启智与品格奠基期（${ganZhi} · 逢${tenGod}运）`;
    careerAdvice = '重在博闻强识、打牢知识与技术功底，广结良师益友。';
    healthAdvice = '注重身心均衡发育、规律作息，培养良好运动习惯。';
  } else if (startAge < 35) {
    lifeTheme = `事业开拓与立业奋进期（${ganZhi} · 逢${tenGod}运）`;
    careerAdvice = `天干${tenGod}显露，宜积极拓展核心竞争力、提升专业话语权，稳步建立社会信誉与资源壁垒。`;
    healthAdvice = '注意劳逸结合，防颈椎腰肌紧绷，保持充沛作息节律。';
  } else if (startAge < 50) {
    lifeTheme = `事业中流砥柱与财富丰隆期（${ganZhi} · 逢${tenGod}运）`;
    careerAdvice = `干支坐${tenGod}/${zhiTenGod}，利于统筹大局、资源整合与团队带领，善用长远战略眼光布局。`;
    healthAdvice = '重在养护心脾与代谢平衡，多做慢跑、太极等舒缓调和身心运动。';
  } else if (startAge < 65) {
    lifeTheme = `经验沉淀与传承守护期（${ganZhi} · 逢${tenGod}运）`;
    careerAdvice = '重在稳健守成、传承提携后进、统御全局，注重风险控制与资产稳健。';
    healthAdvice = '注重心脑血管调养与温补脾肾，保持豁达心境与规律生活。';
  } else {
    lifeTheme = `德高望重与颐养天年期（${ganZhi} · 逢${tenGod}运）`;
    careerAdvice = '重在修心养性、享受天伦、传家育德、安闲自适。';
    healthAdvice = '顺应四时节气，早睡早起，适度散步，怡情养性。';
  }

  return { lifeTheme, careerAdvice, healthAdvice };
}

/** 整理大运流年流月全息编年大表 */
export function buildEnhancedLuckChronicleSection(
  baziResult: BaziChartResult,
): MingluLuckChronicleSectionData {
  const { luckInfo, dayMaster } = baziResult;
  const dayMasterGan = dayMaster.gan;

  const cycles = luckInfo.cycles.map((cycle, cIndex) => {
    const sourceYears = cycle.resolvedYears || cycle.years || [];
    const cleanGanZhi = (cycle.ganZhi || '').replace(
      /[^甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥]/g,
      '',
    );
    const gan = cleanGanZhi.slice(0, 1);
    const zhi = cleanGanZhi.slice(1, 2);
    const isGanValid = isHeavenlyStem(gan);
    const isZhiValid = isEarthlyBranch(zhi);
    const isXiaoyun = Boolean(cycle.isXiaoyun) || !isGanValid || !isZhiValid;

    const luckTenGod = isGanValid ? getTenGod(gan, dayMasterGan) : '—';
    const luckZhiTenGod = isZhiValid ? getTenGodForBranch(zhi, dayMasterGan) : '—';
    const luckStage = isZhiValid ? getLifeStage(dayMasterGan, zhi) : '—';

    const { lifeTheme, careerAdvice, healthAdvice } = getLuckThemeAndAdvice(
      cycle.age,
      luckTenGod,
      luckZhiTenGod,
      cycle.ganZhi,
    );

    const annualYears: MingluAnnualYearItem[] = sourceYears.map((y) => {
      const cleanYearGZ = (y.ganZhi || '').replace(
        /[^甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥]/g,
        '',
      );
      const yGan = cleanYearGZ.slice(0, 1);
      const yZhi = cleanYearGZ.slice(1, 2);
      const isYGanValid = isHeavenlyStem(yGan);
      const isYZhiValid = isEarthlyBranch(yZhi);

      const months = calculateYearlyMonths(y.ganZhi, dayMasterGan);
      // 童限条目无干支，不参与岁运合冲判定
      const { specialEvents, natalInteractions, luckInteractions, yearTheme } = isXiaoyun
        ? {
            specialEvents: [] as string[],
            natalInteractions: [] as string[],
            luckInteractions: [] as string[],
            yearTheme: `岁行${y.ganZhi} · 童限流年`,
          }
        : detectSpecialEvents(baziResult, cycle.ganZhi, y.ganZhi);

      return {
        year: y.year,
        ganZhi: y.ganZhi,
        age: y.age,
        tenGod: y.tenGod || (isYGanValid ? getTenGod(yGan, dayMasterGan) : '—'),
        zhiTenGod: y.tenGodZhi || (isYZhiValid ? getTenGodForBranch(yZhi, dayMasterGan) : '—'),
        nayin: NAYIN_MAP[y.ganZhi] || '—',
        taiSuiShensha: isYZhiValid ? [`太岁值${yZhi}`, `本命${y.ganZhi}`] : [],
        interactionWithNatal: natalInteractions,
        interactionWithLuck: luckInteractions,
        specialEvents,
        yearTheme,
        months,
      };
    });

    // 依据真实起止时间推算跨度，避免把童限统一按十年标注
    const startSolarYear = cycle.startSolarTime?.year;
    const endSolarYear = cycle.endSolarTime?.year;
    const spanYears =
      startSolarYear !== undefined && endSolarYear !== undefined
        ? Math.max(1, endSolarYear - startSolarYear)
        : 10;

    return {
      cycleIndex: cIndex + 1,
      entryType: isXiaoyun ? ('小运' as const) : ('大运' as const),
      isXiaoyun,
      startAge: cycle.age,
      endAge: cycle.age + spanYears - 1,
      startYear: cycle.year,
      endYear: cycle.year + spanYears - 1,
      ganZhi: cycle.ganZhi,
      tenGod: luckTenGod,
      zhiTenGod: luckZhiTenGod,
      nayin: NAYIN_MAP[cycle.ganZhi] || '—',
      lifeStage: luckStage,
      lifeStageDesc: isZhiValid
        ? `日主${dayMasterGan}行至大运${zhi}临【${luckStage}】之运`
        : '童限期，尚未交入大运',
      interactionWithNatal: isXiaoyun
        ? ['童限期统领起运前岁月，流年备查']
        : [`大运${cycle.ganZhi}主事十年，统领岁干流变`],
      lifeTheme,
      careerAdvice,
      healthAdvice,
      annualYears,
    };
  });

  const yearGan = baziResult.pillars.year.gan;
  const isYangYear = ['甲', '丙', '戊', '庚', '壬'].includes(yearGan);
  const isMale = baziResult.gender === 'male';
  const isForward = (isYangYear && isMale) || (!isYangYear && !isMale);

  // 起运岁数取第一步正式大运，而非排在首位的童限条目
  const firstDayun = luckInfo.cycles.find((cycle) => !cycle.isXiaoyun);

  return {
    startAge: firstDayun?.age ?? luckInfo.cycles[0]?.age ?? 1,
    startYear: firstDayun?.year ?? luckInfo.cycles[0]?.year ?? baziResult.solarDate.year,
    handoverInfo: luckInfo.handoverInfo || luckInfo.startInfo || '交运时间请参看节气',
    direction: isForward ? '顺行' : '逆行',
    cycles,
  };
}

/** 提取小白白话入门与生活化意象指南 */
export function buildBeginnerGuide(baziResult: BaziChartResult): MingluBeginnerGuide {
  const dayMasterGan = baziResult.dayMaster.gan;
  const strengthStatus = baziResult.analysis.dayMasterStrength.status;
  const patternName = baziResult.analysis.mingGe.pattern;
  const primaryUseful = baziResult.analysis.usefulGod.primaryUseful || '印比帮身';

  const GAN_ARCHETYPES: Record<
    string,
    { archetype: string; nature: string; talents: string[]; advice: string }
  > = {
    甲: {
      archetype: '参天乔木 · 顶天立地栋梁之材',
      nature: '如森林参天大木，直爽仁慈，不屈不挠，极具开拓进取精神与担当骨气。',
      talents: ['战略统筹与方向把控', '敢为人先的开拓领导力', '重视信诺与团队保护欲'],
      advice: '多发挥主心骨与带头作用，同时注意刚柔相济，善于接纳他人意见。',
    },
    乙: {
      archetype: '藤萝秀木 · 柔韧借势灵动之华',
      nature: '如幽兰藤萝、春日繁花，柔韧变通，善于在复杂多变的环境中借势生发。',
      talents: ['人际协调与资源整合', '敏锐审美与艺术灵性', '逆境中的极强韧性与适应力'],
      advice: '多借力优质平台与贵人同行，善用巧劲，避免独自硬碰硬。',
    },
    丙: {
      archetype: '普照烈阳 · 光明磊落领袖之光',
      nature: '如夏日骄阳，热情大度，光明磊落，能给予周围人无限温暖、能量与方向感。',
      talents: ['强烈的感染力与公众影响力', '快速决策与全局把控', '大方坦荡的人格魅力'],
      advice: '热情之余注重细节把控与长久沉淀，避免急于求成或单次消耗过大。',
    },
    丁: {
      archetype: '万家灯火 · 洞察精微智慧之烛',
      nature: '如夜空烛火、星汉微光，细腻温厚，思维深邃，极具奉献精神与启发他人之灵光。',
      talents: ['深层洞察与专注钻研', '善于抚慰人心与赋能团队', '独特细腻的洞见与创意灵感'],
      advice: '专注自身擅长领域深耕，保持充沛内心能量，防过度思虑耗神。',
    },
    戊: {
      archetype: '巍峨高山 · 厚德载物坚实大地',
      nature: '如昆仑厚土、崇山峻岭，沉稳厚重，重信守诺，能承载重任与长期托付。',
      talents: ['沉稳从容的定海神针气质', '卓越的抗压与守护能力', '值得信赖的长期信用资本'],
      advice: '保持包容胸怀的同时保持适度灵动，勇于拥抱新变化与新工具。',
    },
    己: {
      archetype: '田园沃土 · 孕育万物多能之壤',
      nature: '如平原沃野、润泽良田，多才多艺，包容温和，善于调和矛盾、成全他人。',
      talents: ['全能多面手与精细化管理', '极佳的亲和力与包容心', '善于把复杂事物落地落实'],
      advice: '多坚持自身核心主见，明确底线，在成全他人的同时成就自我。',
    },
    庚: {
      archetype: '重器神兵 · 刚毅果决先锋之剑',
      nature: '如百炼精钢、开山利刃，性情刚烈，讲义气，重实干，斩断阻滞绝不拖泥带水。',
      talents: ['极高的执行力与攻坚破局力', '鲜明的是非观与正义担当', '大开大合的改革创新魄力'],
      advice: '大勇之后重在大谋，遇事三思而后动，涵养平和中正之气。',
    },
    辛: {
      archetype: '璀璨珍珠 · 秀拔精致清贵之玉',
      nature: '如温润美玉、精雕首饰，灵秀高雅，追求极致完美与生活品质。',
      talents: ['追求卓越的工匠精神与精致度', '敏锐的品味鉴赏与批判思维', '自律自强的清贵气质'],
      advice: '接纳过程中的不完美，放宽眼界，不拘小节则格局更加宏阔。',
    },
    壬: {
      archetype: '奔涌江海 · 汪洋恣肆宏略之水',
      nature: '如长江大河、汪洋大海，奔流不息，富有大格局观，智谋深邃，通达万物。',
      talents: ['宏观视野与前瞻预判能力', '强大的流动性与跨界整合力', '宽广深沉的包容力与应变力'],
      advice: '善建堤防以导汪洋，设定清晰长远目标，持续深耕方成大器。',
    },
    癸: {
      archetype: '润物甘霖 · 随方就圆灵慧之露',
      nature: '如润物细雨、清晨甘露，灵动清幽，善解人意，具有极高的情商与灵性直觉。',
      talents: ['超强的同理心与沟通穿透力', '见微知著的灵感直觉', '润物无声的渗透与转化力'],
      advice: '保持自信笃定，注重身心能量闭环，避免思虑过多而优柔寡断。',
    },
  };

  const info = GAN_ARCHETYPES[dayMasterGan] || GAN_ARCHETYPES['甲']!;

  const strengthPlain =
    strengthStatus.includes('旺') || strengthStatus.includes('强')
      ? `【日主偏旺 · 自带充沛能量蓄水池】：你的天生元气非常旺盛，自主性强、精力充沛，不怕挑战。对你而言，人生最适合“输出才华、开拓事业与转化财富”（食伤/财/官为喜用），越敢于承担与创造，成就越大。`
      : `【日主偏弱 · 善于整合借力之智者】：你的天生元气偏向细腻内敛，善于观察、借势与团队协作。对你而言，人生最适合“依靠平台、深厚知识与得力贵人”（印比为喜用），切忌单打独斗硬拼，善借外力则势如破竹。`;

  const favorableHabitsPlain = [
    `核心调和五行：【${primaryUseful}】，建议在生活与工作中多向该五行属性的行业、思维方式或生活习惯靠拢。`,
    `格局定位：【${patternName}】，代表你的人生成就主要依托于这一核心天赋引擎的有效运转。`,
    `人际磁场：多与行事稳健、思维互补的良师益友交流，互为助力。`,
  ];

  const fourPillarsMetaphor = {
    year: `【根基 · 年柱 ${baziResult.pillars.year.ganZhi}】：代表家族土壤、童年启蒙与长辈福泽。是你人生大树扎根的土壤。`,
    month: `【主干 · 月柱 ${baziResult.pillars.month.ganZhi}】：代表青年时代、求学成长与事业主赛道。是你人生大树向上生长的主干。`,
    day: `【花朵 · 日柱 ${baziResult.pillars.day.ganZhi}】：代表你自己（日元 ${dayMasterGan}）与家庭配偶。是你人生最绚烂绽放的黄金期。`,
    hour: `【果实 · 时柱 ${baziResult.pillars.hour.ganZhi}】：代表晚年归宿、子女晚辈与终生作品成就。是你人生收获的累累硕果。`,
  };

  return {
    coreArchetype: info.archetype,
    natureAnalogy: info.nature,
    strengthPlain,
    favorableHabitsPlain,
    careerTalentsPlain: info.talents,
    lifeAdvicePlain: info.advice,
    fourPillarsMetaphor,
  };
}
