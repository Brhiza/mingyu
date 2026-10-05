const CANONICAL_PROMPT_GUIDANCE_TEXT = {
  'wuyun-liuqi': {
    tradition: '以年干定岁运太过不及，以年支定司天在泉，再看五步主客运与六步主客气的阶段关系。',
    sources: '参考《素问》运气七篇与吴谦《运气要诀》。',
  },
  bazi: {
    tradition:
      '子平法先看月令、根气、透干与全局制化，再定旺衰、格局和调候；十神落实人事，岁运以原局为根，神煞仅作旁证。',
    sources: '参考《渊海子平》《三命通会》《子平真诠》《滴天髓》《穷通宝鉴》等子平法文献。',
  },
  'bazi-compatibility': {
    tradition:
      '双方命局按月令、日主旺衰、格局与调候建立，交叉比较日主五行、十神映射、日支与四柱关系与喜忌互补。双方原局和单柱合冲刑害分别列出；有共同岁运资料时再看阶段互动。',
    sources: '双方命局参考《渊海子平》《三命通会》《子平真诠》《滴天髓》《穷通宝鉴》等子平法文献。',
  },
  ziwei: {
    tradition:
      '以命身十二宫为骨架，结合主星庙旺、三方四正、辅煞与四化判断；生年四化看本命，运限四化看阶段变化。',
    sources: '参考《紫微斗数全书》《紫微斗数全集》等通行资料，以盘面实际列出的星曜与宫位为准。',
  },
  'ziwei-compatibility': {
    tradition:
      '双方命身宫、关系宫位、主星庙旺和三方四正构成各自盘面；双方宫位对应、星性互动与跨盘四化落点构成合盘资料。长期结构承接看本命对应关系；有运限或流年资料时再看阶段变化。',
    sources: '参考《紫微斗数全书》《紫微斗数全集》及紫微斗数合盘通行读法。',
  },
  'bazi-ziwei': {
    tradition:
      '八字按月令、日主、十神，紫微按命身十二宫、星曜、三方四正与四化，两套体系各自成论后交叉印证。共同出现的主题与分歧分别列出；时间判断只落到八字岁运和紫微运限都已列出的层级。',
    sources:
      '八字参考《渊海子平》《三命通会》《子平真诠》《穷通宝鉴》等；紫微参考《紫微斗数全书》《紫微斗数全集》等，安星口径以盘面实际采用的传统通行法或中州派法为准。',
  },
  liuyao: {
    tradition:
      '六爻先定用神和世应，再结合月建、日辰旺衰、动爻变爻、空破、伏神及原忌仇神作用链判断。同类用神多现时，逐爻比较动静、旺衰、空破与世应关系后说明取舍；明爻与伏神分别保留身份，辅证仍按自身角色解释。',
    sources: '参考京房八宫纳甲体系及《火珠林》《卜筮正宗》《增删卜易》等资料。',
  },
  meihua: {
    tradition:
      '以本卦、互卦、变卦和动爻为结构，结合体用生克、四时旺衰与卦爻辞取象。物象取义对应已知物类、方位与问题，体用关系统领主判断，互变说明过程与趋向；外应采用本次已记录的所见所闻。',
    sources: '参考《周易》卦爻辞与通行本《梅花易数》的体用、互变和四时旺衰口径。',
  },
  xiaoliuren: {
    tradition:
      '按本次起课口径定月宫与日宫，再从日宫起子时，依大安、留连、速喜、赤口、小吉、空亡顺行；时宫为本次占得宫，月宫与日宫只承担逐宫顺数。',
    sources: '参考通行俗传小六壬掌诀与六宫歌诀。',
  },
  jinkoujue: {
    tradition:
      '金口诀以地分、将神、贵神、人元四位为主，结合阴阳发用、月令旺衰、四位生克与五动三动判断。',
    sources: '参考《六壬神课金口诀古本》的阴阳次第五用与五动三动。',
  },
  qimen: {
    tradition:
      '奇门先定事项用神，再看值符值使与用神落宫，结合门、星、神、天地盘干、生克、空亡、入墓、击刑、门迫与格局判断。',
    sources: '参考《奇门遁甲统宗》年、月起例及奇门九宫、三奇六仪、九星八门八神等资料。',
  },
  liuren: {
    tradition:
      '大六壬以月将加时、四课和取传规则定发用；三传看发端、转折与归结，并结合旺衰、空亡、天将、课体和类神判断。发用承担课传结构，事项类神按问题另定并核对实际乘支、落课与入传；天将象意与乘支状态共同取义。',
    sources: '参考《大六壬大全》《御定六壬直指》《六壬指南》《毕法赋》等资料。',
  },
  taiyi: {
    tradition:
      '积年与本计阴阳遁、七十二局构成盘面基础；太乙、文昌、始击、计神落宫及主客定算构成主线，十六神为辅助定位。门具依据太乙与文昌（主目）是否临开、休、生门判定，并结合各自所临八门。年、月、日、时四计各自成局，阴遁时计只用时计阴遁口径。',
    sources:
      '参考《太乙金镜式经》积年、阴阳遁七十二局及相关主客定算立成；门具参《太乙统宗宝鉴》卷五。',
  },
  huangji: {
    tradition:
      '以元、会、运、世定位目标年份的周期层级，再依会内统卦、运卦、六十年统卦、十年卦和值年卦逐层推演。',
    sources: '参考《皇极经世》、蔡元定《皇极经世指要》及先天圆图值年卦通行排法。',
  },
  tarot: {
    tradition: '先按牌阵与牌位职能确定结构，再结合正逆位、牌组层次、元素和牌序推进解读。',
    sources:
      '参考 Rider-Waite-Smith 体系及 A. E. Waite《The Pictorial Key to the Tarot》等塔罗通行牌义。',
  },
  lenormand: {
    tradition:
      '雷诺曼以牌序、邻牌组合、固定组合和牌阵布局为主要资料；牌位顺序与相邻关系优先于单牌辞义。',
    sources: '参考 Petit Lenormand 传统牌义及《Das Spiel der Hoffnung》历史牌组资料。',
  },
  ssgw: {
    tradition: '签诗原文与签题构成传统签文资料。',
    sources: '参考潮汕三山国王庙宇签文化及当前签诗资料。',
  },
  zhuge: {
    tradition: '以随念三字的康熙笔画末位合成三位数，再按三百八十四签循环取签。',
    sources: '参考诸葛神数三字取数与三百八十四签的通行口径。',
  },
  kongming: {
    tradition: '以五枚硬币的正反面组成阴阳卦象，依三十二种组合对应的卦名、等第与卦诗判断。',
    sources: '参考孔明神卦五枚硬币取象与三十二卦的通行口径。',
  },
  almanac: {
    tradition: '择日以原始宜忌与直接冲犯为先，建除、十二神、宿曜及参与人刑冲破害互参。',
    sources: '参考《钦定协纪辨方书》《选择要略》等择日资料。',
  },
  astrolabe: {
    tradition:
      '先看太阳、月亮、上升和命主星，再结合行星落座落宫、主要相位与格局；时限资料用于观察阶段触发。',
    sources: '参考现代西方占星通行的本命、宫位、相位与行运定义；星体位置采用天文星历资料。',
  },
  'astrolabe-synastry': {
    tradition:
      '双方太阳、月亮、上升及其他本命结构提供各自盘面背景；跨盘相位、落宫与容许度提供互动几何资料；紧密相位提供互动强度线索。',
    sources: '参考现代西方占星合盘通行读法与天文星历位置资料，以双方本命结构和跨盘相位资料为准。',
  },
  bazhai: {
    tradition: '以立春年界定命卦，结合宅卦、坐向门向与八方吉凶判断人宅关系。',
    sources: '参考《八宅明镜》《阳宅十书》命卦、宅卦与大游年八宫口径。',
  },
  zodiac: {
    tradition:
      '以生肖地支与流年干支的值、冲、刑、害、破、六合、三合、三会及年干五行关系作为传统关系类别。',
    sources: '参考《三命通会》等传统干支关系资料。',
  },
  qizheng: {
    tradition:
      '七政四余以二十八宿、命身宫、星曜落宫与主要吊照为主；有行限时按命宫起大限小限，有流曜周期时按换宫、停逆与精确吊照看阶段起伏。',
    sources: '参考《果老星宗》《御定五星精义》《星学大成》《七政算内篇》及天文星历。',
  },
  residential: {
    tradition:
      '住宅风水结合玄空三元九运、下卦或兼向替卦山向飞布与八宅命卦、宅卦和八方吉凶判断宅运及人宅适配。',
    sources:
      '参考《八宅明镜》《阳宅十书》命卦宅卦与大游年口径，以及玄空飞星通行的三元九运、元龙阴阳顺逆、下卦与兼向替星口径。',
  },
  xuankong: {
    tradition:
      '先按盘面标注的下卦或兼向替卦定三元九运与二十四山向，再结合运盘、山盘、向盘、到山到向和局型判断；有流年或流月时，把三元紫白飞星叠到各宫。',
    sources: '参考玄空飞星通行的三元九运、元龙阴阳顺逆、下卦与兼向替星口径及三元紫白流年流月飞布。',
  },
} as const;

