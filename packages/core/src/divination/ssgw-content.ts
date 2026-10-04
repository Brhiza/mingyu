import type { SsgwData } from '../types/divination';
import { SSGW_SIGNS } from './ssgw-data';
import { MingyuCoreError } from '../shared/result';
import { assertReplaySamplesConsumed, createRandomContext, randomInt } from '../shared/random';

function invalidSsgwIdentity(field: string): never {
  throw new MingyuCoreError({
    code: 'SSGW_SIGN_IDENTITY_MISMATCH',
    category: 'validation',
    message: '签号、签谱内容或抽签记录不一致。',
    field,
  });
}

interface LegacySsgwRitual {
  throws: Array<{ result: string; firstFace?: string; secondFace?: string }>;
  confirmed?: boolean;
  rejected?: boolean;
}

/** 旧版随机签在抽签后还记录逐次掷筊，原样本采用直接缩放取整数。 */
function assertLegacySsgwReplay(
  samples: number[],
  selectedIndex: number,
  ritual: LegacySsgwRitual,
): void {
  if (!Array.isArray(ritual.throws)) invalidSsgwIdentity('ritual.throws');
  const replayOptions = { replay: samples };
  const replay = createRandomContext(replayOptions);
  if (Math.floor(replay.random() * SSGW_SIGNS.length) !== selectedIndex) {
    invalidSsgwIdentity('meta.random.samples');
  }
  const throws: LegacySsgwRitual['throws'] = [];
  let consecutiveYin = 0;
  for (let attempt = 0; attempt < 12; attempt++) {
    const first = Math.floor(replay.random() * 2);
    const second = Math.floor(replay.random() * 2);
    const result = first !== second ? '圣杯' : first === 0 ? '笑杯' : '阴杯';
    throws.push({
      result,
      firstFace: first === 0 ? '阳面' : '阴面',
      secondFace: second === 0 ? '阳面' : '阴面',
    });
    if (result === '圣杯') break;
    consecutiveYin = result === '阴杯' ? consecutiveYin + 1 : 0;
    if (consecutiveYin >= 3) break;
  }
  assertReplaySamplesConsumed(replayOptions, replay.getTrace());
  if (ritual.throws.length !== throws.length) invalidSsgwIdentity('ritual.throws');
  for (let index = 0; index < throws.length; index++) {
    const actual = ritual.throws[index];
    const expected = throws[index];
    if (
      !actual ||
      actual.result !== expected.result ||
      (actual.firstFace !== undefined && actual.firstFace !== expected.firstFace) ||
      (actual.secondFace !== undefined && actual.secondFace !== expected.secondFace)
    ) {
      invalidSsgwIdentity(`ritual.throws.${index}`);
    }
  }
  const confirmed = throws.at(-1)?.result === '圣杯';
  if (ritual.confirmed !== undefined && ritual.confirmed !== confirmed) {
    invalidSsgwIdentity('ritual.confirmed');
  }
  if (ritual.rejected !== undefined && ritual.rejected !== !confirmed) {
    invalidSsgwIdentity('ritual.rejected');
  }
}

