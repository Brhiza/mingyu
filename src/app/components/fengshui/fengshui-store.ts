import { LunarDay } from 'tyme4ts';
import type { PersonalCase } from '../../../v2-ui/cases-store';
import type { AlmanacParticipantDraft } from '../divination/divination-shared';

export type PlanDirection =
  | 'unknown'
  | 'north'
  | 'northeast'
  | 'east'
  | 'southeast'
  | 'south'
  | 'southwest'
  | 'west'
  | 'northwest';

export type FloorMarkerKind = 'door' | 'masterBed' | 'kitchen' | 'study' | 'bath' | 'living';

export interface FloorPlanMarker {
  id: string;
  kind: FloorMarkerKind;
  label: string;
  x: number; // 0-100 (%)
  y: number; // 0-100 (%)
}

export interface FloorPlanConfig {
  imageName: string;
  imageWidth: number;
  imageHeight: number;
  compassCenterX: number;
  compassCenterY: number;
  compassSize: number;
  compassOpacity: number;
  topDirection: PlanDirection;
  fineAngle: number;
  showCompass: boolean;
  showBazhaiLayer: boolean;
  showXuankongLayer: boolean;
  showNineGrid: boolean;
  showMarkers: boolean;
  markers: FloorPlanMarker[];
}

export interface ResidentMember {
  id: string;
  name: string;
  birthYear: number;
  birthMonth?: number;
  birthDay?: number;
  gender: 'male' | 'female';
  role?: string;
  caseId?: string;
}

export interface HouseProfile {
  id: string;
  name: string;
  location: string;
  floor: string;
  notes: string;
  orientationKind: 'mountain' | 'degree';
  sitMountain: string;
  degree: number;
  degreeReading: 'sit' | 'facing';
  measurementTarget: 'balcony' | 'door';
  northReference: 'true' | 'magnetic' | 'unspecified';
  magneticDeclination: number;
  uncertaintyDegrees: number;
  constructionYear: number;
  moveInYear?: number;
  xuankongMode: '下卦' | '替卦';
  flowGranularity: 'year' | 'date';
  flowYear: number;
  flowDate: string; // YYYY-MM-DD
  flowHour?: number;
  residents: ResidentMember[];
  primaryResidentId: string;
  roomPlacements: Partial<Record<FloorMarkerKind, string>>;
  hasCompletedWizard?: boolean;
  floorPlan: FloorPlanConfig;
  updatedAt: string;
}

export interface HouseProfilesStore {
  version: 1;
  activeId: string;
  profiles: HouseProfile[];
}

export const FLOOR_MARKER_META: ReadonlyArray<{
  kind: FloorMarkerKind;
  label: string;
  short: string;
}> = [
  { kind: 'door', label: '大门入户', short: '门' },
  { kind: 'masterBed', label: '主卧床位', short: '卧' },
  { kind: 'kitchen', label: '厨房灶位', short: '灶' },
  { kind: 'study', label: '书房办公', short: '书' },
  { kind: 'living', label: '客厅中堂', short: '厅' },
  { kind: 'bath', label: '卫生间', short: '卫' },
];

export const SIMPLE_HOUSE_DIRECTIONS: ReadonlyArray<{
  label: string;
  facingLabel: string;
  trigram: string;
  sitMountain: string;
  degree: number;
  facingDegree: number;
}> = [
  { label: '坐北朝南', facingLabel: '朝南（坐北朝南）', trigram: '坎', sitMountain: '子', degree: 0, facingDegree: 180 },
  { label: '坐南朝北', facingLabel: '朝北（坐南朝北）', trigram: '离', sitMountain: '午', degree: 180, facingDegree: 0 },
  { label: '坐东朝西', facingLabel: '朝西（坐东朝西）', trigram: '震', sitMountain: '卯', degree: 90, facingDegree: 270 },
  { label: '坐西朝东', facingLabel: '朝东（坐西朝东）', trigram: '兑', sitMountain: '酉', degree: 270, facingDegree: 90 },
  { label: '坐东南朝西北', facingLabel: '朝西北（坐东南朝西北）', trigram: '巽', sitMountain: '巽', degree: 135, facingDegree: 315 },
  { label: '坐西南朝东北', facingLabel: '朝东北（坐西南朝东北）', trigram: '坤', sitMountain: '坤', degree: 225, facingDegree: 45 },
  { label: '坐西北朝东南', facingLabel: '朝东南（坐西北朝东南）', trigram: '乾', sitMountain: '乾', degree: 315, facingDegree: 135 },
  { label: '坐东北朝西南', facingLabel: '朝西南（坐东北朝西南）', trigram: '艮', sitMountain: '艮', degree: 45, facingDegree: 225 },
];

