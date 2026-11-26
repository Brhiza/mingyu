import type { CharacterShardLoader } from './character-data';
import type { PromptGuidanceOptions } from './prompt-guidance';
import type { PromptProfile } from './prompt-profile';

export type AsteroidName = 'ceres' | 'pallas' | 'juno' | 'vesta';
export interface RuntimeContext {
  characterShard?: CharacterShardLoader;
  asteroidData?: (name: AsteroidName) => Promise<unknown>;
  enabledMethods?: readonly string[];
  promptGuidance?: PromptGuidanceOptions;
  promptProfile?: PromptProfile;
}
