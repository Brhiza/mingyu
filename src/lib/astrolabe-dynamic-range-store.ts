import type { AstrolabeDynamicRangeBranch } from 'mingyu-core/divination/astrolabe-dynamic-range';

export type AstrolabeDynamicBranchIndex = {
  index: number;
  startTimestamp: number;
  endTimestamp: number;
  sampleCount: number;
  compressedBytes: number;
};

/** 每次计算使用独立的本地临时库；调用方结束会话时负责清除。 */
export async function createAstrolabeDynamicRangeStore() {
  const name = `astrolabe-dynamic-range-${crypto.randomUUID()}`;
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('branches');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('无法创建动态区间本地存储。'));
  });
  let closed = false;

  const assertOpen = () => {
    if (closed) throw new Error('动态区间本地存储已关闭。');
  };

  async function dispose(): Promise<void> {
    if (closed) return;
    closed = true;
    window.removeEventListener('pagehide', handlePageHide);
    database.close();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error('清除动态区间临时资料失败。'));
    });
  }
  function handlePageHide(event: PageTransitionEvent) {
    if (!event.persisted)
      void dispose().catch((error) => console.error('清除动态区间临时资料失败。', error));
  }
  window.addEventListener('pagehide', handlePageHide);

  return {
    async put(
      index: number,
      branch: AstrolabeDynamicRangeBranch,
    ): Promise<AstrolabeDynamicBranchIndex> {
      assertOpen();
      const compressed = await new Response(
        new Blob([JSON.stringify(branch)]).stream().pipeThrough(new CompressionStream('gzip')),
      ).blob();
      assertOpen();
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction('branches', 'readwrite');
        transaction.objectStore('branches').put(compressed, index);
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(transaction.error ?? new Error('动态区间保存中断。'));
        transaction.onerror = () => reject(transaction.error ?? new Error('动态区间保存失败。'));
      });
      return {
        index,
        startTimestamp: branch.startTimestamp,
        endTimestamp: branch.endTimestamp,
        sampleCount: branch.sampleCount,
        compressedBytes: compressed.size,
      };
    },

    async read(index: number): Promise<AstrolabeDynamicRangeBranch> {
      assertOpen();
      const compressed = await new Promise<Blob>((resolve, reject) => {
        const transaction = database.transaction('branches', 'readonly');
        const request = transaction.objectStore('branches').get(index);
        request.onsuccess = () => {
          if (request.result instanceof Blob) resolve(request.result);
          else reject(new Error('该出生区间分段尚未保存。'));
        };
        request.onerror = () => reject(request.error ?? new Error('读取动态区间失败。'));
        transaction.onabort = () => reject(transaction.error ?? new Error('读取动态区间中断。'));
      });
      return new Response(compressed.stream().pipeThrough(new DecompressionStream('gzip'))).json();
    },

    dispose,
  };
}

export type AstrolabeDynamicRangeStore = Awaited<
  ReturnType<typeof createAstrolabeDynamicRangeStore>
>;