export const PROMPT_GUIDANCE_TEXT = structuredClone(CANONICAL_PROMPT_GUIDANCE_TEXT);

export type PromptGuidanceId = keyof typeof PROMPT_GUIDANCE_TEXT;

export type DivinationPromptGuidanceMethod =
  | 'liuyao'
  | 'meihua'
  | 'xiaoliuren'
  | 'jinkoujue'
  | 'qimen'
  | 'liuren'
  | 'taiyi'
  | 'huangji'
  | 'wuyun'
  | 'tarot'
  | 'lenormand'
  | 'ssgw'
  | 'zhuge'
  | 'kongming'
  | 'almanac'
  | 'astrolabe';

export const PROMPT_ANSWER_FRAMEWORK =
  '围绕问题比较主证与反证，核对成立条件后给主判断；制约分别说明对结果、程度或时间的影响，未决处交代能区分结论的资料。';

/** 各术数体系专属的传统推演骨架，针对不同底层象数理模型定制，保障沉浸与地道。 */
const CANONICAL_PROMPT_METHOD_ANSWER_FRAMEWORKS: Record<string, string> = {
  // 1. 命理时序体系
  bazi: '以月令、根气、透藏和制化分别论旺衰、格局与调候；依据已列取格依据与格局成败，结合本盘制化关系定取用；岁运保留原局、运层与参与干支，交运前后分段说明条件变化。',
  'bazi-natal':
    '依据月令、根气、透藏与制化说明四柱原局；核对已列取格依据与格局成败，结合本盘出现的制化关系判断取用；旺衰、格局、调候各明依据。',
  'bazi-compatibility':
    '分别确立双方原局与取用，再按双方各自日主解释十神和跨盘合冲刑害；同名干支保留所属人及柱位，关系强度结合双方承接条件判断。共同时间资料按同一日期范围合参。',
  ziwei:
    '以主题宫、命身与三方四正核对格局组合及庙旺，比较主证与辅煞的实际作用；生年、运限及流年四化保留发出宫、化星和落宫，按叠宫和边界区分本命条件与阶段触发。',
  'ziwei-natal':
    '以命身宫和主题宫为起点，核对三方四正、主辅杂曜与庙旺的组合条件；生年四化保留星曜与落宫，比较主证与反证，说明制约改变的是主题表现、程度还是落实条件。',
  'ziwei-compatibility':
    '分别确立双方命身与关系宫位，再按实际地支对应比较跨盘星曜与四化；每条飞化保留发出方、发出宫、化星和接收方落宫，结合各自本命承接条件解释互动。',
  'bazi-ziwei':
    '八字按原局与取用、紫微按命身与主题宫分别成论；合参对齐同一人、问题和时段，区分共同支持、互补资料与实质分歧，并说明分歧成立的条件。',
  'bazi-ziwei-natal':
    '八字依据四柱原局、月令与取用成论，紫微依据本命命身与主题宫成论；交叉核对共同支持、互补资料与实质分歧，说明各自成立的条件。',
  'bazi-ziwei-aligned': '八字按所列岁运、紫微按所列运限各自成论，再交叉印证同一时间范围。',
  'bazi-ziwei-mismatch': '八字与紫微按各自已列资料成论后交叉印证，时间层未对齐时分开陈述。',
  astrolabe:
    '从主题宫、宫主星与本命状态取用，格局核对成员、相位两端及容许度，重复关系归并；支持与张力各明条件，本次已列时限资料按盘层保留时间窗口及入相出相。',
  'astrolabe-natal':
    '围绕主题宫、宫主星及日月上升判断本命结构；格局逐项核对成员、相位两端与容许度，重复相位归同一关系；综合尊贵、落宫与逆行状态说明支持、张力及取舍。',
  'astrolabe-synastry':
    '分别说明双方本命与关系主题；跨盘相位标明双方天体、容许度和落宫；结合各自本命承接，有现实资料时结合问题所述情况，分析吸引、摩擦及长期相处条件。',
  qizheng:
    '从命身宫度、主题宫主和十一曜落宿建立本命依据，宫位与宿度分别取义；结合本次吊照说明主题承接和成立条件。',

  // 2. 卦象筮法与三式体系
  liuyao:
    '按事项定世应与主用神，同类多现比较动静、旺衰、空破后取舍；动变、伏藏、原忌仇神核对作用对象与生克路径，区分成败条件和迟速条件，再据出空填实等推应期。',
  meihua:
    '依据实际起卦方式、动爻与体用定位建立主判断，将时令旺衰和本互变生克联系所问事项；外应取本次已记录的物象，应期说明卦数或时令线索、时间单位和成立条件。',
  'meihua-number':
    '先依据起卦数字、动爻、体用旺衰与已列卦象判断当前趋势，再按盘面时间线索说明进展。',
  'meihua-random':
    '先依据随机所得本卦、互卦、变卦、动爻与体用旺衰判断当前趋势，再结合盘面结构说明进展。',
  'meihua-time':
    '先依据本次起卦的本卦、互卦、变卦、动爻与体用旺衰判断当前趋势，再结合盘面已有的时间线索说明进展。',
  qimen: '先综述全盘态势，再围绕所问事项整理主判断及可观察的应期线索。',
  liuren:
    '按事项选类神并定位日干日支、四课三传；课体、天将与乘支核对成立条件，入课入传明确主次；初中末传结合旺衰空破判断变化，说明制约影响结果还是迟速。',
  jinkoujue:
    '按所列口径确定用爻，分别定位人元、贵神、将神和地分；逐项说明四位生克、月令旺衰、空亡与实际命中的五动三动，主判断连接事项角色和成立条件，节奏采用课内已有线索。',
  taiyi:
    '核对本次计式及目标时点，再以太乙、文昌、始击、主客算和将位建立主客关系；盘式格局与所问对象相互对应，分别说明支持、制约及当前计式能支撑的时间范围。',
  huangji:
    '先定位元会运世周期层级与会内统卦，再按运卦、六十年统卦、十年卦和值年卦逐层收束目标年份的时势主线。',
  'huangji-cycle': '先定位元会运世周期层级与目标年进度，再说明周期边界和层级关系。',

  // 3. 堪舆风水体系
  bazhai:
    '分清命卦与宅卦，按实际坐向和所问空间逐宫解释大游年关系；传统方位属性与已知房屋用途、门窗通道及居住条件分别取证，形成有适用前提的人宅判断。',
  xuankong:
    '先核对起运年、坐向与已列卦型，逐宫区分运星、山星、向星；旺衰依所属运期，山向作用联系已知形峦与空间功能，按已列盘面分层说明作用条件。',
  residential:
    '八宅按命宅关系、玄空按运期山向分别推导，同一方位先对齐测量依据和实际用途，再说明两套判法的共同支持与分歧条件；流盘变化和长期宅盘结构分别表述。',

  // 4. 择日体系
  almanac:
    '对齐事项、候选范围及参与人，按直接宜忌和冲犯，结合建除、宿曜核对每个候选日；有多个候选时说明首选与备选，受制的候选说明慎用原因与对应盘面依据。',

  // 5. 灵签与直断体系
  ssgw: '围绕所问事项解释本签诗句、吉凶级别与典故，将基础解签和补充解释连成一致的寓意；结合诗中转折与条件说明当前处境及进退取义。',
  zhuge: '依据本签签号、签诗、基础解签和补充解释回应问题，逐句联系诗中意象与条件，说明事态取义。',
  kongming: '依据本次签题、卦诗与等第解释所问事项，结合诗中意象、转折和条件说明处境及进退取义。',
  xiaoliuren:
    '先复核农历月日与时辰顺数，区分定位宫与时宫主证。各项判断依据时宫歌诀句义，总体判断、分项解释与总结保持同一取证范围。',
  tarot:
    '先按问题与牌位职能逐牌解释正逆位，结合实际牌序、元素、人物与相邻或对照关系归纳整阵主线；分别说明支持、张力和情境分支，时间取义对应牌阵实际提供的时间位置。',
  'tarot-single':
    '围绕唯一牌位、牌名和正逆位解释当前主题，联系牌面象征与问题情境；多种牌义按现实条件比较取舍，时间含义采用本次牌位已给定的范围。',
  lenormand:
    '按实际牌序、布局语法、邻牌关系及已成立的组合解读；固定组合与一般联读分别取义，以整阵的支持与制约回应同一问题，时间与人物角色依据各牌位资料解释。',
  'lenormand-single':
    '以唯一牌位和基础牌义回应问题，将象意联系已知情境，说明能支持的主题与需要现实条件区分的含义。',

  // 6. 年运与周期体系
  zodiac:
    '列明生肖与流年实际命中的值、冲、刑、害、破、六合、三合、三会及五行关系和参与条件；结合问题与已提供资料核对适用条件，资料不足则说明待核对项。',
  'wuyun-liuqi':
    '先依年干支判定岁运太过不及与司天在泉，再结合五步主客运与六步主客气详述四时气候节律与变化节点。',
  'huangji-jingshi':
    '先定位元会运世周期层级与值年统卦，再结合卦爻变易与先后天象意推演时势走向与转折关窍。',
};

