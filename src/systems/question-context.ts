import type { SynastryRelationship } from './focus-presets';

export type QuestionTopic =
  | 'general'
  | 'ganqing'
  | 'shiye'
  | 'caifu'
  | 'guaishen'
  | 'academic'
  | 'travel'
  | 'lost'
  | 'litigation';

export type LiuyaoSixRelative = '妻财' | '官鬼' | '父母' | '子孙' | '兄弟';

export interface ParsedQuestionContext {
  rawQuestion: string;
  cleanQuestion: string;
  gender?: '男' | '女';
  birthYear?: number;
  subjectRole?: string;
  lifeStageContext?: string;
  timeHorizon?: string;
  inferredTopic: QuestionTopic;
  liuyaoCategory?: 'wealth' | 'career' | 'marriage' | 'health' | 'travel' | 'lost' | 'litigation' | 'house';
  liuyaoRelative?: LiuyaoSixRelative;
  liuyaoRelativeReason?: string;
  qimenMatterIntent?: 'wealth' | 'career' | 'relationship' | 'health' | 'academic' | 'travel';
  synastryRelationship?: SynastryRelationship;
}

function matchTagValue(question: string, label: string): string | undefined {
  const re = new RegExp(`${label}[：:]\\s*([^｜|\\n]+)`, 'u');
  const m = re.exec(question);
  return m?.[1]?.trim() || undefined;
}

/**
 * 从用户问题与【求测背景】标签中结构化提取性别、出生年份、所问对象、处境与关注周期，
 * 用于驱动用神锁定、行年推演与经典分类检索（兼容所有原有输入契约）。
 */
