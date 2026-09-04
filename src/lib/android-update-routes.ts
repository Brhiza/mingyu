export type AndroidDownloadRouteId = 'rng-cdn' | 'lanzou' | 'github' | 'gh-proxy' | 'ghfast';

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

async function fetchRouteProbe(
  route: AndroidDownloadRoute,
  fetcher: typeof fetch,
  signal: AbortSignal,
): Promise<Response> {
  const headResponse = await fetcher(route.url, {
    method: 'HEAD',
    cache: 'no-store',
    redirect: 'follow',
    signal,
  });
  if (headResponse.ok || route.id !== 'gh-proxy') return headResponse;
  await headResponse.body?.cancel().catch(() => undefined);
  return fetcher(route.url, {
    method: 'GET',
    headers: { Range: 'bytes=0-0' },
    cache: 'no-store',
    redirect: 'follow',
    signal,
  });
}

export function buildAndroidDownloadRoutes(
  version: string,
  apkUrl: string,
): AndroidDownloadRoute[] {
  const encodedVersion = encodeURIComponent(version);
  const githubUrl = `https://github.com/Brhiza/mingyu/releases/download/android-v${encodedVersion}/mingyu-${encodedVersion}.apk`;
  return [
    { id: 'rng-cdn', name: '线路 1 · 官方下载', url: apkUrl, priority: 1 },
    {
      id: 'lanzou',
      name: '线路 2 · 蓝奏云',
      url: `https://lanzou-cloudflare-api.brhiza.workers.dev/v1/public/mingyu/${encodedVersion}`,
      priority: 2,
    },
    { id: 'github', name: '线路 3 · GitHub 直连', url: githubUrl, priority: 3 },
    {
      id: 'gh-proxy',
      name: '线路 4 · GitHub 加速',
      url: `https://gh-proxy.com/${githubUrl}`,
      priority: 4,
    },
    {
      id: 'ghfast',
      name: '线路 5 · GitHub 加速',
      url: `https://ghfast.top/${githubUrl}`,
      priority: 5,
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
        const response = await fetchRouteProbe(route, fetcher, controller.signal);
        await response.body?.cancel().catch(() => undefined);
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
