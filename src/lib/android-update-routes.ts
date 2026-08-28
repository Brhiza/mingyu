export type AndroidDownloadRouteId = 'lanzou' | 'github' | 'gh-proxy' | 'ghfast';

export type AndroidDownloadRoute = {
  id: AndroidDownloadRouteId;
  name: string;
  url: string;
  priority: number;
};

export type AndroidRouteProbe = AndroidDownloadRoute & {
  status: 'testing' | 'available' | 'unavailable';
  latencyMs: number | null;
};

const PROBE_TIMEOUT_MS = 8_000;

export function buildAndroidDownloadRoutes(
  version: string,
  githubUrl: string,
): AndroidDownloadRoute[] {
  const encodedVersion = encodeURIComponent(version);
  return [
    {
      id: 'lanzou',
      name: '线路 1 · 蓝奏云',
      url: `https://lanzou-cloudflare-api.brhiza.workers.dev/v1/public/mingyu/${encodedVersion}`,
      priority: 1,
    },
    { id: 'github', name: '线路 2 · GitHub 直连', url: githubUrl, priority: 2 },
    {
      id: 'gh-proxy',
      name: '线路 3 · GitHub 加速',
      url: `https://gh-proxy.com/${githubUrl}`,
      priority: 3,
    },
    {
      id: 'ghfast',
      name: '线路 4 · GitHub 加速',
      url: `https://ghfast.top/${githubUrl}`,
      priority: 4,
    },
  ];
}

export function createTestingRouteProbes(
  routes: readonly AndroidDownloadRoute[],
): AndroidRouteProbe[] {
  return routes.map((route) => ({ ...route, status: 'testing', latencyMs: null }));
}

export function selectBestAndroidRoute(
  probes: readonly AndroidRouteProbe[],
): AndroidRouteProbe | null {
  return (
    [...probes]
      .filter((probe) => probe.status === 'available' && probe.latencyMs !== null)
      .sort(
        (left, right) => left.latencyMs! - right.latencyMs! || left.priority - right.priority,
      )[0] ?? null
  );
}

export async function probeAndroidDownloadRoutes(
  routes: readonly AndroidDownloadRoute[],
  fetcher: typeof fetch = fetch,
  timeoutMs = PROBE_TIMEOUT_MS,
): Promise<AndroidRouteProbe[]> {
  return Promise.all(
    routes.map(async (route) => {
      const controller = new AbortController();
      const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);
      const startedAt = Date.now();
      try {
        const response = await fetcher(route.url, {
          method: 'HEAD',
          cache: 'no-store',
          redirect: 'follow',
          signal: controller.signal,
        });
        return {
          ...route,
          status: response.ok ? ('available' as const) : ('unavailable' as const),
          latencyMs: response.ok ? Math.max(1, Date.now() - startedAt) : null,
        };
      } catch {
        return { ...route, status: 'unavailable' as const, latencyMs: null };
      } finally {
        globalThis.clearTimeout(timer);
      }
    }),
  );
}