export const PROMPT_METHOD_ANSWER_FRAMEWORKS: Record<string, string> = {
  ...CANONICAL_PROMPT_METHOD_ANSWER_FRAMEWORKS,
};

export function getPromptAnswerFramework(method?: string): string {
  if (method && Object.hasOwn(CANONICAL_PROMPT_METHOD_ANSWER_FRAMEWORKS, method)) {
    return CANONICAL_PROMPT_METHOD_ANSWER_FRAMEWORKS[method];
  }
  return PROMPT_ANSWER_FRAMEWORK;
}

/** 在具体任务后追加对应体系的简短答题骨架。 */
export function buildPromptTask(task: string, method?: string) {
  let normalizedTask = task.trim();
  const framework = getPromptAnswerFramework(method);
  if (!normalizedTask) return framework;
  if (normalizedTask.includes(framework)) return normalizedTask;
  // 切换术式时替换末尾已有的答题骨架，保留任务正文及正文中的引用。
  const allFrameworks = [
    ...new Set([
      PROMPT_ANSWER_FRAMEWORK,
      ...Object.values(CANONICAL_PROMPT_METHOD_ANSWER_FRAMEWORKS),
    ]),
  ].sort((a, b) => b.length - a.length);
  let trailing = allFrameworks.find((item) => normalizedTask.endsWith(item));
  while (trailing) {
    normalizedTask = normalizedTask.slice(0, -trailing.length).trim();
    trailing = allFrameworks.find((item) => normalizedTask.endsWith(item));
  }
  if (!normalizedTask) return framework;
  const separator = /[。！？]$/.test(normalizedTask) ? '' : '。';
  return `${normalizedTask}${separator}${framework}`;
}