/** 将旧结果缺失的签谱字段补为本签资料，并拒绝与签号冲突的已有资料。 */
export function resolveSsgwSignFacts(data: SsgwData): SsgwData {
  const sign = SSGW_SIGNS.find((item) => item.id === data.number);
  if (!sign) invalidSsgwIdentity('number');
  if (data.title !== sign.title) invalidSsgwIdentity('title');
  if (data.poem !== sign.qianwen) invalidSsgwIdentity('poem');
  if (data.story?.trim() && data.story !== sign.story) invalidSsgwIdentity('story');
  if (data.details !== undefined) {
    if (data.details === null || typeof data.details !== 'object' || Array.isArray(data.details)) {
      invalidSsgwIdentity('details');
    }
    for (const [key, value] of Object.entries(data.details)) {
      if (typeof value !== 'string') invalidSsgwIdentity(`details.${key}`);
      if (value.trim() && sign.details[key] !== value) invalidSsgwIdentity(`details.${key}`);
    }
  }

  const selectedIndex = SSGW_SIGNS.indexOf(sign);
  if (data.draw) {
    if (
      data.draw.method !== undefined &&
      data.draw.method !== 'random' &&
      data.draw.method !== 'manual'
    ) {
      invalidSsgwIdentity('draw.method');
    }
    if (data.draw.poolSize !== SSGW_SIGNS.length) invalidSsgwIdentity('draw.poolSize');
    if (data.draw.selectedNumber !== sign.id) invalidSsgwIdentity('draw.selectedNumber');
    if (data.draw.method !== 'manual' && data.draw.selectedIndex !== selectedIndex) {
      invalidSsgwIdentity('draw.selectedIndex');
    }
    if (data.draw.method === 'manual' && data.draw.selectedIndex !== null) {
      invalidSsgwIdentity('draw.selectedIndex');
    }
    if (
      data.meta &&
      data.meta.algorithm !== (data.draw.method === 'manual' ? 'ssgw.resolve.manual' : 'ssgw.draw')
    ) {
      invalidSsgwIdentity('meta.algorithm');
    }
  }
  if (data.meta?.random) {
    if (data.draw?.method === 'manual') invalidSsgwIdentity('meta.random');
    const samples = data.meta.random.samples;
    if (!Array.isArray(samples) || samples.length === 0) invalidSsgwIdentity('meta.random.samples');
    const ritual = (data as SsgwData & { ritual?: LegacySsgwRitual }).ritual;
    if (ritual !== undefined) {
      if (!ritual || typeof ritual !== 'object' || !Array.isArray(ritual.throws)) {
        invalidSsgwIdentity('ritual');
      }
      assertLegacySsgwReplay(samples, selectedIndex, ritual);
    } else if (samples.length === 1) {
      createRandomContext({ replay: samples });
      const legacyIndex = Math.floor(samples[0] * SSGW_SIGNS.length);
      const bucketSize = Math.floor(0x1_0000_0000 / SSGW_SIGNS.length);
      const candidate = Math.floor(samples[0] * 0x1_0000_0000);
      const currentIndex =
        candidate < bucketSize * SSGW_SIGNS.length ? Math.floor(candidate / bucketSize) : -1;
      if (legacyIndex !== selectedIndex && currentIndex !== selectedIndex) {
        invalidSsgwIdentity('meta.random.samples');
      }
    } else {
      const replay = createRandomContext({ replay: samples });
      const replayedIndex = randomInt(SSGW_SIGNS.length, replay.random);
      assertReplaySamplesConsumed({ replay: samples }, replay.getTrace());
      if (replayedIndex !== selectedIndex) invalidSsgwIdentity('meta.random.samples');
    }
  }

  return {
    ...data,
    title: sign.title,
    poem: sign.qianwen,
    story: sign.story,
    details: { ...sign.details },
  };
}

function normalizeSsgwText(text: string) {
  return text.replace(/[，。、《》；：？！“”"'、\s]/g, '');
}

function sanitizeSsgwText(text: string, currentNumber: number) {
  return text
    .split(/(?<=[。！？!?])\s*/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .filter((sentence) => {
      const references = [...sentence.matchAll(/第\s*(\d+|[一二三四五六七八九十]{1,3})\s*签/gu)];
      return references.every(
        (match) => /^\d+$/u.test(match[1]) && Number(match[1]) === currentNumber,
      );
    })
    .filter((sentence) => !sentence.includes('全方位的多'))
    .join('');
}

/** 合并签谱中的重复典故字段，避免同一内容在结果和详情中展示两次。 */
export function resolveSsgwStoryContent(data: SsgwData) {
  data = resolveSsgwSignFacts(data);
  const story = sanitizeSsgwText(data.story?.trim() || '', data.number);
  const detailStory = sanitizeSsgwText(data.details?.典故?.trim() || '', data.number);

  if (!story && !detailStory) return { canonicalStory: '', extraStory: '' };
  if (!story) return { canonicalStory: detailStory, extraStory: '' };
  if (!detailStory) return { canonicalStory: story, extraStory: '' };

  const normalizedStory = normalizeSsgwText(story);
  const normalizedDetailStory = normalizeSsgwText(detailStory);
  if (
    normalizedStory.includes(normalizedDetailStory) ||
    normalizedDetailStory.includes(normalizedStory)
  ) {
    return {
      canonicalStory: story.length >= detailStory.length ? story : detailStory,
      extraStory: '',
    };
  }

  return { canonicalStory: detailStory, extraStory: story };
}
