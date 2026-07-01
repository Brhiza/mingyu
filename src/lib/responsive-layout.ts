export const PHONE_LAYOUT_MAX_WIDTH = 640;
export const COMPACT_LAYOUT_MAX_WIDTH = 900;
export const SHORT_VIEWPORT_MAX_HEIGHT = 520;

type ViewportLayoutOptions = {
  viewportWidth: number;
  viewportHeight?: number;
};

export function shouldUsePhoneLayout({
  viewportWidth,
  viewportHeight = 0,
}: ViewportLayoutOptions): boolean {
  if (viewportWidth <= 0) {
    return false;
  }

  if (viewportWidth <= PHONE_LAYOUT_MAX_WIDTH) {
    return true;
  }

  return viewportWidth <= COMPACT_LAYOUT_MAX_WIDTH && viewportHeight <= SHORT_VIEWPORT_MAX_HEIGHT;
}
