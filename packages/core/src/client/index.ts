import {
  calculateBirthChartBundle,
  type BirthChartBundle,
  type BirthChartBundleOptions,
} from '../birth';
import {
  calculateCompatibilityBundle,
  type CompatibilityBundle,
  type CompatibilityBundleOptions,
} from '../compatibility';
import {
  calculateBaziZiweiCombinedReading,
  type BaziZiweiCombinedReading,
  type BaziZiweiCombinedReadingOptions,
} from '../synthesis';
import {
  generateDivinationSession,
  type DivinationRequest,
  type DivinationSession,
} from '../divination/session';
import {
  getCapabilities,
  requireSystemCapability,
  type MingyuCapabilities,
  type SystemCapability,
  type SystemCapabilityId,
} from '../capabilities';
import { normalizeBirthProfile, type BirthProfile, type NormalizedBirthProfile } from '../profile';
import {
  buildAstronomicalTimeEvidence,
  calculateMoonPhaseEvidence,
  calculateSolarIlluminationEvidence,
  calculateSolarTermEvidence,
  calculateSolarTermsForYear,
  resolveTrueSolarBirthTime,
  type AstronomicalTimeEvidence,
  type AstronomicalTimeInput,
  type MoonPhaseEvidence,
  type SolarIlluminationEvidence,
  type SolarIlluminationInput,
  type SolarTermEvidence,
  type TrueSolarBirthTimeInput,
  type TrueSolarBirthTimeResult,
} from '../calendar';
import {
  analyzeBaZhai,
  analyzeBaZhaiByDoorDegree,
  type BaZhaiDoorDegreeInput,
  type BaZhaiDoorDegreeResult,
  type BaZhaiInput,
  type BaZhaiResult,
} from '../ba_zhai';
import {
  calculateZodiacYearFortune,
  type ZodiacYearFortune,
  type ZodiacYearFortuneInput,
} from '../zodiac';
import { generateTaiyi, type TaiyiInput, type TaiyiResult } from '../taiyi';
import { generateQizheng, type QizhengInput, type QizhengResult } from '../qi_zheng';
import { generateXuanKong, type XuanKongInput, type XuanKongResult } from '../xuan_kong';
import {
  generateResidentialFengshui,
  type ResidentialFengshuiInput,
  type ResidentialFengshuiResult,
} from '../residential_fengshui';
import {
  executeSafely,
  executeSafelySync,
  serializeCoreResult,
  type CoreExecutionResult,
} from '../shared/result';

export interface MingyuClientDefaults {
  birth?: BirthChartBundleOptions;
  compatibility?: CompatibilityBundleOptions;
  synthesis?: BaziZiweiCombinedReadingOptions;
}

export interface MingyuClientOptions {
  /** 为每次调用提供可被调用参数覆盖的默认设置。 */
  defaults?: MingyuClientDefaults;
}

export interface MingyuSafeClient {
  birth(
    profile: BirthProfile,
    options?: BirthChartBundleOptions,
  ): Promise<CoreExecutionResult<BirthChartBundle>>;
  compatibility(
    primary: BirthProfile,
    partner: BirthProfile,
    options?: CompatibilityBundleOptions,
  ): Promise<CoreExecutionResult<CompatibilityBundle>>;
  baziZiwei(
    profile: BirthProfile,
    options?: BaziZiweiCombinedReadingOptions,
  ): Promise<CoreExecutionResult<BaziZiweiCombinedReading>>;
  divination(request: DivinationRequest): CoreExecutionResult<DivinationSession>;
  normalizeBirth(profile: BirthProfile): CoreExecutionResult<NormalizedBirthProfile>;
  trueSolarBirth(input: TrueSolarBirthTimeInput): CoreExecutionResult<TrueSolarBirthTimeResult>;
  astronomicalTime(input: AstronomicalTimeInput): CoreExecutionResult<AstronomicalTimeEvidence>;
  moonPhase(utcDateTime: Date | string | number): CoreExecutionResult<MoonPhaseEvidence>;
  solarTerm(year: number, index: number): CoreExecutionResult<SolarTermEvidence>;
  solarTerms(year: number): CoreExecutionResult<SolarTermEvidence[]>;
  solarIllumination(input: SolarIlluminationInput): CoreExecutionResult<SolarIlluminationEvidence>;
  bazhai(input: BaZhaiInput): CoreExecutionResult<BaZhaiResult>;
  bazhaiByDoorDegree(input: BaZhaiDoorDegreeInput): CoreExecutionResult<BaZhaiDoorDegreeResult>;
  zodiac(input: ZodiacYearFortuneInput): CoreExecutionResult<ZodiacYearFortune>;
  taiyi(input: TaiyiInput): CoreExecutionResult<TaiyiResult>;
  qizheng(input: QizhengInput): CoreExecutionResult<QizhengResult>;
  xuankong(input: XuanKongInput): CoreExecutionResult<XuanKongResult>;
  residentialFengshui(
    input: ResidentialFengshuiInput,
  ): CoreExecutionResult<ResidentialFengshuiResult>;
  capabilities(): CoreExecutionResult<MingyuCapabilities>;
  capability(id: SystemCapabilityId): CoreExecutionResult<SystemCapability>;
  serialize(value: unknown): CoreExecutionResult<string>;
}

