import type { StaticDatasetLoader } from '../static-data';

export const localStaticDataset: StaticDatasetLoader = async (name) => {
  switch (name) {
    case 'yilin':
      return (await import('../data/yilin.json')).default;
    case 'zhuge-signs':
      return (await import('./zhuge-signs.json')).default;
    case 'ssgw-data':
      return (await import('./ssgw-data.json')).default;
    case 'bazi-climate-rules':
      return (await import('./bazi/climate-rules.json')).default;
    case 'bazi-climate-details':
      return (await import('./bazi/climate-details.json')).default;
    case 'zhouyi-texts':
      return (await import('../data/zhouyi/texts.json')).default;
    case 'zhouyi-wings':
      return (await import('../data/zhouyi/wings.json')).default;
  }
};
