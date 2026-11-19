export interface SchoolAlgorithmEvaluation {
  school: string;
  label: string;
  ruleFocus: string;
  findings: string[];
}

export function formatSchoolAlgorithmSection(items: readonly SchoolAlgorithmEvaluation[]): string {
  if (!items.length) return '';
  return `【流派算法口径核验】\n${items.map((item) => `${item.label}：口径重心＝${item.ruleFocus}；本盘核验：${item.findings.join('；')}。`).join('\n')}`;
}

export function evaluateMeihuaSchoolAlgorithms(
  data: {
    originalName: string;
    interName: string;
    changedName: string;
    tiGua: { name: string; element: string };
    yongGua: { name: string; element: string };
    movingYao: { position: number; text?: string };
    analysis: { tiYongRaw: string; tiSeason?: string };
  },
  schools: readonly ('tiyong' | 'xiangshu' | 'yaoci')[] | undefined,
): SchoolAlgorithmEvaluation[] {
  const unique = [...new Set(schools ?? [])];
  return unique.map((school) => {
    if (school === 'tiyong') {
      return {
        school,
        label: '体用生克派口径',
        ruleFocus: '以体卦为主、用卦为客，核对主/互/变三段生克与月令旺衰',
        findings: [
          `体卦${data.tiGua.name}（${data.tiGua.element}${data.analysis.tiSeason ? `·月令${data.analysis.tiSeason}` : ''}）与用卦${data.yongGua.name}（${data.yongGua.element}）呈「${data.analysis.tiYongRaw}」`,
          `演进链：${data.originalName} → ${data.interName} → ${data.changedName}`,
        ],
      };
    }
    if (school === 'xiangshu') {
      return {
        school,
        label: '象数互变派口径',
        ruleFocus: '重本卦、互卦、变卦的卦象连动与八宫物象取譬',
        findings: [
          `本卦${data.originalName}、互卦${data.interName}、变卦${data.changedName}`,
          `动爻落第${data.movingYao.position}爻，上下卦体用转化由此爻发动`,
        ],
      };
    }
    return {
      school,
      label: '爻辞动变派口径',
      ruleFocus: '结合动爻爻位及《周易》对应动爻爻辞辅助参断',
      findings: [
        `动爻为${data.originalName}第${data.movingYao.position}爻（之卦${data.changedName}）`,
        ...(data.movingYao.text ? [`动爻标志：${data.movingYao.text}`] : []),
      ],
    };
  });
}

export function evaluateLiurenSchoolAlgorithms(
  data: {
    transmissionRule?: string;
    transmissionPattern?: string;
    guaTi?: string[];
    patternTags?: string[];
    xunKong?: string[];
    noblemanBranch?: string;
    threeTransmissions: Array<{ branch: string; god: string; relative?: string }>;
    shenShaFacts?: Array<{ name: string; target: string }>;
  },
  schools: readonly ('keti' | 'bifafu' | 'leishen')[] | undefined,
): SchoolAlgorithmEvaluation[] {
  const unique = [...new Set(schools ?? [])];
  return unique.map((school) => {
    if (school === 'keti') {
      return {
        school,
        label: '九宗门课体派口径',
        ruleFocus: '依九宗门发用传法与课体格局定事态主线',
        findings: [
          `发用取法：${data.transmissionRule ?? '常规取传'}${data.transmissionPattern ? `（${data.transmissionPattern}）` : ''}`,
          `三传：${data.threeTransmissions.map((t) => `${t.branch}(${t.god}${t.relative ? `·${t.relative}` : ''})`).join(' → ')}`,
          ...(data.guaTi?.length ? [`课体：${data.guaTi.join('、')}`] : []),
        ],
      };
    }
    if (school === 'bifafu') {
      return {
        school,
        label: '毕法赋百法派口径',
        ruleFocus: '重四课克贼、初末传向背与日干寄宫生克',
        findings: [
          `初传${data.threeTransmissions[0]?.branch ?? ''}至末传${data.threeTransmissions[2]?.branch ?? ''}，结构标签：${data.patternTags?.slice(0, 6).join('、') || '常规传序'}`,
        ],
      };
    }
    return {
      school,
      label: '类神神煞派口径',
      ruleFocus: '重天将乘神、旬空、贵人及核心神煞落支',
      findings: [
        `贵人临${data.noblemanBranch ?? '未列'}，旬空${data.xunKong?.join('、') || '无'}`,
        ...(data.shenShaFacts?.length ? [`命中神煞：${data.shenShaFacts.slice(0, 5).map((s) => `${s.name}(${s.target})`).join('、')}`] : []),
      ],
    };
  });
}

