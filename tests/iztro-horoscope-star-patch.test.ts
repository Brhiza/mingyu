import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);

type HoroscopeScope = 'origin' | 'decadal' | 'yearly' | 'monthly' | 'daily' | 'hourly';
type TranslationName =
  | 'tiankui'
  | 'tianyue'
  | 'wenchang'
  | 'wenqu'
  | 'lucun'
  | 'qingyang'
  | 'tuoluo'
  | 'tianma'
  | 'hongluan'
  | 'tianxi';
type StarLike = {
  name: string;
  type: string;
  scope: string;
};
type StarGrid = StarLike[][];

const i18nModule = require('iztro/lib/i18n/index.js') as {
  default: {
    options: {
      saveMissing?: boolean;
      missingKeyHandler?: unknown;
    };
    services: {
      backendConnector?: { backend?: unknown };
    };
    addResource: (
      language: string,
      namespace: string,
      key: string,
      value: string,
      options?: { silent?: boolean },
    ) => void;
    on: (event: string, listener: (...args: unknown[]) => void) => void;
    off: (event: string, listener: (...args: unknown[]) => void) => void;
    t: (key: string) => string;
  };
  setLanguage: (language: string) => void;
  t: (key: string) => string;
};
const { getHoroscopeStar } = require('iztro/lib/star/horoscopeStar.js') as {
  getHoroscopeStar: (
    heavenlyStem: string,
    earthlyBranch: string,
    scope: HoroscopeScope,
  ) => StarGrid;
};
const { initStars } = require('iztro/lib/star/index.js') as {
  initStars: () => StarGrid;
};
const FunctionalStar = require('iztro/lib/star/FunctionalStar.js').default as new (data: {
  name: string;
  type: string;
  scope: string;
}) => StarLike;
const location = require('iztro/lib/star/location.js') as {
  getKuiYueIndex: (heavenlyStem: string) => { kuiIndex: number; yueIndex: number };
  getChangQuIndexByHeavenlyStem: (heavenlyStem: string) => {
    changIndex: number;
    quIndex: number;
  };
  getLuYangTuoMaIndex: (
    heavenlyStem: string,
    earthlyBranch: string,
  ) => { luIndex: number; yangIndex: number; tuoIndex: number; maIndex: number };
  getLuanXiIndex: (earthlyBranch: string) => { hongluanIndex: number; tianxiIndex: number };
  getNianjieIndex: (earthlyBranch: string) => number;
};
const data = require('iztro/lib/data/index.js') as {
  HEAVENLY_STEMS: string[];
  EARTHLY_BRANCHES: string[];
};

const scopes: HoroscopeScope[] = ['origin', 'decadal', 'yearly', 'monthly', 'daily', 'hourly'];
const localeNames = ['en-US', 'ja-JP', 'ko-KR', 'zh-CN', 'zh-TW', 'vi-VN'] as const;
const translationKeys: Record<HoroscopeScope, Record<TranslationName, string>> = {
  origin: {
    tiankui: 'tiankuiMin',
    tianyue: 'tianyueMin',
    wenchang: 'wenchangMin',
    wenqu: 'wenquMin',
    lucun: 'lucunMin',
    qingyang: 'qingyangMin',
    tuoluo: 'tuoluoMin',
    tianma: 'tianmaMin',
    hongluan: 'hongluanMin',
    tianxi: 'tianxi',
  },
  decadal: {
    tiankui: 'yunkui',
    tianyue: 'yunyue',
    wenchang: 'yunchang',
    wenqu: 'yunqu',
    lucun: 'yunlu',
    qingyang: 'yunyang',
    tuoluo: 'yuntuo',
    tianma: 'yunma',
    hongluan: 'yunluan',
    tianxi: 'yunxi',
  },
  yearly: {
    tiankui: 'liukui',
    tianyue: 'liuyue',
    wenchang: 'liuchang',
    wenqu: 'liuqu',
    lucun: 'liulu',
    qingyang: 'liuyang',
    tuoluo: 'liutuo',
    tianma: 'liuma',
    hongluan: 'liuluan',
    tianxi: 'liuxi',
  },
  monthly: {
    tiankui: 'yuekui',
    tianyue: 'yueyue',
    wenchang: 'yuechang',
    wenqu: 'yuequ',
    lucun: 'yuelu',
    qingyang: 'yueyang',
    tuoluo: 'yuetuo',
    tianma: 'yuema',
    hongluan: 'yueluan',
    tianxi: 'yuexi',
  },
  daily: {
    tiankui: 'rikui',
    tianyue: 'riyue',
    wenchang: 'richang',
    wenqu: 'riqu',
    lucun: 'rilu',
    qingyang: 'riyang',
    tuoluo: 'rituo',
    tianma: 'rima',
    hongluan: 'riluan',
    tianxi: 'rixi',
  },
  hourly: {
    tiankui: 'shikui',
    tianyue: 'shiyue',
    wenchang: 'shichang',
    wenqu: 'shiqu',
    lucun: 'shilu',
    qingyang: 'shiyang',
    tuoluo: 'shituo',
    tianma: 'shima',
    hongluan: 'shiluan',
    tianxi: 'shixi',
  },
};

