import type { DivinationDraft } from './engine';

export type DivinationInspirationTabId =
  'spread' | 'special' | 'ganqing' | 'shiye' | 'caifu' | 'renji' | 'rensheng';

export type DivinationInspirationTab = {
  id: Exclude<DivinationInspirationTabId, 'spread' | 'special'>;
  label: string;
};

export type DivinationInspirationSection = {
  heading: string;
  questions: string[];
};

export const DIVINATION_INSPIRATION_TABS: DivinationInspirationTab[] = [
  { id: 'ganqing', label: '感情' },
  { id: 'shiye', label: '事业' },
  { id: 'caifu', label: '财富' },
  { id: 'renji', label: '人际' },
  { id: 'rensheng', label: '成长' },
];

export const DIVINATION_INSPIRATION_CONTENT: Record<
  DivinationInspirationTab['id'],
  DivinationInspirationSection[]
> = {
  ganqing: [
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
      heading: '关系难题',
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
  shiye: [
    {
      heading: '事业发展',
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
      heading: '职场机遇',
      questions: [
        '我近期有没有升职、加薪或拿到机会的可能？',
        '领导现在怎么看我，我还有没有被看见的空间？',
        '我在当前团队或公司里的发展前景怎么样？',
        '这段时间我最该注意的职场风险是什么？',
        '我现在该主动争取，还是先把节奏稳住？',
      ],
    },
    {
      heading: '创业之路',
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
  caifu: [
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
      heading: '投资理财',
      questions: [
        '我现阶段适不适合做投资？',
        '我更适合哪类投资方向或节奏？',
        '这个项目最终能不能带来实际收益？',
        '这次投资最需要防的风险点是什么？',
        '我现在该继续投入，还是先观望？',
        '我接下来该怎么配置，才更稳？',
      ],
    },
    {
      heading: '财务状况',
      questions: [
        '我现在财务紧张的核心原因是什么？',
        '这段时间会不会有明显破财风险？',
        '我最容易在哪一类支出上失控？',
        '我现在最该先堵住哪一个财务漏洞？',
        '接下来该先还债、先储蓄，还是先开源？',
        '如果继续按现在的方式走，财务会怎么发展？',
      ],
    },
  ],
  renji: [
    {
      heading: '社交模式',
      questions: [
        '我当前的人际互动模式，最大的优势和短板是什么？',
        '我现在的人际关系整体处在什么状态？',
        '我更容易吸引来什么样的人？',
        '我在人际里最容易踩到的风险点是什么？',
        '我该怎么做，更容易获得他人的信任和支持？',
        '接下来我最该先调整哪一种沟通方式？',
      ],
    },
    {
      heading: '贵人善缘',
      questions: [
        '什么样的人更可能成为我的贵人？',
        '我现在最该远离哪类消耗型关系？',
        '我该去哪里，或通过什么方式结识更合拍的人？',
        '我该怎样维系一段重要关系，才不容易走散？',
        '我身边这段关系值不值得继续深交？',
        '我现在该怎么做，更容易得到长辈或上级的支持？',
      ],
    },
    {
      heading: '家庭关系',
      questions: [
        '我和家人的关系接下来会怎么变化？',
        '家庭现在对我最大的影响，是支持还是压力？',
        '这段家庭矛盾的核心问题到底是什么？',
        '我现在最该先缓和哪一层关系？',
        '当前家庭关系里最大的风险点是什么？',
        '我该怎么沟通，才更容易让关系缓下来？',
      ],
    },
  ],
  rensheng: [
    {
      heading: '学业规划',
      questions: [
        '我当前的学业或备考状态接下来会怎么走？',
        '我适不适合考研、考公或继续深造？',
        '我现在更适合继续读书，还是先进入工作？',
        '我学习效率上最大的卡点是什么？',
        '我该怎么选专业、方向或学校，才更适合自己？',
        '这次考试或申请最终有没有通过机会？',
      ],
    },
    {
      heading: '个人成长',
      questions: [
        '我当前最值得发挥的优势是什么？',
        '我这一阶段最核心的人生课题是什么？',
        '我现在的人生方向有没有走偏？',
        '我最需要修正的性格短板是什么？',
        '我现在最该先调整哪种状态，才能更稳定？',
        '接下来的人生转折点更可能出现在哪个方向？',
      ],
    },
    {
      heading: '人生机遇',
      questions: [
        '我接下来几年的人生主线会往哪里走？',
        '我现在最值得抓住的机遇是什么？',
        '如果我继续按当前节奏走，后续会怎么发展？',
        '我最需要提前防的风险点是什么？',
        '我现在该先完成哪一步，才更接近目标？',
        '未来一段时间的人生节奏会偏顺，还是偏反复？',
      ],
    },
  ],
};

export const XIAOLIUREN_SPECIAL_INSPIRATION_CONTENT: DivinationInspirationSection[] = [
  {
    heading: '感情速断',
    questions: [
      '这段关系接下来整体会往哪边走？',
      '对方近期对我的态度会不会有变化？',
      '这段关系现在更适合主动推进，还是先缓一缓？',
      '这段关系当前最大的阻力或风险在哪？',
      '这件感情事近期会不会有新消息或转机？',
    ],
  },
  {
    heading: '事业速断',
    questions: [
      '这件事我现在适合继续推进吗？',
      '这件事接下来整体会顺，还是会卡？',
      '我更适合先等等，还是马上行动？',
      '我眼下最大的推进阻力或风险在哪？',
      '近期工作上会不会很快出现转机？',
    ],
  },
  {
    heading: '财富速断',
    questions: [
      '这笔钱我现在适合投入吗？',
      '这件事最后能不能见到实际收益？',
      '这次合作在钱上更偏机会还是风险？',
      '我近期财务压力会不会缓下来？',
      '我现在该继续观望，还是尽快落袋为安？',
    ],
  },
  {
    heading: '人际速断',
    questions: [
      '这次沟通适合直接说开吗？',
      '我和这个人接下来更容易缓和还是起冲突？',
      '当前最大的沟通风险在哪里？',
      '这件事要不要请别人帮我推进？',
      '对方现在是真心配合，还是表面应付？',
    ],
  },
  {
    heading: '趋势速断',
    questions: [
      '我这件事现在最该等，还是最该动？',
      '这件事接下来整体会往好走，还是先反复？',
      '我当下的判断有没有看偏？',
      '我现在最需要先处理哪一个卡点？',
      '继续投入这件事，风险会不会越来越大？',
    ],
  },
];

export const MEIHUA_SPECIAL_INSPIRATION_CONTENT: DivinationInspirationSection[] = [
  {
    heading: '梅花趋势',
    questions: [
      '这件事接下来会怎么发展？',
      '我现在看到的表象和真实走向一致吗？',
      '这件事最关键的转折点会出现在哪里？',
      '当前最大的变数或风险点是什么？',
      '我现在最该先做什么，才更顺？',
    ],
  },
  {
    heading: '梅花关系',
    questions: [
      '我和这个人的关系后面会怎么变化？',
      '对方现在对我的态度，是真靠近还是有保留？',
      '这段关系的主要阻力在我、在对方，还是在外部环境？',
      '我现在主动沟通，会更容易推进还是弄巧成拙？',
      '这段关系短期内会不会有新的互动或消息？',
    ],
  },
  {
    heading: '梅花决策',
    questions: [
      '我现在做这个决定，方向对不对？',
      '这个选择更适合现在的我吗？',
      '我最容易忽略的风险点是什么？',
      '我这一步该先怎么走，才更稳？',
      '继续投入这件事，值不值得？',
    ],
  },
];

export const QIMEN_SPECIAL_INSPIRATION_CONTENT: DivinationInspirationSection[] = [
  {
    heading: '奇门时机',
    questions: [
      '这件事现在是不是合适的行动时机？',
      '我该立刻推进，还是再等一个更好的窗口？',
      '眼下局势里，最值得抓住的机会点是什么？',
      '当前最大的拖延风险或错判点是什么？',
      '这件事短期内会不会出现更顺的时机？',
    ],
  },
  {
    heading: '奇门布局',
    questions: [
      '这件事我该怎么布局，成功率更高？',
      '我现在最该借谁、借哪股势来推进？',
      '当前局面下，我明面推进更好，还是迂回处理更好？',
      '这件事的主要阻力来自哪里，我该怎么绕开？',
      '如果只能先做一件最关键的事，我该先做什么？',
    ],
  },
  {
    heading: '奇门博弈',
    questions: [
      '这次谈判、合作或竞争，谁更占上风？',
      '对方现在更想合作、拖延，还是防备我？',
      '我这次争取这个机会，胜算到底有多大？',
      '当前最大的博弈风险在哪里？',
      '我现在该主动出击，还是先看对方动作？',
    ],
  },
];

export const LIUYAO_TEMPLATE_INSPIRATION_CONTENT: Record<
  Exclude<DivinationDraft['liuyaoTemplate'], 'general'>,
  DivinationInspirationSection[]
> = {
  ganqing: [
    {
      heading: '六爻感情断卦',
      questions: [
        '我们这段关系还有没有推进空间？',
        '对方现在更想靠近我，还是更想保持距离？',
        '这段关系目前最核心的阻力是什么？',
        '我现在适合主动联系，还是先等等？',
        '短期内还有没有新的互动或转机？',
      ],
    },
  ],
  shiye: [
    {
      heading: '六爻事业断卦',
      questions: [
        '这次换工作值不值得动？',
        '这个岗位机会最后能不能成？',
        '我最近事业上的主要阻力卡在哪里？',
        '我现在在工作上更适合推进，还是暂缓观察？',
        '这次面试或升职有没有机会落地？',
      ],
    },
  ],
  caifu: [
    {
      heading: '六爻财运断卦',
      questions: [
        '这笔钱最后能不能到手？',
        '这次合作到底能不能真正赚钱？',
        '这件事接下来会不会有明显破财风险？',
        '我现在适不适合出手投资？',
        '这件事我该求进，还是先守财更稳？',
      ],
    },
  ],
  guaishen: [
    {
      heading: '六爻鬼神断卦',
      questions: [
        '最近家里这股不安感，更像心理压力还是外部冲犯？',
        '这件怪事更像现实因素，还是民俗意义上的干扰？',
        '当前最需要先查的风险点是什么？',
        '这件事有没有必要做净宅、祭祀或化解？',
        '当前我更该先查现实原因，还是再看有没有阴性牵扯？',
      ],
    },
  ],
};

export const LIUREN_TEMPLATE_INSPIRATION_CONTENT: Record<
  Exclude<DivinationDraft['liurenTemplate'], 'general'>,
  DivinationInspirationSection[]
> = {
  ganqing: [
    {
      heading: '大六壬感情断课',
      questions: [
        '这段关系接下来会怎么演变？',
        '对方现在对我是观望、回避，还是想继续推进？',
        '我们之间的症结到底出在谁身上、哪一环？',
        '我现在主动推进这段关系，胜算大吗？',
        '这段关系短期内会不会有消息、见面或转机？',
      ],
    },
  ],
  shiye: [
    {
      heading: '大六壬事业断课',
      questions: [
        '这件工作机会后续会怎么发展？',
        '我这次求职、谈岗或转岗，关键卡点在哪里？',
        '当前局势里，谁会成为推动我事业的关键人物？',
        '我现在更适合立刻行动，还是先等时机成熟？',
        '这件事最后能不能落实成我想要的结果？',
      ],
    },
  ],
  caifu: [
    {
      heading: '大六壬财富断课',
      questions: [
        '这笔财路接下来是顺势见财，还是先有反复？',
        '这次合作或投资，钱最后能不能稳稳落袋？',
        '我眼下的财务压力什么时候会开始缓下来？',
        '这件事里真正的风险点，是人、节奏，还是时机？',
        '我现在该继续投入，还是先收手观望？',
      ],
    },
  ],
};

export const LENORMAND_SPREAD_INSPIRATION_CONTENT: Record<
  DivinationDraft['lenormandSpread'],
  DivinationInspirationSection[]
> = {
  single: [
    {
      heading: '雷诺曼单牌线索',
      questions: [
        '我现在最该看清的核心线索是什么？',
        '眼前这件事真正的突破口在哪里？',
        '这张牌更像提醒我防什么，还是抓什么？',
        '我现在最不该忽略的风险信号是什么？',
        '这件事接下来最值得我先处理的一步是什么？',
      ],
    },
  ],
  three: [
    {
      heading: '雷诺曼三牌事件线',
      questions: [
        '这件事从起因到结果，会怎么一步步发展？',
        '我当前所处的位置，是开局、中段，还是临近结果？',
        '接下来最关键的转折点会出现在哪里？',
        '这件事短期内会不会有明确的新消息或变化？',
        '我现在最该顺着哪条线先推进？',
      ],
    },
  ],
  five: [
    {
      heading: '雷诺曼五牌走势',
      questions: [
        '这件事从现在到结果，中间会经历哪些关键变化？',
        '当前局势里，哪一步最容易成为转折点？',
        '这件事短期内会先顺起来，还是先出现阻力？',
        '我现在最该抓住的机会和最该避开的风险分别是什么？',
        '如果按现在的节奏走下去，结果会更接近哪一种状态？',
      ],
    },
  ],
  relationship: [
    {
      heading: '雷诺曼关系牌阵',
      questions: [
        '我和TA现在的关系真实状态到底是什么？',
        '对方接下来会更靠近我，还是继续拉开距离？',
        '这段关系里最需要被说破的问题是什么？',
        '我们之间还有没有继续发展的机会？',
        '我现在在这段关系里更适合主动，还是先观察？',
      ],
    },
  ],
  decision: [
    {
      heading: '雷诺曼选择牌阵',
      questions: [
        '这两个选项里，哪一个更顺势、更适合现在的我？',
        '如果我选择方案 A，后续最可能怎么发展？',
        '如果我选择方案 B，最大的机会和代价分别是什么？',
        '我现在做这个决定，最容易忽略的风险问题是什么？',
        '这件事我该尽快定下来，还是再等一等信息？',
      ],
    },
  ],
  element: [
    {
      heading: '雷诺曼元素牌阵',
      questions: [
        '这件事的核心动力、阻力和结果分别是什么？',
        '当前局面里，哪一类因素最影响后续走向？',
        '我应该先处理现实条件、情绪关系，还是外部时机？',
        '这个问题里最被低估的一环是什么？',
        '如果想让结果更稳，我现在最该补强哪一块？',
      ],
    },
  ],
  grandTableau: [
    {
      heading: '雷诺曼全景牌阵',
      questions: [
        '请从全局看，我当前人生或这件事的主线是什么？',
        '全景牌阵里最需要优先解读的主题是什么？',
        '当前局面中，哪些长期因素正在影响短期结果？',
        '我接下来一段时间最该注意的人、事和机会是什么？',
        '这个全局走势里，我最适合采取的行动策略是什么？',
      ],
    },
  ],
  nine: [
    {
      heading: '雷诺曼九宫牌阵',
      questions: [
        '这件事的整体局势现在到底是什么样？',
        '我最该优先关注的核心宫位或信号是什么？',
        '当前局面里，表面信息和真实走向有没有反差？',
        '这件事后续是会逐渐清晰，还是还会继续反复？',
        '面对这个局面，我最稳妥的行动顺序应该是什么？',
      ],
    },
  ],
};

export const TAROT_SPREAD_INSPIRATION_QUESTIONS: Record<DivinationDraft['tarotSpread'], string[]> =
  {
    single: [
      '今天我需要关注什么？',
      '我现在最需要的指引是什么？',
      '宇宙想要告诉我什么？',
      '我应该如何面对当前的困惑？',
      '今日的能量指引',
    ],
    three: [
      '我的人生发展趋势如何？',
      '这个问题的来龙去脉是什么？',
      '我的过去如何影响现在和未来？',
      '我应该如何规划接下来的发展？',
      '时间会如何改变我的处境？',
    ],
    love: [
      '我和TA的感情会如何发展？',
      'TA对我的真实想法是什么？',
      '我们的关系现在处于什么状态？',
      '如何改善我们之间的关系？',
      '我的感情生活会有什么变化？',
      '我应该如何表达我的感情？',
      '这段关系值得我继续投入吗？',
      '我们之间的问题如何解决？',
    ],
    career: [
      '我的事业发展前景如何？',
      '我应该换工作吗？',
      '如何在职场中获得更好的发展？',
      '我的职业规划应该如何调整？',
      '这个工作机会适合我吗？',
      '如何提升我的职场竞争力？',
      '我的事业瓶颈如何突破？',
      '什么时候是跳槽的最佳时机？',
    ],
    decision: [
      '我应该选择A还是B？',
      '这两个选择哪个更适合我？',
      '我应该接受这个 offer 吗？',
      '搬家还是留在原地？',
      '继续这段关系还是分手？',
      '创业还是继续打工？',
      '出国还是留在国内发展？',
      '现在投资还是继续观望？',
    ],
  };

export type DivinationSpecialInspiration = {
  label: string;
  sections: DivinationInspirationSection[];
};

type DivinationInspiredDraftPatch = Pick<
  DivinationDraft,
  | 'question'
  | 'questionSource'
  | 'liuyaoTemplate'
  | 'liurenTemplate'
  | 'tarotSpread'
  | 'lenormandSpread'
  | 'meihuaFocus'
  | 'xiaoliurenFocus'
  | 'qimenFocus'
>;

export function getDivinationSpecialInspiration(
  draft: Pick<DivinationDraft, 'method' | 'liuyaoTemplate' | 'liurenTemplate' | 'lenormandSpread'>,
): DivinationSpecialInspiration | null {
  if (draft.method === 'xiaoliuren') {
    return {
      label: '速断',
      sections: XIAOLIUREN_SPECIAL_INSPIRATION_CONTENT,
    };
  }

  if (draft.method === 'meihua') {
    return {
      label: '卦解',
      sections: MEIHUA_SPECIAL_INSPIRATION_CONTENT,
    };
  }

  if (draft.method === 'qimen') {
    return {
      label: '策略',
      sections: QIMEN_SPECIAL_INSPIRATION_CONTENT,
    };
  }

  if (draft.method === 'liuyao' && draft.liuyaoTemplate !== 'general') {
    return {
      label: '断卦',
      sections: LIUYAO_TEMPLATE_INSPIRATION_CONTENT[draft.liuyaoTemplate],
    };
  }

  if (draft.method === 'liuren' && draft.liurenTemplate !== 'general') {
    return {
      label: '断课',
      sections: LIUREN_TEMPLATE_INSPIRATION_CONTENT[draft.liurenTemplate],
    };
  }

  if (draft.method === 'lenormand') {
    return {
      label: '牌阵',
      sections: LENORMAND_SPREAD_INSPIRATION_CONTENT[draft.lenormandSpread],
    };
  }

  return null;
}

export function getDefaultDivinationInspirationTab(
  draft: Pick<DivinationDraft, 'method' | 'liuyaoTemplate' | 'liurenTemplate' | 'lenormandSpread'>,
): DivinationInspirationTabId {
  if (draft.method === 'tarot') {
    return 'spread';
  }

  if (getDivinationSpecialInspiration(draft)) {
    return 'special';
  }

  return 'ganqing';
}

export function isDivinationInspirationTabVisible(
  tabId: DivinationInspirationTabId,
  draft: DivinationDraft,
) {
  if (tabId === 'spread') {
    return draft.method === 'tarot';
  }

  if (tabId === 'special') {
    return Boolean(getDivinationSpecialInspiration(draft));
  }

  return true;
}

export function getDivinationInspirationSections(
  _draft: Pick<
    DivinationDraft,
    'method' | 'tarotSpread' | 'liuyaoTemplate' | 'liurenTemplate' | 'lenormandSpread'
  >,
  tabId: DivinationInspirationTabId,
) {
  if (tabId === 'spread' || tabId === 'special') {
    return [];
  }

  return DIVINATION_INSPIRATION_CONTENT[tabId];
}

function matchQuestion(question: string, sections: DivinationInspirationSection[] | string[]) {
  if (Array.isArray(sections) && typeof sections[0] === 'string') {
    return (sections as string[]).includes(question);
  }

  return (sections as DivinationInspirationSection[]).some((section) =>
    section.questions.includes(question),
  );
}

export function resolveDivinationInspiredDraftPatch(
  current: DivinationDraft,
  question: string,
): DivinationInspiredDraftPatch {
  const next: DivinationInspiredDraftPatch = {
    question,
    questionSource: 'inspiration',
    liuyaoTemplate: current.liuyaoTemplate,
    liurenTemplate: current.liurenTemplate,
    tarotSpread: current.tarotSpread,
    lenormandSpread: current.lenormandSpread,
    meihuaFocus: current.meihuaFocus,
    xiaoliurenFocus: current.xiaoliurenFocus,
    qimenFocus: current.qimenFocus,
  };

  if (current.method === 'liuyao') {
    for (const [template, sections] of Object.entries(LIUYAO_TEMPLATE_INSPIRATION_CONTENT)) {
      if (matchQuestion(question, sections)) {
        next.liuyaoTemplate = template as DivinationDraft['liuyaoTemplate'];
        return next;
      }
    }
  }

  if (current.method === 'liuren') {
    for (const [template, sections] of Object.entries(LIUREN_TEMPLATE_INSPIRATION_CONTENT)) {
      if (matchQuestion(question, sections)) {
        next.liurenTemplate = template as DivinationDraft['liurenTemplate'];
        return next;
      }
    }
  }

  if (current.method === 'tarot') {
    for (const [spread, questions] of Object.entries(TAROT_SPREAD_INSPIRATION_QUESTIONS)) {
      if (matchQuestion(question, questions)) {
        next.tarotSpread = spread as DivinationDraft['tarotSpread'];
        return next;
      }
    }
  }

  if (current.method === 'lenormand') {
    for (const [spread, sections] of Object.entries(LENORMAND_SPREAD_INSPIRATION_CONTENT)) {
      if (matchQuestion(question, sections)) {
        next.lenormandSpread = spread as DivinationDraft['lenormandSpread'];
        return next;
      }
    }
  }

  if (current.method === 'meihua') {
    if (matchQuestion(question, [MEIHUA_SPECIAL_INSPIRATION_CONTENT[0]])) {
      next.meihuaFocus = 'trend';
      return next;
    }
    if (matchQuestion(question, [MEIHUA_SPECIAL_INSPIRATION_CONTENT[1]])) {
      next.meihuaFocus = 'relationship';
      return next;
    }
    if (matchQuestion(question, [MEIHUA_SPECIAL_INSPIRATION_CONTENT[2]])) {
      next.meihuaFocus = 'decision';
      return next;
    }
  }

  if (current.method === 'xiaoliuren') {
    if (matchQuestion(question, [XIAOLIUREN_SPECIAL_INSPIRATION_CONTENT[0]])) {
      next.xiaoliurenFocus = 'emotion';
      return next;
    }
    if (matchQuestion(question, [XIAOLIUREN_SPECIAL_INSPIRATION_CONTENT[1]])) {
      next.xiaoliurenFocus = 'career';
      return next;
    }
    if (matchQuestion(question, [XIAOLIUREN_SPECIAL_INSPIRATION_CONTENT[2]])) {
      next.xiaoliurenFocus = 'wealth';
      return next;
    }
    if (matchQuestion(question, [XIAOLIUREN_SPECIAL_INSPIRATION_CONTENT[3]])) {
      next.xiaoliurenFocus = 'social';
      return next;
    }
    if (matchQuestion(question, [XIAOLIUREN_SPECIAL_INSPIRATION_CONTENT[4]])) {
      next.xiaoliurenFocus = 'trend';
      return next;
    }
  }

  if (current.method === 'qimen') {
    if (matchQuestion(question, [QIMEN_SPECIAL_INSPIRATION_CONTENT[0]])) {
      next.qimenFocus = 'timing';
      return next;
    }
    if (matchQuestion(question, [QIMEN_SPECIAL_INSPIRATION_CONTENT[1]])) {
      next.qimenFocus = 'strategy';
      return next;
    }
    if (matchQuestion(question, [QIMEN_SPECIAL_INSPIRATION_CONTENT[2]])) {
      next.qimenFocus = 'competition';
      return next;
    }
  }

  return next;
}