export function evaluateQimenSchoolAlgorithms(
  data: {
    isYangDun: boolean;
    juShu: number;
    zhiFu: string;
    zhiShi: string;
    voidBranches?: string[];
    horseStar?: string | { palaceName?: string; branch?: string; sourceBranch?: string };
    patternTags?: string[];
    jiuGongGe: Array<{
      name: string;
      tianPan: { star: string; stem: string };
      diPan: { stem: string };
      renPan: { door: string };
      shenPan: { god: string };
    }>;
  },
  schools: readonly ('gongwei' | 'geju' | 'zhuke')[] | undefined,
): SchoolAlgorithmEvaluation[] {
  const unique = [...new Set(schools ?? [])];
  const zhiFuPalace = data.jiuGongGe.find((g) => g.tianPan.star === data.zhiFu);
  const zhiShiPalace = data.jiuGongGe.find((g) => g.renPan.door === data.zhiShi);
  const horseLabel = typeof data.horseStar === 'string'
    ? data.horseStar
    : data.horseStar
      ? `${data.horseStar.palaceName ?? ''}${data.horseStar.branch ? `(${data.horseStar.branch})` : ''}`
      : '无';
  return unique.map((school) => {
    if (school === 'gongwei') {
      return {
        school,
        label: '宫位星门神仪派口径',
        ruleFocus: '逐宫核对九星、八门、八神与天地盘干落宫状态',
        findings: [
          `值符${data.zhiFu}落${zhiFuPalace?.name ?? '待核'}（${zhiFuPalace?.tianPan.stem ?? ''}/${zhiFuPalace?.diPan.stem ?? ''}，${zhiFuPalace?.shenPan.god ?? ''}）`,
          `值使${data.zhiShi}落${zhiShiPalace?.name ?? '待核'}（空亡${data.voidBranches?.join('、') || '无'}，马星${horseLabel}）`,
        ],
      };
    }
    if (school === 'geju') {
      return {
        school,
        label: '吉凶格局派口径',
        ruleFocus: '优先辨别盘面命中的吉格与凶格组合',
        findings: [
          `全局格局：${data.patternTags?.slice(0, 8).join('、') || '未见特殊全局标签'}`,
        ],
      };
    }
    return {
      school,
      label: '主客动静派口径',
      ruleFocus: '以阴阳遁局数、天盘为客、地盘为主及值符值使生克定主客优劣',
      findings: [
        `${data.isYangDun ? '阳遁' : '阴遁'}${data.juShu}局；值符宫（${zhiFuPalace?.name ?? ''}）与值使宫（${zhiShiPalace?.name ?? ''}）分定主客动静`,
      ],
    };
  });
}