const TRIGRAM_TO_SIMPLE_LABEL: Record<string, string> = {
  坎: '坐北朝南',
  离: '坐南朝北',
  震: '坐东朝西',
  兑: '坐西朝东',
  巽: '坐东南朝西北',
  坤: '坐西南朝东北',
  乾: '坐西北朝东南',
  艮: '坐东北朝西南',
};

const MOUNTAIN_TRIGRAM_LOOKUP: Record<string, string> = {
  壬: '坎', 子: '坎', 癸: '坎',
  丑: '艮', 艮: '艮', 寅: '艮',
  甲: '震', 卯: '震', 乙: '震',
  辰: '巽', 巽: '巽', 巳: '巽',
  丙: '离', 午: '离', 丁: '离',
  未: '坤', 坤: '坤', 申: '坤',
  庚: '兑', 酉: '兑', 辛: '兑',
  戌: '乾', 乾: '乾', 亥: '乾',
};

export function getSimpleDirectionLabel(sitMountain: string): string {
  const trigram = MOUNTAIN_TRIGRAM_LOOKUP[sitMountain] ?? '坎';
  return TRIGRAM_TO_SIMPLE_LABEL[trigram] ?? '坐北朝南';
}

export const PLAN_DIRECTION_OPTIONS: ReadonlyArray<{
  value: PlanDirection;
  label: string;
  rotation: number;
}> = [
  { value: 'unknown', label: '请选择图纸上方朝向', rotation: 0 },
  { value: 'north', label: '北', rotation: 0 },
  { value: 'northeast', label: '东北', rotation: -45 },
  { value: 'east', label: '东', rotation: -90 },
  { value: 'southeast', label: '东南', rotation: -135 },
  { value: 'south', label: '南', rotation: 180 },
  { value: 'southwest', label: '西南', rotation: 135 },
  { value: 'west', label: '西', rotation: 90 },
  { value: 'northwest', label: '西北', rotation: 45 },
];

const PROFILES_STORAGE_KEY = 'mingyu.v2.fengshui.profiles.v1';
const LEGACY_IMAGE_META_KEY = 'shiyue-feng-shui-image-workspace-v1';
const IMAGE_DB_NAME = 'shiyue-feng-shui-assets';
const IMAGE_STORE_NAME = 'floor-plans';
const LEGACY_IMAGE_RECORD_KEY = 'current';

function todayDateStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const num = Number(value);
  return Number.isFinite(num) ? Math.min(max, Math.max(min, num)) : fallback;
}

export function createDefaultFloorPlan(): FloorPlanConfig {
  return {
    imageName: '',
    imageWidth: 0,
    imageHeight: 0,
    compassCenterX: 50,
    compassCenterY: 50,
    compassSize: 58,
    compassOpacity: 78,
    topDirection: 'north',
    fineAngle: 0,
    showCompass: true,
    showBazhaiLayer: true,
    showXuankongLayer: true,
    showNineGrid: false,
    showMarkers: true,
    markers: [],
  };
}