export function parseQuestionContext(rawQuestion = ''): ParsedQuestionContext {
  const trimmed = rawQuestion.trim();
  const cleanQuestion = trimmed.replace(/\n*【(?:求测背景|求测人|现状与已知前提|期望目标与现实限制|补充背景|当前情况|当前状态|已知事实|期望结果|现实限制)】[\s\S]*$/u, '').trim();

  const rawGender = matchTagValue(trimmed, '性别');
  let gender: '男' | '女' | undefined =
    rawGender === '男' || rawGender === '女' ? rawGender : undefined;
  if (!gender) {
    if (/(?:我是男|男占|男生|男士|丈夫问)/.test(cleanQuestion)) gender = '男';
    else if (/(?:我是女|女占|女生|女士|妻子问)/.test(cleanQuestion)) gender = '女';
  }

  const rawYear = matchTagValue(trimmed, '出生年');
  let birthYear: number | undefined;
  if (rawYear) {
    const m = /(\d{4})/.exec(rawYear);
    if (m) {
      const y = Number.parseInt(m[1]!, 10);
      if (y >= 1900 && y <= 2100) birthYear = y;
    }
  } else {
    const ym = /(?:出生于?|生于)\s*((?:19|20)\d{2})\s*年/.exec(cleanQuestion);
    if (ym) birthYear = Number.parseInt(ym[1]!, 10);
  }

  const subjectRole = matchTagValue(trimmed, '所问对象');
  const lifeStageContext = matchTagValue(trimmed, '当前处境');
  const timeHorizon = matchTagValue(trimmed, '关注周期');

  const semantic = `${cleanQuestion} ${subjectRole ?? ''} ${lifeStageContext ?? ''}`;

  let inferredTopic: QuestionTopic = 'general';
  let liuyaoCategory: ParsedQuestionContext['liuyaoCategory'];
  let qimenMatterIntent: ParsedQuestionContext['qimenMatterIntent'];

  if (/(失物|丢了|找回|遗失|寻人|走失)/.test(semantic)) {
    inferredTopic = 'lost';
    liuyaoCategory = 'lost';
  } else if (/(官司|词讼|诉讼|纠纷|官非|维权|法院|仲裁)/.test(semantic)) {
    inferredTopic = 'litigation';
    liuyaoCategory = 'litigation';
  } else if (/(出行|旅游|出差|签证|出国|远行|航班|开车|平安回来)/.test(semantic)) {
    inferredTopic = 'travel';
    liuyaoCategory = 'travel';
    qimenMatterIntent = 'travel';
  } else if (/(家宅|搬家|乔迁|装修|买房|阳宅|居住|房子)/.test(semantic)) {
    inferredTopic = 'guaishen';
    liuyaoCategory = 'house';
  } else if (/(健康|生病|疾病|看病|身体|手术|体检|医|康复)/.test(semantic)) {
    inferredTopic = 'guaishen';
    liuyaoCategory = 'health';
    qimenMatterIntent = 'health';
  } else if (/(考试|升学|考研|考公|学历|成绩|录取|进修|证书)/.test(semantic)) {
    inferredTopic = 'academic';
    liuyaoCategory = 'career';
    qimenMatterIntent = 'academic';
  } else if (
    subjectRole === '伴侣对象' ||
    /(感情|婚姻|婚恋|复合|正缘|分手|恋爱|伴侣|对象|暧昧|单身|已婚|桃花|离婚)/.test(semantic)
  ) {
    inferredTopic = 'ganqing';
    liuyaoCategory = 'marriage';
    qimenMatterIntent = 'relationship';
  } else if (/(财|钱|投资|赚钱|生意|股票|基金|借款|欠款|买卖|收入|收益|发财)/.test(semantic)) {
    inferredTopic = 'caifu';
    liuyaoCategory = 'wealth';
    qimenMatterIntent = 'wealth';
  } else if (
    subjectRole === '职场合作方' ||
    /(工作|事业|职场|跳槽|升职|求职|面试|创业|合作|合伙|老板|同事|调岗|换工|在职)/.test(semantic)
  ) {
    inferredTopic = 'shiye';
    liuyaoCategory = 'career';
    qimenMatterIntent = 'career';
  }

  let liuyaoRelative: LiuyaoSixRelative | undefined;
  let liuyaoRelativeReason: string | undefined;

  if (subjectRole === '伴侣对象' || liuyaoCategory === 'marriage') {
    if (gender === '男') {
      liuyaoRelative = '妻财';
      liuyaoRelativeReason = '男占婚恋伴侣，依传统取妻财爻为主用神';
    } else if (gender === '女') {
      liuyaoRelative = '官鬼';
      liuyaoRelativeReason = '女占婚恋伴侣，依传统取官鬼爻为主用神';
    }
  } else if (subjectRole === '家人长辈') {
    liuyaoRelative = '父母';
    liuyaoRelativeReason = '所问对象为家人长辈，取父母爻为主用神';
  } else if (subjectRole === '子女晚辈') {
    liuyaoRelative = '子孙';
    liuyaoRelativeReason = '所问对象为子女晚辈，取子孙爻为主用神';
  } else if (subjectRole === '职场合作方') {
    if (/(合作|合伙|同事|朋友|竞争|平辈)/.test(cleanQuestion)) {
      liuyaoRelative = '兄弟';
      liuyaoRelativeReason = '问平级合作或同事竞争，先察兄弟爻与应爻';
    } else {
      liuyaoRelative = '官鬼';
      liuyaoRelativeReason = '问职场管理、上级或官方事务，取官鬼爻为主用神';
    }
  } else if (inferredTopic === 'academic') {
    liuyaoRelative = '父母';
    liuyaoRelativeReason = '问学业考试文书，取父母爻（印星文书）为主用神，兼看官鬼';
  } else if (liuyaoCategory === 'health') {
    liuyaoRelative = '官鬼';
    liuyaoRelativeReason = '问病症以官鬼为病机、子孙为医药，世爻为本人';
  } else if (liuyaoCategory === 'house') {
    liuyaoRelative = '父母';
    liuyaoRelativeReason = '问家宅以父母爻主屋宅安稳、子孙主兴旺';
  } else if (liuyaoCategory === 'wealth') {
    liuyaoRelative = '妻财';
    liuyaoRelativeReason = '求财投资以妻财为主用神、子孙为财源';
  } else if (liuyaoCategory === 'career') {
    liuyaoRelative = '官鬼';
    liuyaoRelativeReason = '求职升迁与官业以官鬼为主用神、父母为文书印信';
  }

  const rawSynastryTag = matchTagValue(trimmed, '合盘场景') ?? matchTagValue(trimmed, '关系定位');
  const synastryText = rawSynastryTag ?? trimmed;
  let synastryRelationship: SynastryRelationship | undefined;
  if (/(合伙|创业|商业合作|职场|共事|同事|上下级|投资|股东)/.test(synastryText)) {
    synastryRelationship = 'career';
  } else if (/(亲子|育儿|子女|孩子|教育|养育)/.test(synastryText)) {
    synastryRelationship = 'children';
  } else if (/(父母|长辈|孝养|照护)/.test(synastryText)) {
    synastryRelationship = 'parents';
  } else if (/(同胞|手足|兄弟姐妹)/.test(synastryText)) {
    synastryRelationship = 'siblings';
  } else if (/(友人|朋友|闺蜜|知己|同学|合住)/.test(synastryText)) {
    synastryRelationship = 'friendship';
  } else if (/(合婚|恋爱|婚恋|夫妻|婚姻|伴侣|前任|复合|对象|磨合)/.test(synastryText)) {
    synastryRelationship = 'marriage';
  }

  return {
    rawQuestion: trimmed,
    cleanQuestion,
    ...(gender ? { gender } : {}),
    ...(birthYear ? { birthYear } : {}),
    ...(subjectRole ? { subjectRole } : {}),
    ...(lifeStageContext ? { lifeStageContext } : {}),
    ...(timeHorizon ? { timeHorizon } : {}),
    inferredTopic,
    ...(liuyaoCategory ? { liuyaoCategory } : {}),
    ...(liuyaoRelative ? { liuyaoRelative, liuyaoRelativeReason } : {}),
    ...(qimenMatterIntent ? { qimenMatterIntent } : {}),
    ...(synastryRelationship ? { synastryRelationship } : {}),
  };
}