export function evaluateZiweiSchoolAlgorithms(
  data: {
    natal: {
      soulBranch: string;
      bodyBranch: string;
      chineseDate: string;
      patterns?: Array<{ name: string; category?: string }>;
      palaces: Array<{
        index: number;
        name: string;
        heavenlyStem: string;
        earthlyBranch: string;
        majorStars: Array<{ name: string; brightness?: string; mutagen?: string }>;
        minorStars: Array<{ name: string; mutagen?: string }>;
        adjectiveStars?: Array<{ name: string }>;
        mutagens?: Array<{ star: string; mutagen: string; targetPalaceName?: string }>;
      }>;
    };
  },
  schools: readonly ('sanhe' | 'feixing' | 'sihua' | 'zhongzhou')[] | undefined,
): SchoolAlgorithmEvaluation[] {
  const unique = [...new Set(schools ?? [])];
  const palaces = data.natal.palaces;
  const mingPalace = palaces.find((p) => p.name === '命宫') ?? palaces[0];
  const birthStem = data.natal.chineseDate.slice(0, 1);

  return unique.map((school) => {
    if (school === 'sanhe') {
      const sanfangIndices = [0, 4, 8, 6].map((offset) => (mingPalace.index + offset) % 12);
      const sanfangSummary = sanfangIndices
        .map((idx) => {
          const p = palaces[idx];
          const stars = p.majorStars.map((s) => `${s.name}${s.brightness ?? ''}`).join('、') || '空宫';
          return `${p.name}(${stars})`;
        })
        .join('；');
      const patternNames = data.natal.patterns?.slice(0, 6).map((p) => p.name).join('、') || '未见特殊格局';
      return {
        school,
        label: '三合派口径',
        ruleFocus: '重命宫三方四正（命/财/官/迁）主星庙旺利陷、吉煞夹拱及格局成败',
        findings: [
          `三方四正主星：${sanfangSummary}`,
          `本命格局：${patternNames}`,
        ],
      };
    }
    if (school === 'feixing') {
      const selfMutagens = palaces
        .flatMap((p) => {
          const stars = [...p.majorStars, ...p.minorStars];
          const hit = p.mutagens?.filter((m) => stars.some((s) => s.name === m.star)) ?? [];
          return hit.map((m) => `${p.name}(${p.heavenlyStem})自化${m.mutagen}(${m.star})`);
        })
        .slice(0, 6);
      return {
        school,
        label: '飞星派口径',
        ruleFocus: '重宫干四化飞星轨迹、离心自化及三方四正禄忌交冲',
        findings: [
          `本命离心自化：${selfMutagens.join('、') || '未见本宫干自化本宫星曜'}`,
        ],
      };
    }
    if (school === 'sihua') {
      const birthMutagens: string[] = [];
      for (const p of palaces) {
        for (const s of [...p.majorStars, ...p.minorStars]) {
          if (s.mutagen) birthMutagens.push(`${s.name}化${s.mutagen}落${p.name}`);
        }
      }
      const laiyinPalace = palaces.find((p) => p.heavenlyStem === birthStem);
      return {
        school,
        label: '钦天四化派口径',
        ruleFocus: '重来因宫立极、生年四化落宫与男女星辰阴阳平衡',
        findings: [
          `生年天干「${birthStem}」对应来因宫：${laiyinPalace ? `${laiyinPalace.name}(${laiyinPalace.heavenlyStem}${laiyinPalace.earthlyBranch})` : '待核'}`,
          `生年四化落宫：${birthMutagens.join('、') || '未见显性生年四化'}`,
        ],
      };
    }
    const isEmptyMing = mingPalace.majorStars.length === 0;
    const oppPalace = palaces[(mingPalace.index + 6) % 12];
    const prevPalace = palaces[(mingPalace.index + 11) % 12];
    const nextPalace = palaces[(mingPalace.index + 1) % 12];
    const adjSummary = [prevPalace, nextPalace]
      .map((p) => `${p.name}[${p.minorStars.map((s) => s.name).slice(0, 3).join('、') || '无辅煞'}]`)
      .join(' 夹 ');
    return {
      school,
      label: '中州派口径',
      ruleFocus: '重安星对宫借星、双星同宫组合、邻宫夹辅与流曜叠冲',
      findings: [
        isEmptyMing
          ? `命宫(${mingPalace.earthlyBranch})为空宫，借对宫${oppPalace.name}(${oppPalace.majorStars.map((s) => s.name).join('、') || '无'})`
          : `命宫(${mingPalace.earthlyBranch})正星：${mingPalace.majorStars.map((s) => s.name).join('、')}`,
        `邻宫夹辅参考：${adjSummary}`,
      ],
    };
  });
}

