export const CHARACTER_STROKE_NOTES: Readonly<Record<string, string>> = {
  万: '“万”本字在《康熙字典》一部为3画；姓名取数按对应繁体“萬”计算。字形笔画方面，《汉语大字典》“萬”为12画，台湾教育部《重编国语辞典修订本》为13画；康熙艸部按6画加部外9画，共15画。姓名五格和三字取数使用15画，字形笔画分别列示。',
};

export const CHARACTER_READING_NOTES: Readonly<
  Record<
    string,
    {
      readings: readonly string[];
      note: string;
      surname: string;
    }
  >
> = {
  乐: {
    readings: ['lè', 'yuè', 'yào'],
    note: 'lè 表愉悦；yuè 用于音乐，也用于姓氏；yào 表喜好，见《论语·雍也》“知者乐水，仁者乐山”。人名读音结合取义与本人用法确定。',
    surname: 'yuè',
  },
  单: {
    readings: ['dān', 'shàn', 'chán', 'dàn'],
    note: 'dān 表单一；shàn 用于单姓；chán 用于“单于”；dàn 是通“殚”的古读。复姓“单于”按词读 chán yú。',
    surname: 'shàn',
  },
  解: {
    readings: ['jiě', 'jiè', 'xiè'],
    note: 'jiě 用于解释、理解；jiè 用于押解、解元；xiè 用于姓氏及解县。姓名读音结合用字位置与取义确定。',
    surname: 'xiè',
  },
  曾: {
    readings: ['céng', 'zēng'],
    note: 'céng 表已经、曾经；zēng 用于姓氏及曾祖、曾孙等亲属称谓。',
    surname: 'zēng',
  },
  仇: {
    readings: ['chóu', 'qiú'],
    note: 'chóu 表仇敌、怨恨；qiú 可表配偶、同类，也用于姓氏。人名读音结合姓氏位置和本人用法确定。',
    surname: 'qiú',
  },
  朴: {
    readings: ['pò', 'pú', 'piáo'],
    note: 'pò 可指树皮或朴树；pú 表质朴，也见姓氏；piáo 亦用于姓氏。姓氏存在 pú、piáo 两种辞典读法，应以本人及家族用法为准。',
    surname: 'pú、piáo',
  },
  柏: {
    readings: ['bó', 'bǎi'],
    note: 'bó 是辞典所列读音并见姓氏用法，bǎi 是通行语音。作为姓氏时存在地区和家族读法差异。',
    surname: 'bó、bǎi',
  },
  查: {
    readings: ['chá', 'zhā'],
    note: 'chá 用于检查、查访；zhā 用于姓氏，也有古代大筏等义。',
    surname: 'zhā',
  },
  区: {
    readings: ['qū', 'ōu', 'gōu'],
    note: 'qū 用于区域、区别；ōu 可作古代容量单位，也用于姓氏；gōu 表弯曲的古义。',
    surname: 'ōu',
  },
  翟: {
    readings: ['zhái', 'dí'],
    note: 'zhái 用于姓氏；dí 可指长尾山雉、古代舞羽，也见古族名和人名用字。',
    surname: 'zhái',
  },
};
