import { isKe, isSheng } from '../wuxing';
import type { Wuxing } from '../wuxing';

export function analyzeNameSancai(input: { tian: number; ren: number; di: number }) {
  const positions = (
    [
      ['tian', '天格'],
      ['ren', '人格'],
      ['di', '地格'],
    ] as const
  ).map(([key, name]) => {
    const value = input[key];
    if (!Number.isSafeInteger(value) || value < 1) throw new Error('三才格数需为正安全整数');
    const tail = value % 10;
    const element = (['水', '木', '木', '火', '火', '土', '土', '金', '金', '水'] as const)[tail];
    return { name, value, tail, element, explanation: `${name}${value}，尾数${tail}属${element}` };
  });
  function relation(left: (typeof positions)[number], right: (typeof positions)[number]) {
    const a: Wuxing = left.element;
    const b: Wuxing = right.element;
    const kind =
      a === b ? '同' : isSheng(a, b) ? '生' : isSheng(b, a) ? '被生' : isKe(a, b) ? '克' : '被克';
    const reverse = kind === '被生' || kind === '被克';
    const source = reverse ? right : left;
    const target = reverse ? left : right;
    const verb = kind === '同' ? '同属' : kind === '生' || kind === '被生' ? '生' : '克';
    return {
      left: left.name,
      right: right.name,
      relation: kind,
      explanation:
        kind === '同'
          ? `${left.name}与${right.name}同属${a}`
          : `${source.name}${source.element}${verb}${target.name}${target.element}`,
    };
  }
  return {
    combo: positions.map((position) => position.element).join(''),
    positions,
    relations: [relation(positions[0], positions[1]), relation(positions[1], positions[2])],
    rule: '三才依次取天格、人格、地格；尾数一二属木、三四属火、五六属土、七八属金、九零属水。',
  };
}

export const NAMING_TRADITION = {
  title: '《左传·桓公六年》命名五法',
  referenceUrl: 'https://ctext.org/text.pl?if=gb&node=17216&remap=gb&show=parallel',
  sourceExcerpt:
    '名有五：有信，有义，有象，有假，有类。以名生为信，以德名为义，以类命为象，取于物为假，取于父为类。',
  methods: [
    { name: '信', meaning: '依据出生时的事实命名。' },
    { name: '义', meaning: '依据品德命名。' },
    { name: '象', meaning: '依据相类的形象或特征命名。' },
    { name: '假', meaning: '借用事物之名。' },
    { name: '类', meaning: '取与父亲相关的命名依据。' },
  ],
  application:
    '现代取名可将出生纪念、品德寄托、意象与事物联想作为构思角度，再核对组合后的语义和日常称呼。辈分字位置依照明确的家庭用字要求处理。',
  context:
    '《礼记·曲礼上》记载古代为子取名的避忌，属于古代礼制语境；现代选字结合家庭习惯与实际称呼判断。',
  lijiSourceExcerpt: '名子者不以国，不以日月，不以隐疾，不以山川。',
  scope:
    '《左传》的命名五法与《礼记》的古代礼文提供历史和命名语境；五格、三才按姓名学数理取象列作参考。字义、读音、字形、出生取用和姓名学数理提供不同角度的参考。',
} as const;

export function formatNamingTradition() {
  return [
    NAMING_TRADITION.title,
    `原文：${NAMING_TRADITION.sourceExcerpt}`,
    NAMING_TRADITION.application,
    `《礼记·曲礼上》原文：${NAMING_TRADITION.lijiSourceExcerpt}`,
    NAMING_TRADITION.scope,
  ].join('\n');
}