export function evaluateBazhaiSchoolAlgorithms(
  data: {
    persons: Array<{ gua: string; group: string; year: number | null }>;
    houses: Array<{ sitMountain: string; facingMountain: string; houseGua: string }>;
    comparisons: Array<{
      mingGua: string;
      sitMountain: string;
      houseGua: string;
      match: string;
      directions: Array<{ direction: string; ming: string; mingLuck: string; house: string; houseLuck: string }>;
    }>;
  },
  schools: readonly ('bazhaimingjing' | 'yangzhaisanyao')[] | undefined,
): SchoolAlgorithmEvaluation[] {
  const unique = [...new Set(schools ?? [])];
  const person = data.persons[0];
  const house = data.houses[0];
  const comp = data.comparisons[0];
  return unique.map((school) => {
    if (school === 'bazhaimingjing') {
      return {
        school,
        label: '《八宅明镜》口径',
        ruleFocus: '以人宅命卦与宅卦东四西四相配、游年翻卦四吉四凶为主',
        findings: [
          person ? `命卦${person.gua}（${person.group}）` : '未提供命卦',
          comp ? `与${comp.sitMountain}山${comp.houseGua}宅「${comp.match}」` : house ? `宅卦${house.sitMountain}山${house.houseGua}宅` : '未提供坐山',
        ],
      };
    }
    const houseGood = comp?.directions.filter((d) => d.houseLuck === '吉').map((d) => `${d.direction}(${d.house})`).join('、');
    return {
      school,
      label: '《阳宅三要》口径',
      ruleFocus: '以大门、主房、灶位三要方位五行生克与静宅动变为核验重点',
      findings: [
        house ? `${house.sitMountain}山${house.facingMountain}向（${house.houseGua}宅）` : '未指定坐山，按命卦四吉方参考',
        houseGood ? `宅卦四吉方（宜门/主/灶）：${houseGood}` : '需结合实际门、主卧、灶口方位核对星宫生克',
      ],
    };
  });
}

export function evaluateXuankongSchoolAlgorithms(
  data: {
    charts: Array<{
      period: { yuan: string; yun: number };
      sitMountain: string;
      facingMountain: string;
      mode: string;
      formation: string;
      arrival: { shanToMountain: boolean; xiangToFacing: boolean };
      combinations: readonly { name: string }[];
    }>;
  },
  schools: readonly ('shenshi' | 'wuchang')[] | undefined,
): SchoolAlgorithmEvaluation[] {
  const unique = [...new Set(schools ?? [])];
  const first = data.charts[0];
  return unique.map((school) => {
    if (school === 'shenshi') {
      return {
        school,
        label: '沈氏玄空派口径',
        ruleFocus: '重九星挨排、山向旺衰格局（旺山旺向/上山下水）、令星入囚与组合格局',
        findings: first
          ? [
              `${first.period.yuan}${first.period.yun}运 ${first.sitMountain}山${first.facingMountain}向（${first.mode}）：${first.formation}`,
              `当令到山=${first.arrival.shanToMountain ? '是' : '否'}、到向=${first.arrival.xiangToFacing ? '是' : '否'}；组合：${first.combinations.map((c) => c.name).join('、') || '常规挨星'}`,
            ]
          : ['暂无候选盘面'],
      };
    }
    return {
      school,
      label: '无常派玄空口径',
      ruleFocus: '兼重下卦替卦挨星、城门诀纳气及山向交界跨运校验',
      findings: first
        ? [
            `当前采用「${first.mode}」起星；共产生 ${data.charts.length} 个候选盘面供交界复核`,
          ]
        : ['暂无候选盘面'],
    };
  });
}