export interface MingyuClient {
  birth(profile: BirthProfile, options?: BirthChartBundleOptions): Promise<BirthChartBundle>;
  compatibility(
    primary: BirthProfile,
    partner: BirthProfile,
    options?: CompatibilityBundleOptions,
  ): Promise<CompatibilityBundle>;
  /** 从一份出生档案生成八字、紫微与逐主题合参资料。 */
  baziZiwei(
    profile: BirthProfile,
    options?: BaziZiweiCombinedReadingOptions,
  ): Promise<BaziZiweiCombinedReading>;
  divination(request: DivinationRequest): DivinationSession;
  /** 校验并统一公历/农历、传统时辰、精准时分与真太阳时口径。 */
  normalizeBirth(profile: BirthProfile): NormalizedBirthProfile;
  trueSolarBirth(input: TrueSolarBirthTimeInput): TrueSolarBirthTimeResult;
  astronomicalTime(input: AstronomicalTimeInput): AstronomicalTimeEvidence;
  moonPhase(utcDateTime: Date | string | number): MoonPhaseEvidence;
  solarTerm(year: number, index: number): SolarTermEvidence;
  /** 按公历年份返回该年 24 个节气交接证据。 */
  solarTerms(year: number): SolarTermEvidence[];
  solarIllumination(input: SolarIlluminationInput): SolarIlluminationEvidence;
  bazhai(input: BaZhaiInput): BaZhaiResult;
  bazhaiByDoorDegree(input: BaZhaiDoorDegreeInput): BaZhaiDoorDegreeResult;
  zodiac(input: ZodiacYearFortuneInput): ZodiacYearFortune;
  taiyi(input: TaiyiInput): TaiyiResult;
  qizheng(input: QizhengInput): QizhengResult;
  xuankong(input: XuanKongInput): XuanKongResult;
  residentialFengshui(input: ResidentialFengshuiInput): ResidentialFengshuiResult;
  capabilities(): MingyuCapabilities;
  /** 查询单项能力；未知 ID 会抛出结构化校验错误。 */
  capability(id: SystemCapabilityId): SystemCapability;
  serialize(value: unknown): string;
  /** 与普通方法参数一致，但失败时返回结构化错误而不是抛出异常。 */
  readonly safe: MingyuSafeClient;
}

function normalizeUtcTimestamp(value: Date | string | number): number {
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (!Number.isFinite(timestamp)) throw new TypeError('UTC 时刻必须是有效日期或时间戳。');
  return timestamp;
}

function mergeBirthOptions(
  defaults: BirthChartBundleOptions | undefined,
  options: BirthChartBundleOptions | undefined,
): BirthChartBundleOptions {
  return {
    ...defaults,
    ...options,
    ziwei: { ...defaults?.ziwei, ...options?.ziwei },
  };
}

function mergeCompatibilityOptions(
  defaults: CompatibilityBundleOptions | undefined,
  options: CompatibilityBundleOptions | undefined,
): CompatibilityBundleOptions {
  return {
    ...defaults,
    ...options,
    bazi: { ...defaults?.bazi, ...options?.bazi },
    ziwei: { ...defaults?.ziwei, ...options?.ziwei },
    astrolabe: { ...defaults?.astrolabe, ...options?.astrolabe },
    chart: {
      ...defaults?.chart,
      ...options?.chart,
      ziwei: { ...defaults?.chart?.ziwei, ...options?.chart?.ziwei },
    },
  };
}

function mergeSynthesisOptions(
  defaults: BaziZiweiCombinedReadingOptions | undefined,
  options: BaziZiweiCombinedReadingOptions | undefined,
): BaziZiweiCombinedReadingOptions {
  return {
    ...defaults,
    ...options,
    ziwei: { ...defaults?.ziwei, ...options?.ziwei },
    prompt: { ...defaults?.prompt, ...options?.prompt },
  };
}

/**
 * 创建统一高层客户端。
 *
 * 普通方法适合希望使用异常流程的 TypeScript/JavaScript 项目；safe 方法适合
 * API、表单、工作流和跨进程调用，返回值可以直接序列化。
 */
