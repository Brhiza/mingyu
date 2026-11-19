import data from './stem-pair-names.json';

interface StemPair { name: string; type: 'good' | 'bad' | 'neutral'; summary: string }
const pairs = data as Record<string, StemPair>;

export function getNamedStemPairPattern(heaven: string, earth: string): StemPair | undefined {
  return pairs[heaven + earth];
}