function legacyGetHoroscopeStar(
  heavenlyStem: string,
  earthlyBranch: string,
  scope: HoroscopeScope,
): StarGrid {
  const { kuiIndex, yueIndex } = location.getKuiYueIndex(heavenlyStem);
  const { changIndex, quIndex } = location.getChangQuIndexByHeavenlyStem(heavenlyStem);
  const { luIndex, yangIndex, tuoIndex, maIndex } = location.getLuYangTuoMaIndex(
    heavenlyStem,
    earthlyBranch,
  );
  const { hongluanIndex, tianxiIndex } = location.getLuanXiIndex(earthlyBranch);
  const stars = initStars();
  const translations = Object.fromEntries(
    scopes.map((currentScope) => [
      currentScope,
      Object.fromEntries(
        Object.entries(translationKeys[currentScope]).map(([name, key]) => [
          name,
          i18nModule.t(key),
        ]),
      ),
    ]),
  ) as Record<HoroscopeScope, Record<TranslationName, string>>;
  const trans = translations[scope];

  if (scope === 'yearly') {
    stars[location.getNianjieIndex(earthlyBranch)].push(
      new FunctionalStar({ name: i18nModule.t('nianjie'), type: 'helper', scope: 'yearly' }),
    );
  }
  stars[kuiIndex].push(new FunctionalStar({ name: trans.tiankui, type: 'soft', scope }));
  stars[yueIndex].push(new FunctionalStar({ name: trans.tianyue, type: 'soft', scope }));
  stars[changIndex].push(new FunctionalStar({ name: trans.wenchang, type: 'soft', scope }));
  stars[quIndex].push(new FunctionalStar({ name: trans.wenqu, type: 'soft', scope }));
  stars[luIndex].push(new FunctionalStar({ name: trans.lucun, type: 'lucun', scope }));
  stars[yangIndex].push(new FunctionalStar({ name: trans.qingyang, type: 'tough', scope }));
  stars[tuoIndex].push(new FunctionalStar({ name: trans.tuoluo, type: 'tough', scope }));
  stars[maIndex].push(new FunctionalStar({ name: trans.tianma, type: 'tianma', scope }));
  stars[hongluanIndex].push(new FunctionalStar({ name: trans.hongluan, type: 'flower', scope }));
  stars[tianxiIndex].push(new FunctionalStar({ name: trans.tianxi, type: 'flower', scope }));
  return stars;
}

function normalizeStars(stars: StarGrid): StarGrid {
  return stars.map((palace) =>
    palace.map(({ name, type, scope }) => ({
      name,
      type,
      scope,
    })),
  );
}

test('iztro 流耀在六语六层级保持旧结构与顺序', () => {
  try {
    for (const [localeIndex, locale] of localeNames.entries()) {
      i18nModule.setLanguage(locale);
      for (const [scopeIndex, scope] of scopes.entries()) {
        const heavenlyStem = data.HEAVENLY_STEMS[(localeIndex + scopeIndex) % 10];
        const earthlyBranch = data.EARTHLY_BRANCHES[(localeIndex * 2 + scopeIndex) % 12];
        assert.deepEqual(
          normalizeStars(getHoroscopeStar(heavenlyStem, earthlyBranch, scope)),
          normalizeStars(legacyGetHoroscopeStar(heavenlyStem, earthlyBranch, scope)),
          `${locale}/${scope}`,
        );
      }
    }
  } finally {
    i18nModule.setLanguage('zh-CN');
  }
});