export function createMingyuClient(options: MingyuClientOptions = {}): MingyuClient {
  const birth = (profile: BirthProfile, callOptions?: BirthChartBundleOptions) =>
    calculateBirthChartBundle(profile, mergeBirthOptions(options.defaults?.birth, callOptions));
  const compatibility = (
    primary: BirthProfile,
    partner: BirthProfile,
    callOptions?: CompatibilityBundleOptions,
  ) =>
    calculateCompatibilityBundle(
      primary,
      partner,
      mergeCompatibilityOptions(options.defaults?.compatibility, callOptions),
    );
  const baziZiwei = (profile: BirthProfile, callOptions?: BaziZiweiCombinedReadingOptions) =>
    calculateBaziZiweiCombinedReading(
      profile,
      mergeSynthesisOptions(options.defaults?.synthesis, callOptions),
    );
  const divination = (request: DivinationRequest) => generateDivinationSession(request);
  const normalizeBirth = (profile: BirthProfile) => normalizeBirthProfile(profile);
  const trueSolarBirth = (input: TrueSolarBirthTimeInput) => resolveTrueSolarBirthTime(input);
  const astronomicalTime = (input: AstronomicalTimeInput) => buildAstronomicalTimeEvidence(input);
  const moonPhase = (utcDateTime: Date | string | number) =>
    calculateMoonPhaseEvidence(normalizeUtcTimestamp(utcDateTime));
  const solarTerm = (year: number, index: number) => calculateSolarTermEvidence(year, index);
  const solarTerms = (year: number) => calculateSolarTermsForYear(year);
  const solarIllumination = (input: SolarIlluminationInput) =>
    calculateSolarIlluminationEvidence(input);
  const bazhai = (input: BaZhaiInput) => analyzeBaZhai(input);
  const bazhaiByDoorDegree = (input: BaZhaiDoorDegreeInput) => analyzeBaZhaiByDoorDegree(input);
  const zodiac = (input: ZodiacYearFortuneInput) => calculateZodiacYearFortune(input);
  const taiyi = (input: TaiyiInput) => generateTaiyi(input);
  const qizheng = (input: QizhengInput) => generateQizheng(input);
  const xuankong = (input: XuanKongInput) => generateXuanKong(input);
  const residentialFengshui = (input: ResidentialFengshuiInput) =>
    generateResidentialFengshui(input);
  const capabilities = () => getCapabilities();
  const capability = (id: SystemCapabilityId) => requireSystemCapability(id);
  const serialize = (value: unknown) => serializeCoreResult(value);

  return {
    birth,
    compatibility,
    baziZiwei,
    divination,
    normalizeBirth,
    trueSolarBirth,
    astronomicalTime,
    moonPhase,
    solarTerm,
    solarTerms,
    solarIllumination,
    bazhai,
    bazhaiByDoorDegree,
    zodiac,
    taiyi,
    qizheng,
    xuankong,
    residentialFengshui,
    capabilities,
    capability,
    serialize,
    safe: {
      birth: (profile, callOptions) => executeSafely(() => birth(profile, callOptions)),
      compatibility: (primary, partner, callOptions) =>
        executeSafely(() => compatibility(primary, partner, callOptions)),
      baziZiwei: (profile, callOptions) => executeSafely(() => baziZiwei(profile, callOptions)),
      divination: (request) => executeSafelySync(() => divination(request)),
      normalizeBirth: (profile) => executeSafelySync(() => normalizeBirth(profile)),
      trueSolarBirth: (input) => executeSafelySync(() => trueSolarBirth(input)),
      astronomicalTime: (input) => executeSafelySync(() => astronomicalTime(input)),
      moonPhase: (utcDateTime) => executeSafelySync(() => moonPhase(utcDateTime)),
      solarTerm: (year, index) => executeSafelySync(() => solarTerm(year, index)),
      solarTerms: (year) => executeSafelySync(() => solarTerms(year)),
      solarIllumination: (input) => executeSafelySync(() => solarIllumination(input)),
      bazhai: (input) => executeSafelySync(() => bazhai(input)),
      bazhaiByDoorDegree: (input) => executeSafelySync(() => bazhaiByDoorDegree(input)),
      zodiac: (input) => executeSafelySync(() => zodiac(input)),
      taiyi: (input) => executeSafelySync(() => taiyi(input)),
      qizheng: (input) => executeSafelySync(() => qizheng(input)),
      xuankong: (input) => executeSafelySync(() => xuankong(input)),
      residentialFengshui: (input) => executeSafelySync(() => residentialFengshui(input)),
      capabilities: () => executeSafelySync(capabilities),
      capability: (id) => executeSafelySync(() => capability(id)),
      serialize: (value) => executeSafelySync(() => serialize(value)),
    },
  };
}
