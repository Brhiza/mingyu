import {
  closePlaceModalSession,
  isPlaceModalSessionOpen,
  openPlaceModalSession,
} from '../app/modal-bus';

export interface BirthPlaceSelection {
  displayName: string;
  provinceId: string;
  provinceName: string;
  cityId: string;
  cityName: string;
  districtId: string;
  districtName: string;
  longitude: number;
  latitude: number;
  timezone?: number;
  timeZoneId?: string;
  isOverseas?: boolean;
}

export interface BirthPlaceModalOptions {
  purpose?: 'birth' | 'observer';
  backdropClassName?: string;
  initialPlace?: string;
  initialDistrictId?: string;
  container?: HTMLElement;
  onConfirm?: (selection: BirthPlaceSelection) => void;
  onClose?: () => void;
}

export interface BirthPlaceModalController {
  open: (options?: Partial<BirthPlaceModalOptions>) => void;
  close: () => void;
  destroy: () => void;
  isOpen: () => boolean;
}

/**
 * 通过统一 React Radix Dialog 打开出生地 / 观测地三列级联选择器。
 */
export function createBirthPlaceModal(
  initialOptions: BirthPlaceModalOptions = {},
): BirthPlaceModalController {
  let currentOptions: BirthPlaceModalOptions = { ...initialOptions };
  let activeKey: number | undefined;

  function open(overrideOptions: Partial<BirthPlaceModalOptions> = {}): void {
    currentOptions = { ...currentOptions, ...overrideOptions };
    activeKey = openPlaceModalSession(currentOptions);
  }

  function close(): void {
    closePlaceModalSession(activeKey);
    activeKey = undefined;
  }

  return {
    open,
    close,
    destroy: close,
    isOpen: () => activeKey !== undefined && isPlaceModalSessionOpen(activeKey),
  };
}

/**
 * 快捷打开一次出生地/观测地三列级联选择弹窗。
 */
export function openBirthPlaceModal(options: BirthPlaceModalOptions): BirthPlaceModalController {
  const controller = createBirthPlaceModal(options);
  controller.open();
  return controller;
}