export function evaluateAstrolabeSchoolAlgorithms(
  data: {
    basis: { dayChart: boolean; houseSystem: string };
    points: Array<{ name: string; sign: string; house: number; retrograde?: boolean }>;
    distributions: {
      retrograde: Array<{ name: string }>;
    };
    aspects: readonly unknown[];
    flow?: unknown;
  },
  schools: readonly ('modern' | 'traditional' | 'hellenistic' | 'timing')[] | undefined,
): SchoolAlgorithmEvaluation[] {
  const unique = [...new Set(schools ?? [])];
  const outer = data.points
    .filter((p) => ['天王星', '海王星', '冥王星'].includes(p.name))
    .map((p) => `${p.name}落${p.sign}${p.house}宫`)
    .join('、');
  const classical = data.points
    .filter((p) => ['太阳', '月亮', '水星', '金星', '火星', '木星', '土星'].includes(p.name))
    .map((p) => `${p.name}(${p.sign}${p.house}宫${p.retrograde ? '逆' : ''})`)
    .join('、');
  return unique.map((school) => {
    if (school === 'modern') {
      return {
        school,
        label: '现代心理占星口径',
        ruleFocus: '重四元素/三模式分布、外行星（天海冥）代际课题与相位格局',
        findings: [
          `共 ${data.aspects.length} 个本命相位；逆行星体：${data.distributions.retrograde.map((r) => r.name).join('、') || '无'}`,
          `外行星落座：${outer || '未列'}`,
        ],
      };
    }
    if (school === 'traditional') {
      return {
        school,
        label: '传统古典占星口径',
        ruleFocus: '重昼夜盘区分、七大古典星体庙旺陷落、宫主星飞宫与互溶接纳',
        findings: [
          `盘型：${data.basis.dayChart ? '昼盘' : '夜盘'}（${data.basis.houseSystem} 宫位制）`,
          `古典七政：${classical}`,
        ],
      };
    }
    if (school === 'hellenistic') {
      const sectTeam = data.basis.dayChart ? '昼盘阵营（日、木、土得时；火星为夜星易显张力）' : '夜盘阵营（月、金、火得时；土星为昼星易显张力）';
      const fortune = data.points.find((p) => p.name.includes('福点'));
      return {
        school,
        label: '希腊古典占星口径',
        ruleFocus: '重昼夜星体阵营（Sect）、整宫主星与阿拉伯点（福点）定位',
        findings: [
          `昼夜阵营：${sectTeam}`,
          fortune ? `福点落位：${fortune.sign}第${fortune.house}宫` : '福点按已列计算点核对',
        ],
      };
    }
    return {
      school,
      label: '推运时机口径',
      ruleFocus: '依据行运、太阳返照、次限与太阳弧快照核对阶段窗口',
      findings: [
        data.flow ? '已计算指定参考瞬时推运快照，可按实际触及相位论断' : '未提供推运参考时刻，仅限本命结构分析',
      ],
    };
  });
}

export function evaluateTaiyiSchoolAlgorithms(
  data: {
    scope: string;
    taiyiPalace?: number | string;
    lordGeneral?: string | number;
    guestGeneral?: string | number;
    evidenceAnalysis?: {
      calculationSteps: Array<{ key: string; promptText: string }>;
      counterEvidenceFacts: Array<{ promptText: string }>;
    };
  },
  schools: readonly ('zhuke' | 'gongwei' | 'jisuan')[] | undefined,
): SchoolAlgorithmEvaluation[] {
  const unique = [...new Set(schools ?? [])];
  return unique.map((school) => {
    if (school === 'zhuke') {
      return {
        school,
        label: '主客定算派口径',
        ruleFocus: '重主算、客算、定算对比与主客大将、参将胜负态势',
        findings: [
          `主将「${data.lordGeneral ?? '未列'}」 vs 客将「${data.guestGeneral ?? '未列'}」`,
          ...(data.evidenceAnalysis?.calculationSteps.slice(0, 2).map((s) => s.promptText) ?? []),
        ],
      };
    }
    if (school === 'gongwei') {
      return {
        school,
        label: '宫位神将派口径',
        ruleFocus: '重太乙落宫、文昌始击与八门十六神飞布关系',
        findings: [
          `太乙落宫：${data.taiyiPalace ?? '待核'}；计式范围：${data.scope}`,
        ],
      };
    }
    return {
      school,
      label: '积算十六神口径',
      ruleFocus: '重太乙积年/积数推步、十六神落宫及掩迫囚击等反证核验',
      findings: [
        data.evidenceAnalysis?.counterEvidenceFacts.slice(0, 3).map((c) => c.promptText).join('；') || '按十六神常规飞布核对',
      ],
    };
  });
}

