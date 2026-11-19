import type { z } from 'zod';
import type { liuyaoInput } from '../../schema';
import { randomContext } from '../random';

type Options = NonNullable<z.infer<typeof liuyaoInput>['liuyao']>;
type Coin = 2 | 3;
type Yao = 6 | 7 | 8 | 9;
type CoinThrow = { coins: [Coin, Coin, Coin]; total: Yao };
type Change = { initial: number; left: number; right: number; hanging: 1; leftRemainder: number; rightRemainder: number; removed: number; remaining: number };
type Yarrow = { lines: { changes: Change[]; value: Yao }[]; yaos: Yao[]; samplingModel: '手工分堆' | '余数等概率，类内分堆等概率' };
type Generation = { method: 'time' | 'manual' | 'coins' | 'yarrow'; coinSource?: 'user-record' | 'simulated'; coinThrows?: CoinThrow[]; yarrow?: Yarrow };

/** 时间起卦按起卦时刻取数；不暴露随机种子或随机轨迹。 */
function timeSource(timestamp: number) {
  let state = 2166136261;
  const text = `时间起卦:${timestamp}`;
  for (let i = 0; i < text.length; i++) state = Math.imul(state ^ text.charCodeAt(i), 16777619);
  state = (state >>> 0) || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** 四十九策、十八变；传入分堆即按实际记录计算。 */
export function castYarrow(splits?: readonly number[]): Yarrow {
  if (splits !== undefined && (!Array.isArray(splits) || splits.length !== 18)) throw new Error('蓍草分堆记录必须恰好包含十八变。');
  const random = splits ? undefined : randomContext();
  const lines: Yarrow['lines'] = [];
  for (let line = 0; line < 6; line++) {
    let remaining = 49;
    const changes: Change[] = [];
    for (let turn = 0; turn < 3; turn++) {
      let left: number;
      if (splits) left = splits[line * 3 + turn];
      else {
        const remainder = random!.integer(4) + 1;
        const count = Math.floor((remaining - 2 - remainder) / 4) + 1;
        left = remainder + 4 * random!.integer(count);
      }
      if (!Number.isInteger(left) || left < 1 || left > remaining - 2) throw new Error(`第${line + 1}爻第${turn + 1}变左堆须为1至${remaining - 2}的整数。`);
      const right = remaining - left;
      const leftRemainder = ((left - 1) % 4) + 1;
      const rightRemainder = ((right - 2) % 4) + 1;
      const removed = 1 + leftRemainder + rightRemainder;
      changes.push({ initial: remaining, left, right, hanging: 1, leftRemainder, rightRemainder, removed, remaining: remaining - removed });
      remaining -= removed;
    }
    lines.push({ changes, value: remaining / 4 as Yao });
  }
  return { lines, yaos: lines.map((line) => line.value), samplingModel: splits ? '手工分堆' : '余数等概率，类内分堆等概率' };
}

export function castLiuyao(timestamp: number, options: Options = {}): { yaos: Yao[]; generation: Generation } {
  const method = options.method ?? (options.yaos !== undefined ? 'manual' : 'time');
  if (method === 'yarrow') {
    if (options.yaos !== undefined || options.coinThrows !== undefined) throw new Error('蓍草起卦不能同时提供手工爻值或铜钱记录。');
    const yarrow = castYarrow(options.yarrowSplits);
    return { yaos: yarrow.yaos, generation: { method, yarrow } };
  }
  if (options.yarrowSplits !== undefined) throw new Error('蓍草分堆记录只适用于蓍草起卦。');
  if (method === 'manual') {
    if (options.coinThrows !== undefined) throw new Error('六爻手工起卦不能同时提供手摇记录。');
    if (!Array.isArray(options.yaos) || options.yaos.length !== 6 || !options.yaos.every((n) => Number.isInteger(n) && n >= 6 && n <= 9)) throw new Error('六爻手工爻值必须是六个 6、7、8、9。');
    return { yaos: [...options.yaos] as Yao[], generation: { method } };
  }
  if (method !== 'coins' && method !== 'time') throw new Error(`未知的六爻起卦方式：${method}`);
  if (options.yaos !== undefined) throw new Error('时间或三钱起卦不能同时提供手工爻值。');
  if (method === 'time' && options.coinThrows !== undefined) throw new Error('六爻时间起卦不能同时提供手摇记录。');
  const coinThrows: CoinThrow[] = [];
  if (options.coinThrows !== undefined) {
    if (!Array.isArray(options.coinThrows) || options.coinThrows.length !== 6) throw new Error('六爻手摇记录必须恰好包含 6 爻。');
    for (const [index, item] of options.coinThrows.entries()) {
      if (!item || !Array.isArray(item.coins) || item.coins.length !== 3 || !item.coins.every((coin) => coin === 2 || coin === 3)) throw new Error(`第${index + 1}爻必须包含三枚有效铜钱。`);
      const coins = [...item.coins] as [Coin, Coin, Coin];
      const total = coins.reduce<number>((sum, value) => sum + value, 0) as Yao;
      if (total !== item.total) throw new Error(`第${index + 1}爻的铜钱合计与爻值不一致。`);
      coinThrows.push({ coins, total });
    }
  } else {
    const random = randomContext(method === 'time' ? timeSource(timestamp) : undefined);
    for (let i = 0; i < 6; i++) {
      const coins = Array.from({ length: 3 }, () => random.integer(2) === 0 ? 2 : 3) as [Coin, Coin, Coin];
      coinThrows.push({ coins, total: coins.reduce<number>((sum, coin) => sum + coin, 0) as Yao });
    }
  }
  const yaos = coinThrows.map((item) => item.total);
  return method === 'time' ? { yaos, generation: { method } }
    : { yaos, generation: { method, coinSource: options.coinThrows === undefined ? 'simulated' : 'user-record', coinThrows } };
}