/** 自由提问只保留中性任务，不附加任何预设主题。 */
export function buildCustomQuestionTask(subject = '以上资料', method?: string) {
  return buildPromptTask(`请依据${subject.trim() || '以上资料'}回答【问题】`, method);
}

export function buildPromptGuidanceSections(method: PromptGuidanceId | 'wuyun') {
  const guidanceMethod = method === 'wuyun' ? 'wuyun-liuqi' : method;
  // 签谱提示词只允许携带本次签谱资料；签文、典故和解签由盘面资料本身提供。
  if (['ssgw', 'zhuge', 'kongming'].includes(guidanceMethod)) return '';
  const guidance = CANONICAL_PROMPT_GUIDANCE_TEXT[guidanceMethod];
  // 书目名称不参与本次判断，完整来源仍保留在结构化证据中。
  const blocks = 'tradition' in guidance ? guidance.tradition : '';

  return blocks ? `【传统依据】\n${blocks}` : '';
}

export function insertPromptSectionBeforeHeading(prompt: string, heading: string, section: string) {
  const normalizedPrompt = prompt.trim();
  const normalizedSection = section.trim();
  if (!normalizedPrompt || !normalizedSection) return normalizedPrompt;

  const marker = `\n\n${heading}`;
  if (normalizedPrompt.includes(marker)) {
    return normalizedPrompt.replace(marker, `\n\n${normalizedSection}${marker}`);
  }

  const taskMarker = '\n\n【任务】';
  return normalizedPrompt.includes(taskMarker)
    ? normalizedPrompt.replace(taskMarker, `\n\n${normalizedSection}${taskMarker}`)
    : `${normalizedPrompt}\n\n${normalizedSection}`;
}

/** 生成核心提示词使用的传统依据段落。 */
export function buildPromptGuidance(method: string) {
  const guidanceMethod = method === 'wuyun' ? 'wuyun-liuqi' : method;
  return Object.hasOwn(CANONICAL_PROMPT_GUIDANCE_TEXT, guidanceMethod)
    ? buildPromptGuidanceSections(guidanceMethod as PromptGuidanceId)
    : '';
}
