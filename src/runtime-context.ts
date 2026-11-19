import type { CharacterShardLoader } from './character-data';
import type { PromptGuidanceOptions } from './prompt-guidance';

export type AsteroidName = 'ceres' | 'pallas' | 'juno' | 'vesta';
export interface RuntimeContext {
  characterShard?: CharacterShardLoader;
  asteroidData?: (name: AsteroidName) => Promise<unknown>;
  enabledMethods?: readonly string[];
  promptGuidance?: PromptGuidanceOptions;
}
