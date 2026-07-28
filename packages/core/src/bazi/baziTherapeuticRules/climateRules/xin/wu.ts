import type { ClimateRule } from '../../types';

export const XIN_WU_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'wu-month-xin-ren-ji-visible-hidden-gui',
    label: '辛日午月壬己两透支见癸显达规则',
    description:
      '辛金生午月，若壬己两透，而癸水只在地支暗见且不落子支冲月，较合原文"壬己两透，支见癸水，不冲，定主显达"；此类既得湖海润沙，又有余润潜藏，不应仍按普通夏辛己壬并用泛断。',
    months: ['午'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['壬', '己'],
    requiredHiddenStems: ['癸'],
    forbiddenVisibleStems: ['癸'],
    forbiddenBranchPillarPairs: [
      {
        branch: '子',
      },
    ],
    usefulWuxing: '水',
    favorableOrder: ['水', '土'],
    traceHints: ['取用层次:壬己两透，支见癸水而不冲', '成格层次:定主显达'],
    hint: '辛金午月壬己两透而支见癸水不冲，多主显达',
  },
  {
    id: 'wu-month-xin-ren-visible-ji-hidden-gui-page',
    label: '辛日午月壬透己藏支见癸廪贡规则',
    description:
      '辛金生午月，若壬水透干，而己土不透只藏支内，地支又见癸水且不落子支冲月，层次虽低于壬己两透，仍较合原文"即己藏支，亦有廪贡"之意，不应退回普通午月辛金。',
    months: ['午'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['壬'],
    requiredHiddenStems: ['己', '癸'],
    forbiddenVisibleStems: ['己', '癸'],
    forbiddenBranchPillarPairs: [
      {
        branch: '子',
      },
    ],
    usefulWuxing: '水',
    favorableOrder: ['水', '土'],
    traceHints: ['取用层次:壬透而己藏支，兼见癸水不冲', '成格层次:亦有廪贡'],
    hint: '辛金午月壬透、己藏支而支见癸水不冲，亦主廪贡',
  },
  {
    id: 'wu-month-xin-gui-geng-no-ren-grace',
    label: '辛日午月癸出有庚衣锦规则',
    description:
      '辛金生午月，无壬而癸出，本已较壬力浅；但若再得庚金发源，较合原文"癸出有庚，必主衣锦，叨受恩荣"，不应仍与普通癸水权代或无壬异途同断。',
    months: ['午'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['癸', '庚'],
    maxStemTotalCounts: {
      壬: 0,
    },
    usefulWuxing: '金',
    favorableOrder: ['金', '水'],
    traceHints: ['取用层次:无壬而癸出有庚', '成格层次:衣锦恩荣'],
    hint: '辛金午月无壬而癸透又见庚，多主衣锦恩荣',
  },
  {
    id: 'wu-month-xin-no-ren-gui-wu-with-companion',
    label: '辛日午月无壬癸戊并见有辛不孤规则',
    description:
      '辛金生午月，若无壬而癸戊并见，本属燥泥埋金；但若天干再有一二重辛金比肩，较合原文"有一二重比肩，不致孤独"，仍主僧道之流，只是孤寒之象稍减，不应仍按全无比肩孤独论。',
    months: ['午'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['癸', '戊'],
    forbiddenVisibleStems: ['庚'],
    maxStemTotalCounts: {
      壬: 0,
    },
    minVisibleStemCounts: {
      辛: 2,
    },
    maxVisibleStemCounts: {
      辛: 3,
    },
    usefulWuxing: '水',
    favorableOrder: ['水', '土'],
    traceHints: ['破格因素:无壬而癸见戊', '成格层次:僧道之流', '成格转轻:一二比肩，不致孤独'],
    hint: '辛金午月无壬而癸戊并见，若再有一二重辛金，则僧道而不孤',
  },
  {
    id: 'wu-month-xin-no-ren-gui-wu-monastic',
    label: '辛日午月无壬癸戊并见僧道规则',
    description:
      '辛金生午月，若无壬而癸见戊，虽有午中己土亦成燥泥成灰，较合原文"癸见戊，虽有午宫己土，燥泥成灰，金必煆熔，反遭埋没，必为僧道"，不应仍误提到恩荣层次。',
    months: ['午'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['癸', '戊'],
    forbiddenVisibleStems: ['庚'],
    maxStemTotalCounts: {
      壬: 0,
    },
    usefulWuxing: '水',
    favorableOrder: ['水', '土'],
    traceHints: ['破格因素:无壬而癸见戊', '成格层次:僧道之流'],
    hint: '辛金午月无壬而癸见戊，多主僧道',
  },
  {
    id: 'wu-month-xin-no-ren-ji-visible-alt-path',
    label: '辛日午月无壬有己异途规则',
    description:
      '辛金生午月，壬水为正用；若全局并无壬水而唯见己土透干，较合原文"无壬有己，须得异途"，只能在旁门别径中求取层次，不应仍按壬己并用显达论。',
    months: ['午'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['己'],
    forbiddenVisibleStems: ['癸'],
    maxStemTotalCounts: {
      壬: 0,
    },
    usefulWuxing: '土',
    favorableOrder: ['土', '水'],
    traceHints: ['破格因素:无壬正用，仅见己土', '成格层次:须得异途'],
    hint: '辛金午月无壬而己透，多主异途进身',
  },
  {
    id: 'wu-month-xin-no-ren-gui-weak-substitute',
    label: '辛日午月无壬癸权代规则',
    description:
      '辛金生午月，壬水本为正用；若壬水不见而癸水透出，局中仍存己土承接，则可按原文"无壬，癸亦可用，但癸力小"作权代处理。此类可用而不及壬水正用，不应仍停留在泛化夏金先水的粗判断。',
    months: ['午'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['癸'],
    forbiddenVisibleStems: ['庚', '戊'],
    maxStemTotalCounts: {
      壬: 0,
    },
    minStemTotalCounts: {
      己: 1,
    },
    usefulWuxing: '水',
    favorableOrder: ['水', '土'],
    traceHints: ['取用层次:无壬而癸透，可权代为用', '成格层次:癸力小，不及壬水正用'],
    hint: '辛金午月无壬而癸透，若仍有己土承接，可作权代之用',
  },
  {
    id: 'wu-month-xin-fire-formation-ren-break-fire',
    label: '辛日午月火局壬透破火生员规则',
    description:
      '辛金生午月，若地支火局已成，即便癸水重见，亦难济烈火；必须壬水透干破火，方较合原文"得壬透破火方可，必主生员"之旨，不应仍把癸水权代误当足用。',
    months: ['午'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredFormationWuxings: ['火'],
    requiredVisibleStems: ['壬'],
    usefulWuxing: '水',
    favorableOrder: ['水', '土'],
    traceHints: ['取用层次:支成火局，须壬透破火', '成格层次:必主生员'],
    hint: '辛金午月支成火局，得壬透破火，方可主生员',
  },
  {
    id: 'wu-month-xin-fire-formation-gui-heavy-no-ren',
    label: '辛日午月火局重癸无壬不济规则',
    description:
      '辛金生午月，若地支火局已成而壬水不透，即便癸水重见，仍较合原文"重见癸出，亦不济"之旨。此条应高于一般无壬癸可权代的宽规则，避免把火局烈势误作可用之水。',
    months: ['午'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredFormationWuxings: ['火'],
    minVisibleStemCounts: {
      癸: 2,
    },
    maxStemTotalCounts: {
      壬: 0,
    },
    usefulWuxing: '水',
    favorableOrder: ['水', '土'],
    traceHints: ['破格因素:支成火局，重见癸水亦难济火', '成格层次:癸水重见，亦不济火'],
    hint: '辛金午月火局既成而无壬透，即便癸水重见，亦不足济火',
  },
  {
    id: 'wu-month-xin-water-earth-heavy-see-jia',
    label: '辛日午月水土多见甲方妙规则',
    description:
      '辛金生午月，若全局水土并重，泥滞流壅，传统总以甲木疏土引流为妙；此条只是调剂转换，不应压过壬己两透、癸庚恩荣等更明确的偏式判断。',
    months: ['午'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['甲'],
    minWuxingCounts: {
      水: 3,
      土: 3,
    },
    distinctStemGroupCounts: [
      {
        stems: ['壬', '癸'],
        minDistinctCount: 1,
        scope: 'total',
      },
      {
        stems: ['戊', '己'],
        minDistinctCount: 1,
        scope: 'total',
      },
    ],
    usefulWuxing: '木',
    favorableOrder: ['木', '水', '土'],
    traceHints: ['取用层次:水土并重', '取用调整:见甲疏土引流，方妙'],
    hint: '辛金午月水土多者，见甲木疏土引流方妙',
  },
  {
    id: 'wu-month-xin-wood-fire-heavy-no-metal-water-warning',
    label: '辛日午月木火过盛无金水运败规则',
    description:
      '辛金生午月，若木多火多而全局别无金水扶救，传统多作败象看待；原文并云"逢金水运必败"，此属从势失衡后的反向败应。该条重在补充传统警语依据，不另改前面更明确偏式的本命取用层级。',
    months: ['午'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    minWuxingCounts: {
      木: 3,
      火: 3,
    },
    maxWuxingCounts: {
      金: 1,
      水: 0,
    },
    usefulWuxing: '水',
    favorableOrder: ['水', '土'],
    traceHints: ['破格因素:木火过盛，不见金水', '运势警语:逢金水运反败'],
    hint: '辛金午月木火过盛而不见金水，多成偏枯之象，行金水运反易败',
  },
];