test('iztro 流耀对全部干支和层级保持旧星位', () => {
  i18nModule.setLanguage('zh-CN');
  for (const scope of scopes) {
    for (const heavenlyStem of data.HEAVENLY_STEMS) {
      for (const earthlyBranch of data.EARTHLY_BRANCHES) {
        assert.deepEqual(
          normalizeStars(getHoroscopeStar(heavenlyStem, earthlyBranch, scope)),
          normalizeStars(legacyGetHoroscopeStar(heavenlyStem, earthlyBranch, scope)),
          `${scope}/${heavenlyStem}/${earthlyBranch}`,
        );
      }
    }
  }
});

test('iztro 流耀仅翻译当前层级的十个名称', () => {
  const originalT = i18nModule.t;
  let translationCount = 0;
  i18nModule.t = (key) => {
    translationCount += 1;
    return originalT(key);
  };

  try {
    for (const scope of scopes) {
      translationCount = 0;
      getHoroscopeStar('jiaHeavenly', 'ziEarthly', scope);
      assert.equal(translationCount, scope === 'yearly' ? 11 : 10, scope);
    }
  } finally {
    i18nModule.t = originalT;
  }
});

test('iztro 流耀即时读取静默词典更新且不依赖其他层级', () => {
  const i18next = i18nModule.default;
  const originalYunkui = i18next.t('yunkui');
  const originalLiukui = i18next.t('liukui');
  const updatedYunkui = '__mingyu_updated_yunkui__';
  const updatedLiukui = '__mingyu_updated_liukui__';

  i18nModule.setLanguage('zh-CN');
  try {
    i18next.addResource('zh-CN', 'translation', 'yunkui', updatedYunkui, { silent: true });
    const updatedDecadal = normalizeStars(getHoroscopeStar('jiaHeavenly', 'ziEarthly', 'decadal'));
    assert.deepEqual(
      updatedDecadal,
      normalizeStars(legacyGetHoroscopeStar('jiaHeavenly', 'ziEarthly', 'decadal')),
    );
    assert.ok(updatedDecadal.flat().some((star) => star.name === updatedYunkui));

    i18next.addResource('zh-CN', 'translation', 'liukui', updatedLiukui, { silent: true });
    assert.deepEqual(
      normalizeStars(getHoroscopeStar('jiaHeavenly', 'ziEarthly', 'decadal')),
      updatedDecadal,
    );
  } finally {
    i18next.addResource('zh-CN', 'translation', 'yunkui', originalYunkui, { silent: true });
    i18next.addResource('zh-CN', 'translation', 'liukui', originalLiukui, { silent: true });
    i18nModule.setLanguage('zh-CN');
  }
});

test('iztro 流耀非法层级保持旧 TypeError 结果', () => {
  const invalidScope = '__invalid_scope__' as HoroscopeScope;
  assert.throws(() => legacyGetHoroscopeStar('jiaHeavenly', 'ziEarthly', invalidScope), TypeError);
  assert.throws(() => getHoroscopeStar('jiaHeavenly', 'ziEarthly', invalidScope), TypeError);
});

test('iztro 默认翻译配置不会为缺词产生写入或事件副作用', () => {
  const i18next = i18nModule.default;
  let missingKeyEvents = 0;
  const onMissingKey = () => {
    missingKeyEvents += 1;
  };

  assert.equal(i18next.options.saveMissing, false);
  assert.equal(i18next.options.missingKeyHandler, false);
  assert.equal(i18next.services.backendConnector?.backend ?? null, null);
  i18next.on('missingKey', onMissingKey);
  try {
    assert.equal(
      i18nModule.t('__mingyu_missing_translation_key__'),
      '__mingyu_missing_translation_key__',
    );
    assert.equal(missingKeyEvents, 0);
  } finally {
    i18next.off('missingKey', onMissingKey);
  }
});
