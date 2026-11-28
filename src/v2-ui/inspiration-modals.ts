import { openQuestionInspirationSession } from '../app/modal-bus';
import { type Method } from '../schema';

export type QuestionInspirationFilter = {
  label: string;
  value: string;
};

export type QuestionInspirationItem = {
  id: string;
  question: string;
  tag?: string;
};

export type QuestionInspirationSection = {
  id: string;
  heading?: string;
  items: QuestionInspirationItem[];
};

export type SupplementaryInfoValues = {
  gender: '' | '男' | '女';
  birthYear: string;
  subjectRole: '' | '自己' | '伴侣对象' | '家人长辈' | '子女晚辈' | '职场合作方';
  lifeStageContext: string;
  compatRelationshipLabel?: string;
  timeHorizon: '' | '近期几天' | '一三个月' | '半年一年' | '长期走向';
  userSupplement: string;
  currentSituation: string;
  currentState: string;
  knownFacts: string;
  desiredOutcome: string;
  constraints: string;
};

export const DEFAULT_SUPPLEMENTARY_VALUES: SupplementaryInfoValues = {
  gender: '',
  birthYear: '',
  subjectRole: '',
  lifeStageContext: '',
  timeHorizon: '',
  userSupplement: '',
  currentSituation: '',
  currentState: '',
  knownFacts: '',
  desiredOutcome: '',
  constraints: '',
};

export type InspirationCategoryId =
  | 'special'
  | 'marriage'
  | 'career'
  | 'wealth'
  | 'study'
  | 'health-travel'
  | 'lost-found'
  | 'interpersonal';

export const INSPIRATION_CATEGORIES: ReadonlyArray<{
  id: Exclude<InspirationCategoryId, 'special'>;
  label: string;
}> = [
  { id: 'marriage', label: '感情婚姻' },
  { id: 'career', label: '事业职场' },
  { id: 'wealth', label: '财运投资' },
  { id: 'study', label: '学业考试' },
  { id: 'health-travel', label: '健康出行' },
  { id: 'lost-found', label: '失物寻人' },
  { id: 'interpersonal', label: '人际家宅' },
];

export const INSPIRATION_LIBRARY: Record<
  Exclude<InspirationCategoryId, 'special'>,
  ReadonlyArray<{ heading: string; questions: readonly string[] }>
