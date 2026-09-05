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
  methods: [
    { name: '信', meaning: '联系真实的出生情境或纪念事实，使名字有所记。' },
    { name: '义', meaning: '以品德和志向寄托期许，使名字有所守。' },
    { name: '象', meaning: '借相似的形象表达联想，使名字有所象。' },
    { name: '假', meaning: '借取事物之名寄托意义，使名字有所托。' },
    { name: '类', meaning: '联系与父辈相类的事实，理解家族纪念的命名方式。' },
  ],
  application:
    '起名时可分别考虑纪念事实、品德志向与事物意象，再核对组合后的语义和日常称呼。家族纪念与辈分字位置依照明确的家庭用字要求处理。',
  context:
    '《礼记·曲礼上》的名讳规范处于古代礼制语境；现代选字结合家庭习惯与实际称呼判断。字义、读音、字形、出生取用和三才五格分别提供不同角度的参考。',
} as const;

export function formatNamingTradition() {
  return [
    NAMING_TRADITION.title,
    ...NAMING_TRADITION.methods.map((method) => `${method.name}：${method.meaning}`),
    NAMING_TRADITION.application,
    NAMING_TRADITION.context,
    '康熙笔画用于五格的字形计数；三才按天格、人格、地格的尾数五行组成；出生四柱用于讨论命局取用；逐字释义与全名语境用于核对实际含义。',
  ].join('\n');
}
