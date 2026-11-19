import catalog from './prompt-catalog.json';
import { almanacInput, astrolabeIndependentInput, bazhaiInput, baziZiweiIndependentInput, fortuneInput, liurenInput, liuyaoInput, mingluInput, qimenLifetimeInput, qizhengInput, residentialInput, xuankongInput, ziweiIndependentInput, type Method } from './schema';
import { baziTopicIds, baziTopics, baziSchoolIds, baziSchools } from './systems/bazi/prompt-options';
import qizhengTopics from './systems/qizheng/prompt-topics.json';

const almanacPrompt = almanacInput.shape.prompt.unwrap().shape;
const bazhaiPrompt = bazhaiInput.shape.prompt.unwrap().shape;
const xuankongPrompt = xuankongInput.shape.prompt.unwrap().shape;
const residentialPrompt = residentialInput.shape.prompt.unwrap().shape;
const astrolabePrompt = astrolabeIndependentInput.shape.prompt.unwrap().shape;
const qizhengPrompt = qizhengInput.shape.prompt.unwrap().shape;
const baziZiweiPrompt = baziZiweiIndependentInput.shape.prompt.unwrap().shape;
const lifetimePrompt = qimenLifetimeInput.shape.prompt.unwrap().shape;
const mingluPrompt = mingluInput.shape.prompt.unwrap().shape;
const fortunePrompt = fortuneInput.shape.prompt.unwrap().shape;
const promptCatalog = {
  zhouyi: { modes: ['hexagram', 'search'], note: '按卦序、卦名或原文检索；可选爻位并保留维基文库对应修订版本及许可。' },
  calendar: { kinds: ['solar-term', 'moon-phase', 'time-scales', 'true-solar', 'solar-illumination'], note: '节气、月相、时间尺度、真太阳时与太阳光照；实时时差及历史时间细节有模型限制。' },
  'number-energy': { topicIds: ['general'], subtopics: { general: [{ id: 'number-energy', label: '号码能量' }] }, scopeIds: ['custom'], defaultScope: 'custom', purposes: ['general', 'phone', 'plate'], note: '号码由用户提供；八星与数理为民俗取象，不证明现实效果。' },
  'character-query': { actions: ['text', 'search'], note: '可查询字形、笔画和释义；字典原文按需加载，缺文明确标记。筛选支持分页。' },
  'chinese-name': { topicIds: ['general'], subtopics: { general: [{ id: 'name-analysis', label: '姓名解析' }] }, scopeIds: ['natal', 'event', 'custom'], defaultScope: 'natal', note: '单姓或复姓、一字或二字名；可指定五行或提供出生资料。出生模型是条件取向，并非最终喜用。' },
  'chinese-naming': { topicIds: ['general'], subtopics: { general: [{ id: 'naming', label: '起名方案' }] }, scopeIds: ['natal', 'event', 'custom'], defaultScope: 'natal', genders: ['general', 'male', 'female'], note: '支持一字或二字名、偏好字、忌用字、辈分字位置及可选出生资料。' },
  'bazi-reverse': { note: '四柱按标准北京时间和 23 点换日搜索；候选为时间范围，不能当作确定出生时间。候选 birthRange 可用于姓名分析与起名。' },
  instant: { types: ['bazi', 'ziwei', 'bazi-ziwei', 'astrolabe', 'qizheng'], note: '即时盘不等于个人出生盘；星盘、七政及真太阳时需要观测地点，追问复用保存的起盘时刻。' },
  'random-divination': { note: '明确要求随机选择占法时，从已启用的候选术数中选择并生成一次结果；追问使用已选术数和原盘。太乙使用北京时间所在年年计，塔罗与雷诺曼默认单张。' },
  'bazi': { topics: baziTopicIds.map((id) => ({ id, label: baziTopics[id].label })), schools: baziSchoolIds.map((id) => ({ id, label: baziSchools[id].label })), detailModes: ['compact', 'full'], scopes: ['natal', 'full', 'dayun', 'year', 'month', 'day', 'hour'], note: '支持 birth 或最长两小时的 birthRange（后者可直接承接四柱反推候选）；选择具体岁运层级需精确出生、性别与 referenceTime。包含四柱、旺衰、格局、调候、用神裁定、大运流年及 55 项本命神煞；双人合盘使用 bazi-synastry。' },
  'bazi-synastry': { relationships: ['marriage', 'career', 'friendship', 'children', 'parents', 'siblings'], schools: baziSchoolIds, detailModes: ['compact', 'full'], note: '出生时段未选择时自动比较全部候选组合；指定各方 candidateIndex 后可查看逐项双盘，含夫妻宫天地德合/天克地冲、双方喜忌覆盖及可选 referenceTime 岁运合参；变化事实通过 comparisonPage 与 nextOffset 分页，最多 2048 组。' },
  bazhai: { schools: bazhaiPrompt.schools.unwrap().element.options, includeClassics: true, note: '八宅明镜：支持命卦或出生资料、坐山或角度测量，不含玄空飞星与实地形峦。' },
  xuankong: { modes: ['下卦', '替卦'], schools: xuankongPrompt.schools.unwrap().element.options, includeClassics: true, note: '玄空飞星：交运与山向边界保留候选；替卦须确认兼向，城门仅列盘面，不含实地形峦。' },
  residential: { modes: ['下卦', '替卦'], schools: residentialPrompt.schools.unwrap().element.options, includeClassics: true, note: '住宅风水：八宅和玄空分层；未提供建造年不排玄空，不生成综合总分。' },
  almanac: { topics: ['move', 'marriage', 'opening', 'contract', 'travel', 'medical', 'study', 'burial', 'renovation', 'custom'], detailModes: ['compact', 'full'], schools: almanacPrompt.schools.unwrap().element.options, includeClassics: true, note: '黄历择日：综合宜忌、建除黄黑道、神煞（含四离四绝、十恶大败、杨公忌、三娘煞等）、二十八宿、九星、参与人冲克及优选/次选/慎用分级；支持 page 分页及正午月相背景，超过 7 天提示词默认简版。' },
  'qizheng-range': { ...qizhengTopics, scopeIds: qizhengPrompt.scope.unwrap().options, eventDetail: qizhengPrompt.eventDetail.unwrap().options, schools: qizhengPrompt.schools.unwrap().element.options, includeClassics: true, defaultScope: 'natal', note: '逐秒分页比较本命及可选流曜时点；提供 flow 时默认 full。范围上限两小时，按 nextCursor 续取全部页面；周期事件须显式启用并缩小分页。includeStarMeanings 可附未校核的项目整理取象。' },
  qizheng: { ...qizhengTopics, scopeIds: qizhengPrompt.scope.unwrap().options, eventDetail: qizhengPrompt.eventDetail.unwrap().options, schools: qizhengPrompt.schools.unwrap().element.options, includeClassics: true, defaultScope: 'natal', note: '本命包含神煞、恩难、命宫宿度、十干化曜及日月天文资料；提供 flow 时默认 full，可用 periodEvents 启用周期事件。includeStarMeanings 可附未校核的项目整理取象；行限提供洞微百岁定式参考，实测交限岁数未作唯一裁定。' },
  'bazi-ziwei': { topics: baziZiweiPrompt.topic.unwrap().options, detailLevels: baziZiweiPrompt.detailLevel.unwrap().options, baziSchools: baziZiweiPrompt.baziSchools.unwrap().element.options, ziweiSchools: baziZiweiPrompt.ziweiSchools.unwrap().element.options, note: '共用出生资料；未知时辰按两盘真实时间交集比较。' },
  'ziwei-synastry': { relationships: ['marriage', 'career', 'friendship', 'children', 'parents', 'siblings'], schools: ['sanhe', 'feixing', 'sihua', 'zhongzhou'], detailModes: ['compact', 'full'], note: '本命同支叠宫与生年四化跨盘定位；可比较全部出生时段候选，变化事实按 comparisonPage 分页。' },
  'ziwei': { topicIds: ziweiIndependentInput.shape.prompt.unwrap().shape.topic.unwrap().options, schools: ['sanhe', 'feixing', 'sihua', 'zhongzhou'], scopes: ['origin', 'full', 'decadal', 'yearly', 'monthly', 'daily', 'hourly', 'age'], note: '支持精确出生、民用时辰或未知时辰；选择运限须提供不早于全部候选的 referenceTime，可用 candidateIndex 聚焦候选。' },
  'astrolabe-range': { topicIds: astrolabePrompt.topic.unwrap().options, schools: astrolabePrompt.schools.unwrap().element.options, eventDetail: astrolabePrompt.eventDetail.unwrap().options, note: '出生时间逐秒分页；本命每页最多 20 秒，推运最多 2 秒，周期事件每页 1 秒且周期页为 1 日；出生与周期游标分别续取。' },
  'astrolabe': { topicIds: astrolabePrompt.topic.unwrap().options, schools: astrolabePrompt.schools.unwrap().element.options, eventDetail: astrolabePrompt.eventDetail.unwrap().options, techniques: ['transit', 'solar-return', 'secondary', 'solar-arc'], periodEventKinds: ['transit_aspect', 'sky_aspect', 'station', 'sign_ingress', 'house_ingress', 'moon_phase', 'eclipse'], note: '本命及指定时点推运；可指定太阳返照地点，可选四颗小行星和最多 7 日一页的周期扫描；出生范围使用 astrolabe-range。' },
  'astrolabe-synastry': { schools: ['modern', 'traditional', 'hellenistic', 'timing'], note: '双人本命盘、五种跨盘相位、双向落宫和传统接纳互溶；不含动态运限。' },
  'qimen-lifetime': { topics: ['career', 'wealth', 'marriage', 'health', 'academic', 'relocation', 'family', 'children', 'partnership'], schools: lifetimePrompt.schools.unwrap().element.options, scopes: lifetimePrompt.scope.unwrap().options, detailModes: lifetimePrompt.detailMode.unwrap().options, stageModels: ['pillarFourLimits', 'palaceWalk', 'fushiAlternating', 'decadalGanzhi'], note: '支持精确出生或范围候选秒、本命盘、四种分运模型及可选流年动态扫描。' },
  minglu: { topics: mingluPrompt.topic.unwrap().options, detailModes: mingluPrompt.detailMode.unwrap().options, note: '综合命录聚合：复用八字、紫微、西洋星盘与八宅命卦，生成分节 Markdown 与提示词；不生成旧版加权评分。' },
  fortune: { topics: fortunePrompt.topic.unwrap().options, detailModes: fortunePrompt.detailMode.unwrap().options, scopes: ['daily', 'monthly', 'yearly'], includeClassics: true, note: '日运、月运、年运推演：不选案例时按流时历法与五运六气输出通用运势；传入 birth/gender/location 时结合个人八字喜忌、紫微流运与星盘行运输出定制化趋势概览与报告提示词。' },
  ...catalog,
  liuyao: { ...catalog.liuyao, liuyaoTemplate: liuyaoInput.shape.prompt.unwrap().shape.liuyaoTemplate.unwrap().options },
  liuren: { ...catalog.liuren, liurenTemplate: liurenInput.shape.prompt.unwrap().shape.liurenTemplate.unwrap().options },
};

export function getPromptCatalog(enabled: readonly Method[]) {
  return Object.fromEntries(enabled.map((method) => [method, promptCatalog[method]]));
}