export function evaluateJinkoujueSchoolAlgorithms(
  data: {
    positions: {
      renYuan: { stem?: string };
      guiShen: { branch: string; god?: string };
      jiangShen: { branch: string; god?: string };
      diFen: { branch: string };
    };
    movements: Array<{ name: string }>;
    xunKong?: string[];
  },
  schools: readonly ('siwei' | 'fayong' | 'wudong')[] | undefined,
): SchoolAlgorithmEvaluation[] {
  const unique = [...new Set(schools ?? [])];
  return unique.map((school) => {
    if (school === 'siwei') {
      return {
        school,
        label: '四位生克派口径',
        ruleFocus: '重人元、贵神、将神、地分四位上下生克与旺相休囚',
        findings: [
          `四位：人元${data.positions.renYuan.stem ?? ''}、贵神${data.positions.guiShen.branch}(${data.positions.guiShen.god ?? ''})、将神${data.positions.jiangShen.branch}(${data.positions.jiangShen.god ?? ''})、地分${data.positions.diFen.branch}`,
        ],
      };
    }
    if (school === 'fayong') {
      return {
        school,
        label: '发用神煞派口径',
        ruleFocus: '重用爻（将神/贵神）立极取象、入式歌诀及旬空落位',
        findings: [
          `主用将神${data.positions.jiangShen.branch}(${data.positions.jiangShen.god ?? ''})，旬空${data.xunKong?.join('、') || '无'}`,
        ],
      };
    }
    return {
      school,
      label: '五动三动派口径',
      ruleFocus: '重四位间妻动/财动/官动/贼动/鬼动及干支三动定事体发端',
      findings: [
        `命中动象：${data.movements.map((m) => m.name).join('、') || '四位安静，按常规生克论'}`,
      ],
    };
  });
}

export function evaluateXiaoliurenSchoolAlgorithms(
  data: {
    ruleLabel: string;
    sequence: { month: { name: string }; day: { name: string }; hour: { name: string } };
    primary: { name: string };
    ganzhi: { hour: string };
    evidenceAnalysis: {
      sanGongAnalysis: { combinationSummary: string; tiYongRelation: string };
    };
  },
  schools: readonly ('shunshu' | 'gongjue' | 'daoliu')[] | undefined,
): SchoolAlgorithmEvaluation[] {
  const unique = [...new Set(schools ?? [])];
  return unique.map((school) => {
    if (school === 'shunshu') {
      return {
        school,
        label: '顺数三宫传口径',
        ruleFocus: '重月宫（起因）→日宫（过程）→时宫（结果）三段递进演变',
        findings: [
          `三宫路径：${data.sequence.month.name} → ${data.sequence.day.name} → ${data.sequence.hour.name}（${data.ruleLabel}）`,
        ],
      };
    }
    if (school === 'gongjue') {
      return {
        school,
        label: '宫诀体用口径',
        ruleFocus: '重主占时宫歌诀、五行生克及六神方位取象',
        findings: [
          `主占「${data.primary.name}」；${data.evidenceAnalysis.sanGongAnalysis.tiYongRelation}`,
        ],
      };
    }
    return {
      school,
      label: '道家小六壬口径',
      ruleFocus: '兼重三宫五行生克链与起课时干支（${data.ganzhi.hour}时）地支引动',
      findings: [
        `起课时柱「${data.ganzhi.hour}」；${data.evidenceAnalysis.sanGongAnalysis.combinationSummary}`,
      ],
    };
  });
}