export function createDefaultHouseProfile(overrides?: Partial<HouseProfile>): HouseProfile {
  const nowYear = new Date().getFullYear();
  const id = overrides?.id || `house_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const primaryId = overrides?.primaryResidentId || `res_${id}_1`;
  return {
    id,
    name: '主宅方案',
    location: '',
    floor: '',
    notes: '',
    orientationKind: 'degree',
    sitMountain: '子',
    degree: 180,
    degreeReading: 'facing',
    measurementTarget: 'balcony',
    northReference: 'true',
    magneticDeclination: 0,
    uncertaintyDegrees: 1,
    constructionYear: 2024,
    xuankongMode: '下卦',
    flowGranularity: 'year',
    flowYear: nowYear,
    flowDate: todayDateStr(),
    residents: [
      {
        id: primaryId,
        name: '宅主',
        birthYear: 1990,
        gender: 'male',
        role: '宅主',
      },
    ],
    primaryResidentId: primaryId,
    roomPlacements: {},
    hasCompletedWizard: false,
    floorPlan: createDefaultFloorPlan(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function tryMigrateLegacyImageWorkspace(): Partial<HouseProfile> | null {
  try {
    const raw = window.localStorage.getItem(LEGACY_IMAGE_META_KEY);
    if (!raw) return null;
    const src = JSON.parse(raw) as Record<string, unknown>;
    const topDir = PLAN_DIRECTION_OPTIONS.some((o) => o.value === src.topDirection)
      ? (src.topDirection as PlanDirection)
      : 'unknown';
    const parsedYear = Number.parseInt(String(src.builtYear ?? '').replace(/[^\d]/g, ''), 10);
    const constructionYear =
      Number.isInteger(parsedYear) && parsedYear >= 1900 && parsedYear <= 2100 ? parsedYear : 2024;
    const floorPlan: FloorPlanConfig = {
      ...createDefaultFloorPlan(),
      imageName: typeof src.imageName === 'string' ? src.imageName.slice(0, 180) : '',
      imageWidth: clampNumber(src.imageWidth, 0, 0, 100000),
      imageHeight: clampNumber(src.imageHeight, 0, 0, 100000),
      compassCenterX: clampNumber(src.compassCenterX, 50, 0, 100),
      compassCenterY: clampNumber(src.compassCenterY, 50, 0, 100),
      compassSize: clampNumber(src.compassSize, 58, 18, 95),
      compassOpacity: clampNumber(src.compassOpacity, 76, 20, 100),
      topDirection: topDir,
      fineAngle: clampNumber(src.fineAngle, 0, -22.5, 22.5),
    };
    return {
      name: (typeof src.title === 'string' && src.title.trim()) || '主宅方案',
      location: typeof src.location === 'string' ? src.location.slice(0, 80) : '',
      floor: typeof src.floor === 'string' ? src.floor.slice(0, 100) : '',
      notes: typeof src.focus === 'string' ? src.focus.slice(0, 1600) : '',
      constructionYear,
      floorPlan,
    };
  } catch {
    return null;
  }
}

const VALID_ROOM_DIRS = new Set(['北', '东北', '东', '东南', '南', '西南', '西', '西北', '中']);

function sanitizeRoomPlacements(raw: unknown): Partial<Record<FloorMarkerKind, string>> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Partial<Record<FloorMarkerKind, string>> = {};
  for (const meta of FLOOR_MARKER_META) {
    const val = (raw as Record<string, unknown>)[meta.kind];
    if (typeof val === 'string' && VALID_ROOM_DIRS.has(val)) {
      out[meta.kind] = val;
    }
  }
  return out;
}

function sanitizeProfile(raw: Partial<HouseProfile>, fallbackIndex: number): HouseProfile {
  const base = createDefaultHouseProfile({
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : `house_mig_${fallbackIndex}`,
  });
  const residents = Array.isArray(raw.residents)
    ? raw.residents
        .filter((r): r is ResidentMember => Boolean(r && typeof r === 'object'))
        .map((r, idx) => ({
          id: typeof r.id === 'string' && r.id ? r.id : `res_${base.id}_${idx + 1}`,
          name: typeof r.name === 'string' && r.name.trim() ? r.name.trim().slice(0, 40) : `成员${idx + 1}`,
          birthYear: Math.round(clampNumber(r.birthYear, 1990, 1900, 2100)),
          ...(typeof r.birthMonth === 'number' && r.birthMonth >= 1 && r.birthMonth <= 12
            ? { birthMonth: Math.round(r.birthMonth) }
            : {}),
          ...(typeof r.birthDay === 'number' && r.birthDay >= 1 && r.birthDay <= 31
            ? { birthDay: Math.round(r.birthDay) }
            : {}),
          gender: r.gender === 'female' ? ('female' as const) : ('male' as const),
          ...(typeof r.role === 'string' && r.role.trim() ? { role: r.role.trim().slice(0, 20) } : {}),
          ...(typeof r.caseId === 'string' && r.caseId.trim() ? { caseId: r.caseId.trim() } : {}),
        }))
    : base.residents;

  const finalResidents = residents.length > 0 ? residents : base.residents;
  const primaryResidentId = finalResidents.some((r) => r.id === raw.primaryResidentId)
    ? (raw.primaryResidentId as string)
    : finalResidents[0]!.id;

  const fpRaw: Partial<FloorPlanConfig> =
    raw.floorPlan && typeof raw.floorPlan === 'object' ? raw.floorPlan : {};
  const markers: FloorPlanMarker[] = Array.isArray(fpRaw.markers)
    ? fpRaw.markers
        .filter((m): m is FloorPlanMarker => Boolean(m && typeof m === 'object'))
        .map((m, idx) => ({
          id: typeof m.id === 'string' && m.id ? m.id : `mk_${idx}_${Date.now()}`,
          kind: FLOOR_MARKER_META.some((k) => k.kind === m.kind) ? m.kind : 'door',
          label:
            typeof m.label === 'string' && m.label.trim()
              ? m.label.trim().slice(0, 24)
              : FLOOR_MARKER_META.find((k) => k.kind === m.kind)?.label ?? '标记',
          x: clampNumber(m.x, 50, 2, 98),
          y: clampNumber(m.y, 50, 2, 98),
        }))
        .slice(0, 30)
    : [];

  return {
    ...base,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 60) : base.name,
    location: typeof raw.location === 'string' ? raw.location.slice(0, 80) : '',
    floor: typeof raw.floor === 'string' ? raw.floor.slice(0, 100) : '',
    notes: typeof raw.notes === 'string' ? raw.notes.slice(0, 1600) : '',
    orientationKind: raw.orientationKind === 'mountain' ? 'mountain' : 'degree',
    sitMountain: typeof raw.sitMountain === 'string' && raw.sitMountain.length === 1 ? raw.sitMountain : '子',
    degree: clampNumber(raw.degree, 180, 0, 360),
    degreeReading: raw.degreeReading === 'sit' ? 'sit' : 'facing',
    measurementTarget: raw.measurementTarget === 'door' ? 'door' : 'balcony',
    northReference:
      raw.northReference === 'magnetic' || raw.northReference === 'unspecified'
        ? raw.northReference
        : 'true',
    magneticDeclination: clampNumber(raw.magneticDeclination, 0, -30, 30),
    uncertaintyDegrees: clampNumber(raw.uncertaintyDegrees, 1, 0, 15),
    constructionYear: Math.round(clampNumber(raw.constructionYear, 2024, 1900, 2100)),
    ...(typeof raw.moveInYear === 'number' && raw.moveInYear >= 1900 && raw.moveInYear <= 2100
      ? { moveInYear: Math.round(raw.moveInYear) }
      : {}),
    xuankongMode: raw.xuankongMode === '替卦' ? '替卦' : '下卦',
    flowGranularity: raw.flowGranularity === 'date' ? 'date' : 'year',
    flowYear: Math.round(clampNumber(raw.flowYear, new Date().getFullYear(), 1900, 2100)),
    flowDate:
      typeof raw.flowDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.flowDate)
        ? raw.flowDate
        : todayDateStr(),
    ...(typeof raw.flowHour === 'number' && raw.flowHour >= 0 && raw.flowHour <= 23
      ? { flowHour: Math.round(raw.flowHour) }
      : {}),
    residents: finalResidents,
    primaryResidentId,
    roomPlacements: sanitizeRoomPlacements(raw.roomPlacements),
    hasCompletedWizard: Boolean(raw.hasCompletedWizard),
    floorPlan: {
      ...createDefaultFloorPlan(),
      imageName: typeof fpRaw.imageName === 'string' ? fpRaw.imageName.slice(0, 180) : '',
      imageWidth: clampNumber(fpRaw.imageWidth, 0, 0, 100000),
      imageHeight: clampNumber(fpRaw.imageHeight, 0, 0, 100000),
      compassCenterX: clampNumber(fpRaw.compassCenterX, 50, 0, 100),
      compassCenterY: clampNumber(fpRaw.compassCenterY, 50, 0, 100),
      compassSize: clampNumber(fpRaw.compassSize, 58, 18, 95),
      compassOpacity: clampNumber(fpRaw.compassOpacity, 78, 20, 100),
      topDirection: PLAN_DIRECTION_OPTIONS.some((o) => o.value === fpRaw.topDirection)
        ? (fpRaw.topDirection as PlanDirection) === 'unknown'
          ? 'north'
          : (fpRaw.topDirection as PlanDirection)
        : 'north',
      fineAngle: clampNumber(fpRaw.fineAngle, 0, -22.5, 22.5),
      showCompass: fpRaw.showCompass !== false,
      showBazhaiLayer: fpRaw.showBazhaiLayer !== false,
      showXuankongLayer: fpRaw.showXuankongLayer !== false,
      showNineGrid: Boolean(fpRaw.showNineGrid),
      showMarkers: fpRaw.showMarkers !== false,
      markers,
    },
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
  };
}

export function loadHouseProfilesStore(): HouseProfilesStore {
  if (typeof window === 'undefined') {
    const def = createDefaultHouseProfile({ id: 'default_house' });
    return { version: 1, activeId: def.id, profiles: [def] };
  }
  try {
    const raw = window.localStorage.getItem(PROFILES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<HouseProfilesStore>;
      const list = Array.isArray(parsed.profiles)
        ? parsed.profiles.map((p, idx) => sanitizeProfile(p, idx))
        : [];
      if (list.length > 0) {
        const activeId = list.some((p) => p.id === parsed.activeId)
          ? (parsed.activeId as string)
          : list[0]!.id;
        return { version: 1, activeId, profiles: list };
      }
    }
  } catch {}

  const migrated = tryMigrateLegacyImageWorkspace();
  const initial = createDefaultHouseProfile({
    id: 'house_default',
    ...(migrated ?? {}),
  });
  return { version: 1, activeId: initial.id, profiles: [initial] };
}

export function saveHouseProfilesStore(store: HouseProfilesStore): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(store));
  } catch {}
}

function openImageDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IMAGE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(IMAGE_STORE_NAME)) {
        request.result.createObjectStore(IMAGE_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('浏览器存储不可用'));
  });
}

async function runImageStoreRequest<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  if (typeof indexedDB === 'undefined') throw new Error('浏览器存储不可用');
  const db = await openImageDatabase();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE_NAME, mode);
    const req = action(tx.objectStore(IMAGE_STORE_NAME));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('浏览器存储失败'));
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error('浏览器存储失败'));
    };
  });
}

function imageRecordKey(profileId: string): string {
  return `profile:${profileId}`;
}

export async function loadFloorPlanImageBlob(
  profileId: string,
  allowLegacyFallback: boolean,
): Promise<Blob | undefined> {
  try {
    const direct = await runImageStoreRequest<Blob | undefined>('readonly', (store) =>
      store.get(imageRecordKey(profileId)),
    );
    if (direct) return direct;
    if (allowLegacyFallback) {
      return await runImageStoreRequest<Blob | undefined>('readonly', (store) =>
        store.get(LEGACY_IMAGE_RECORD_KEY),
      );
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export async function saveFloorPlanImageBlob(profileId: string, blob: Blob): Promise<void> {
  await runImageStoreRequest('readwrite', (store) => store.put(blob, imageRecordKey(profileId))).catch(
    () => undefined,
  );
}

export async function deleteFloorPlanImageBlob(
  profileId: string,
  clearLegacyAlso = false,
): Promise<void> {
  await runImageStoreRequest('readwrite', (store) =>
    store.delete(imageRecordKey(profileId)),
  ).catch(() => undefined);
  if (clearLegacyAlso) {
    await runImageStoreRequest('readwrite', (store) =>
      store.delete(LEGACY_IMAGE_RECORD_KEY),
    ).catch(() => undefined);
  }
}

/**
 * 将「个人档案」转为阳宅居住成员；若原档案为农历，自动换算为公历年月日以准确判定立春命卦边界。
 */
export function personalCaseToResident(c: PersonalCase): ResidentMember {
  const rawYear = Math.round(clampNumber(c.year, 1990, 1900, 2100));
  const rawMonth = Number.parseInt(String(c.month ?? ''), 10);
  const rawDay = Number.parseInt(String(c.day ?? ''), 10);
  let birthYear = rawYear;
  let birthMonth =
    Number.isInteger(rawMonth) && rawMonth >= 1 && rawMonth <= 12 ? rawMonth : undefined;
  let birthDay = Number.isInteger(rawDay) && rawDay >= 1 && rawDay <= 31 ? rawDay : undefined;

  if ((c.calendar ?? c.dateType) === 'lunar' && birthMonth && birthDay) {
    try {
      const solar = LunarDay.fromYmd(
        rawYear,
        c.isLeapMonth ? -birthMonth : birthMonth,
        birthDay,
      ).getSolarDay();
      birthYear = solar.getYear();
      birthMonth = solar.getMonth();
      birthDay = solar.getDay();
    } catch {
      try {
        const solar = LunarDay.fromYmd(rawYear, birthMonth, birthDay).getSolarDay();
        birthYear = solar.getYear();
        birthMonth = solar.getMonth();
        birthDay = solar.getDay();
      } catch {
        // 回退原始数值
      }
    }
  }

  return {
    id: `case_${c.id}`,
    name: c.name?.trim() || '档案成员',
    birthYear,
    ...(birthMonth ? { birthMonth } : {}),
    ...(birthDay ? { birthDay } : {}),
    gender: c.gender === 'female' ? 'female' : 'male',
    caseId: c.id,
  };
}

export function residentToAlmanacParticipant(r: ResidentMember): AlmanacParticipantDraft {
  return {
    id: r.id,
    name: r.name,
    gender: r.gender === 'female' ? '女' : '男',
    year: String(r.birthYear),
    month: r.birthMonth ? String(r.birthMonth) : '',
    day: r.birthDay ? String(r.birthDay) : '',
    shichenIndex: '',
    calendar: 'solar',
  };
}