> = {
  marriage: [
    {
      heading: '情感发展',
      questions: [
        '这段关系接下来会怎么发展？',
        '对方现在对我的真实态度是什么？',
        '这段关系当前最大的阻力是什么？',
        '我现在更适合主动推进，还是先观察？',
        '短期内会不会有新的互动或转机？',
        '这段感情继续投入值不值得？',
      ],
    },
    {
      heading: '正缘婚姻',
      questions: [
        '我的正缘大概会在什么阶段出现？',
        '我更容易遇到什么类型的伴侣？',
        '我现在离稳定关系还有多远？',
        '现在这位对象适不适合走向长期？',
        '这段关系走向婚姻的主要风险是什么？',
        '我该怎样调整自己，更容易进入正缘关系？',
      ],
    },
    {
      heading: '关系难题与复合',
      questions: [
        '我们之间的问题核心到底是什么？',
        '这次矛盾后还有没有修复空间？',
        '如果我继续坚持这段关系，后续会怎么发展？',
        '我现在最该先处理哪一个关系卡点？',
        '这段关系最大的风险是误会、距离，还是价值观不合？',
        '我该继续挽回，还是及时止损？',
      ],
    },
  ],
  career: [
    {
      heading: '事业发展与去留',
      questions: [
        '我现在这份工作或方向，还适不适合继续走？',
        '这条事业路线接下来会怎么发展？',
        '我现在适合跳槽，还是继续坚守？',
        '我当前事业上的关键助力会来自哪里？',
        '眼下最大的事业阻力或风险是什么？',
        '我接下来最该先推进哪一步？',
      ],
    },
    {
      heading: '职场机遇与晋升',
      questions: [
        '我近期有没有升职、加薪或拿到机会的可能？',
        '领导现在怎么看我，我还有没有被看见的空间？',
        '我在当前团队或公司里的发展前景怎么样？',
        '这段时间我最该注意的职场风险是什么？',
        '我现在该主动争取，还是先把节奏稳住？',
        '这次面试或调岗最终能不能顺利成行？',
      ],
    },
    {
      heading: '创业与合作',
      questions: [
        '我现阶段适不适合创业？',
        '这个创业方向后续有没有发展空间？',
        '我该找什么类型的人合作，才更稳？',
        '这个项目当前最大的风险点在哪里？',
        '我现在适合正式启动，还是先继续验证？',
        '如果我做下去，结果更偏成，还是偏反复？',
      ],
    },
  ],
  wealth: [
    {
      heading: '财运趋势',
      questions: [
        '我近期的财运整体会怎么走？',
        '我更适合靠哪种方式持续赚钱？',
        '眼下最容易出现的财务机会在哪里？',
        '我目前最大的破财风险是什么？',
        '我现在更适合求进，还是先守财？',
        '短期内有没有额外进账或偏财机会？',
      ],
    },
    {
      heading: '投资理财与交易',
      questions: [
        '我现阶段适不适合做这笔投资？',
        '这个项目最终能不能带来实际收益？',
        '这次投资最需要防的风险点是什么？',
        '我现在该继续投入，还是先观望落袋为安？',
        '这笔尾款或借款最终能不能顺利收回？',
        '这次买卖交易的价格与时机是否合适？',
      ],
    },
    {
      heading: '财务状况改善',
      questions: [
        '我现在财务紧张的核心原因是什么？',
        '这段时间会不会有明显破财风险？',
        '我现在最该先堵住哪一个财务漏洞？',
        '接下来该先还债、先储蓄，还是先开源？',
      ],
    },
  ],
  study: [
    {
      heading: '考试与升学',
      questions: [
        '这次考试或申请最终有没有通过机会？',
        '我当前的学业或备考状态接下来会怎么走？',
        '我适不适合考研、考公或继续深造？',
        '我现在更适合继续读书，还是先进入工作？',
        '我学习效率上最大的卡点是什么？',
        '我该怎么选专业、方向或学校，才更适合自己？',
      ],
    },
    {
      heading: '资格证与文书',
      questions: [
        '这次职称评审或证书考核能不能顺利过关？',
        '我的论文、报告或作品送审会不会顺利？',
        '在备考冲刺阶段我最该重点补强哪一块？',
        '今年在学业进修上会不会遇到良师或贵人？',
      ],
    },
  ],
  'health-travel': [
    {
      heading: '身心状态与调养',
      questions: [
        '我近期身心状态最需要注意和调养的重点是什么？',
        '最近总是疲惫焦虑，核心消耗源在哪里？',
        '这次身体不适或调理方向是否对路，恢复节奏如何？',
        '家人的健康状态近期需要注意哪些方面？',
      ],
    },
    {
      heading: '出行与远行变动',
      questions: [
        '这次出行、出差或旅行整体是否平安顺遂？',
        '近期去外地发展或搬迁，时机是否成熟？',
        '行程中需要注意哪些延误或突发状况？',
        '换一个城市生活或工作，会带来更好的转机吗？',
      ],
    },
  ],
  'lost-found': [
    {
      heading: '失物寻找',
      questions: [
        '丢失的物品还能不能找回来？',
        '失物目前最可能遗落在哪个方位或场所？',
        '物品是被自己放忘了，还是在移动途中遗失了？',
        '什么时候更有可能收到失物的线索或找回？',
      ],
    },
    {
      heading: '寻人与消息联络',
      questions: [
        '失去联系的人近期会不会有消息传来？',
        '想要约见或寻找的贵人，现在好不好联系上？',
        '宠物走失了，往哪个方向找更有希望？',
        '正在等待的通知或答复，什么时候能有准信？',
      ],
    },
  ],
  interpersonal: [
    {
      heading: '人际与贵人',
      questions: [
        '什么样的人更可能成为我的贵人？',
        '我现在最该远离哪类消耗型关系？',
        '这次沟通适合直接说开，还是委婉过渡？',
        '对方现在是真心配合，还是表面应付？',
        '我身边这段合作或朋友关系值不值得继续深交？',
      ],
    },
    {
      heading: '家庭与居住环境',
      questions: [
        '我和家人的关系接下来会怎么变化？',
        '这段家庭矛盾的核心问题到底是什么，该如何缓和？',
        '这套房子或办公空间整体气场与我是否相合？',
        '近期搬家、装修或调整布局，需要注意什么问题？',
      ],
    },
  ],
};

export const METHOD_SPECIAL_INSPIRATION: Partial<
  Record<Method, { label: string; sections: ReadonlyArray<{ heading: string; questions: readonly string[] }> }>