export function evaluateTarotSchoolAlgorithms(
  data: {
    spreadName: string;
    cards: Array<{ id: number; name: string; position: string; reversed: boolean; element: string }>;
  },
  schools: readonly ('rws' | 'yuansu' | 'narrative' | 'marseille')[] | undefined,
): SchoolAlgorithmEvaluation[] {
  const unique = [...new Set(schools ?? [])];
  const majorCount = data.cards.filter((c) => c.id <= 22).length;
  const reversedCount = data.cards.filter((c) => c.reversed).length;
  const elementCounts = data.cards.reduce<Record<string, number>>((acc, c) => {
    acc[c.element] = (acc[c.element] ?? 0) + 1;
    return acc;
  }, {});
  const elementSummary = Object.entries(elementCounts).map(([k, v]) => `${k}${v}张`).join('、');

  return unique.map((school) => {
    if (school === 'rws') {
      return {
        school,
        label: '韦特（RWS）体系口径',
        ruleFocus: '重图像象征、牌位职能与正逆位张力平衡',
        findings: [
          `${data.spreadName}共 ${data.cards.length} 张（大阿卡纳 ${majorCount} 张，逆位 ${reversedCount} 张）`,
        ],
      };
    }
    if (school === 'yuansu') {
      return {
        school,
        label: '四元素能量派口径',
        ruleFocus: '重火土风水四元素比例、缺失元素与相邻牌生克增减',
        findings: [
          `元素分布：${elementSummary || '待核'}`,
        ],
      };
    }
    if (school === 'narrative') {
      return {
        school,
        label: '叙事串联派口径',
        ruleFocus: '重牌序起承转合、人物视线与关键转折牌位呼应',
        findings: [
          `叙事序列：${data.cards.map((c) => `${c.position}[${c.name}${c.reversed ? '逆' : ''}]`).join(' → ')}`,
        ],
      };
    }
    return {
      school,
      label: '马赛（Marseille）传统口径',
      ruleFocus: '重大小阿卡纳结构比例、数字牌阶梯升降与传统对称排布',
      findings: [
        `大牌占比 ${majorCount}/${data.cards.length}，小牌/宫廷 ${data.cards.length - majorCount} 张；按数字阶梯与几何位置参断`,
      ],
    };
  });
}

export function evaluateLenormandSchoolAlgorithms(
  data: {
    spreadType: string;
    cards: Array<{ id: number; name: string; position: string; house?: string }>;
  },
  combinationsCount: number,
  schools: readonly ('combination' | 'eventline' | 'significator')[] | undefined,
): SchoolAlgorithmEvaluation[] {
  const unique = [...new Set(schools ?? [])];
  return unique.map((school) => {
    if (school === 'combination') {
      return {
        school,
        label: '双牌组合派口径',
        ruleFocus: '重相邻牌「主体+修饰」直接叠加与固定组合词典',
        findings: [
          `共生成 ${combinationsCount} 组邻牌/镜像组合`,
        ],
      };
    }
    if (school === 'eventline') {
      return {
        school,
        label: '事件线叙事口径',
        ruleFocus: '重牌阵从左至右的现实事件因果推进与终局落点',
        findings: [
          `事件链：${data.cards.map((c) => `${c.name}(#${c.id})`).join(' → ')}`,
        ],
      };
    }
    const sig = data.cards.find((c) => c.id === 28 || c.id === 29);
    return {
      school,
      label: '指示牌定位口径',
      ruleFocus: '重指示牌（28绅士/29淑女或主题牌）所在宫位与前后远近距离',
      findings: [
        sig ? `指示牌落位：${sig.name}在${sig.position}${sig.house ? `（${sig.house}宫）` : ''}` : '未抽中28/29人物牌，以中心牌或第一张为主题指示',
      ],
    };
  });
}

export function evaluateWuyunSchoolAlgorithms(
  result: {
    yearGanZhi?: string;
    annualMovement: { name: string; element: string; excess?: string };
    sitian: { name: string };
    zaiquan: { name: string };
  },
  schools: readonly ('yunqi' | 'sitian' | 'kezhu')[] | undefined,
): SchoolAlgorithmEvaluation[] {
  const unique = [...new Set(schools ?? [])];
  return unique.map((school) => {
    if (school === 'yunqi') {
      return {
        school,
        label: '岁运太过不及口径',
        ruleFocus: '重岁干定大运（太过/不及/平气）与五行胜复规律',
        findings: [
          `${result.yearGanZhi ? `${result.yearGanZhi}年` : '当年'}岁运：${result.annualMovement.name}（${result.annualMovement.element}${result.annualMovement.excess ? `·${result.annualMovement.excess}` : ''}）`,
        ],
      };
    }
    if (school === 'sitian') {
      return {
        school,
        label: '司天在泉口径',
        ruleFocus: '重上半年司天之气与下半年在泉之气的气候病候主调',
        findings: [
          `司天「${result.sitian.name}」／在泉「${result.zaiquan.name}」`,
        ],
      };
    }
    return {
      school,
      label: '主客加临口径',
      ruleFocus: '重五步主客运与六步主客气的顺逆相得、相临相制',
      findings: [
        `以年度六步主客气逐段核对当令客气对主气之加临生克`,
      ],
    };
  });
}

export function evaluateAlmanacSchoolAlgorithms(
  data: {
    recommendations: { preferredDays: Array<{ date: string }>; cautionDays: Array<{ date: string }> };
    days: Array<{ date: string }>;
  },
  schools: readonly ('xiejibianfang' | 'tongshu')[] | undefined,
): SchoolAlgorithmEvaluation[] {
  const unique = [...new Set(schools ?? [])];
  return unique.map((school) => {
    if (school === 'xiejibianfang') {
      return {
        school,
        label: '《协纪辨方书》正统口径',
        ruleFocus: '严格区分正统建除、黄黑道与值日神煞，剔除无典据民间忌日干扰',
        findings: [
          `范围共 ${data.days.length} 天：正统初筛优选 ${data.recommendations.preferredDays.length} 天、慎用 ${data.recommendations.cautionDays.length} 天`,
        ],
      };
    }
    return {
      school,
      label: '民间通书民俗口径',
      ruleFocus: '在正统神煞外兼顾三娘煞、杨公忌、十恶大败等民间通书忌日',
      findings: [
        `已一并标出民俗忌神命中日期，供长辈或传统习俗场景避让参考`,
      ],
    };
  });
}

export function evaluateQizhengSchoolAlgorithms(
  data: {
    mingGong: number;
    mingZhu: string;
    mingDu: { xiu: string; xiuDegree: number; duZhu: string };
    shensha: { stars: Array<{ name: string }> };
    enNan: { enStars: string[]; nanStars: string[] };
  },
  schools: readonly ('guolao' | 'qintang')[] | undefined,
): SchoolAlgorithmEvaluation[] {
  const unique = [...new Set(schools ?? [])];
  return unique.map((school) => {
    if (school === 'guolao') {
      return {
        school,
        label: '《果老星宗》口径',
        ruleFocus: '重神煞化曜（禄勋/天官/马元等）、恩难仇用生克与限度行年',
        findings: [
          `命主「${data.mingZhu}」，恩星(${data.enNan.enStars.join('、')})、难星(${data.enNan.nanStars.join('、')})；已列神煞 ${data.shensha.stars.length} 项`,
        ],
      };
    }
    return {
      school,
      label: '《琴堂指要》口径',
      ruleFocus: '重命度宿度浅深、度主星格与诸星庙旺升殿吊照',
      findings: [
        `命度「${data.mingDu.xiu}宿${data.mingDu.xiuDegree.toFixed(2)}°」（度主${data.mingDu.duZhu}）`,
      ],
    };
  });
}