> = {
  qimen: {
    label: '奇门策略',
    sections: [
      {
        heading: '奇门时机与布局',
        questions: [
          '这件事现在是不是合适的行动时机？',
          '我该立刻推进，还是再等一个更好的窗口？',
          '这件事我该怎么布局，成功率更高？',
          '当前局面下，我明面推进更好，还是迂回处理更好？',
          '这次谈判、合作或竞争，谁更占上风？',
        ],
      },
    ],
  },
  liuren: {
    label: '六壬断课',
    sections: [
      {
        heading: '四课三传演变',
        questions: [
          '这件事从发端到最终结果会如何一步步演变？',
          '当前局势里的核心症结与关键人物是谁？',
          '我现在更适合立刻行动，还是先等时机成熟？',
          '这件事最后能不能落实成我想要的结果？',
        ],
      },
    ],
  },
  jinkoujue: {
    label: '四位主客',
    sections: [
      {
        heading: '主客判断与落点',
        questions: [
          '这件事当前谁更占主动？',
          '对方现在是配合还是牵制？',
          '当前最大的卡点落在人、事，还是场合？',
          '这件事适合硬推进，还是先换路径？',
        ],
      },
    ],
  },
  xiaoliuren: {
    label: '掌诀速断',
    sections: [
      {
        heading: '吉凶速断',
        questions: [
          '这件事我现在适合继续推进吗？',
          '这件事接下来整体会顺，还是会卡？',
          '我这件事现在最该等，还是最该动？',
          '近期这件事会不会很快出现新消息或转机？',
        ],
      },
    ],
  },
  meihua: {
    label: '体用卦解',
    sections: [
      {
        heading: '体用生克与趋势',
        questions: [
          '这件事接下来会怎么发展？',
          '我现在看到的表象和真实走向一致吗？',
          '这件事最关键的转折点会出现在哪里？',
          '我现在做这个决定，方向对不对？',
        ],
      },
    ],
  },
  tarot: {
    label: '牌阵专属',
    sections: [
      {
        heading: '塔罗牌面指引',
        questions: [
          '今天或近期我最需要关注的能量指引是什么？',
          '这个问题的过去成因、现状核心与未来走向是什么？',
          '我和TA在关系中的真实想法与潜在阻碍是什么？',
          '面对当前的两个选择，各自的发展结果与建议是什么？',
        ],
      },
    ],
  },
  lenormand: {
    label: '雷诺曼线索',
    sections: [
      {
        heading: '现实事件与消息线',
        questions: [
          '我现在最该看清的核心现实线索是什么？',
          '这件事从起因到结果，会怎么一步步发展？',
          '这件事短期内会不会有明确的新消息或变化？',
          '当前局面里最不该忽略的风险信号是什么？',
        ],
      },
    ],
  },
  almanac: {
    label: '择日偏好',
    sections: [
      {
        heading: '择日常见要求',
        questions: [
          '请筛选近期适合搬家入宅的黄道吉日，优先周末上午。',
          '请比较这段时间内适合领证嫁娶的吉日，避开冲煞。',
          '近期准备开业启动，哪些日子气场更稳、适合纳财？',
          '打算签约合作，请挑选人际和谐、利于文书落实的日期。',
        ],
      },
    ],
  },
  bazhai: {
    label: '八宅方位',
    sections: [
      {
        heading: '命宅相配与布局',
        questions: [
          '我的命卦与这套住宅的坐向是否相配，吉凶方位如何分布？',
          '主卧、书房与大门落在当前方位需要注意什么？',
          '如何在现有户型中优先利用生气、天医、延年吉方？',
        ],
      },
    ],
  },
  xuankong: {
    label: '飞星挨星',
    sections: [
      {
        heading: '宅运与流年飞星',
        questions: [
          '当前运盘下山星与向星的旺衰格局如何，是否到山到向？',
          '大门与主活动区在当运和流年飞星组合下有什么特点？',
          '今年流年紫白飞星引动了哪些宫位，布局上该如何顺应？',
        ],
      },
    ],
  },
  residential: {
    label: '住宅合参',
    sections: [
      {
        heading: '八宅与玄空分层合参',
        questions: [
          '请结合八宅命宅关系与玄空飞星盘，综合分析这套住宅的格局重点。',
          '大门、主卧、厨房与书房在人宅适配和理气飞星上有哪些共同关注点？',
          '在不改动承重结构的前提下，居家动线与常驻位置该如何优化？',
        ],
      },
    ],
  },
};

export function getSpecialInspirationForMethod(method: Method) {
  return METHOD_SPECIAL_INSPIRATION[method];
}

export function openQuestionInspirationModal(options: {
  method?: Method;
  selectedQuestion?: string;
  onSelect: (question: string) => void;
}): void {
  openQuestionInspirationSession(options);
}

export function formatSupplementaryAppendix(values: Partial<SupplementaryInfoValues>): string {
  const parts: string[] = [];
  const personMeta = [
    values.compatRelationshipLabel?.trim() ? `合盘场景：${values.compatRelationshipLabel.trim()}` : '',
    values.gender?.trim() ? `性别：${values.gender.trim()}` : '',
    values.birthYear?.trim() ? `出生年：${values.birthYear.trim()}年` : '',
    values.subjectRole?.trim() ? `所问对象：${values.subjectRole.trim()}` : '',
    values.lifeStageContext?.trim() ? `当前处境：${values.lifeStageContext.trim()}` : '',
    values.timeHorizon?.trim() ? `关注周期：${values.timeHorizon.trim()}` : '',
  ]
    .filter(Boolean)
    .join('｜');
  if (personMeta) parts.push(`【求测背景】${personMeta}`);
  if (values.userSupplement?.trim()) parts.push(`【现状与已知前提】${values.userSupplement.trim()}`);
  if (values.currentSituation?.trim()) parts.push(`【当前情况】${values.currentSituation.trim()}`);
  if (values.currentState?.trim()) parts.push(`【当前状态】${values.currentState.trim()}`);
  if (values.knownFacts?.trim()) parts.push(`【已知事实】${values.knownFacts.trim()}`);
  if (values.desiredOutcome?.trim()) parts.push(`【期望结果】${values.desiredOutcome.trim()}`);
  if (values.constraints?.trim()) parts.push(`【期望目标与现实限制】${values.constraints.trim()}`);
  return parts.join('\n');
}
