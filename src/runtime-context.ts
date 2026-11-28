import type { CharacterIndexLoader, CharacterShardLoader } from './character-data';
import type { PromptGuidanceOptions } from './prompt-guidance';
import type { PromptProfile } from './prompt-profile';
import type { StaticDatasetLoader } from './static-data';

export type AsteroidName = 'ceres' | 'pallas' | 'juno' | 'vesta';
export interface RuntimeContext {
  characterShard?: CharacterShardLoader;
  characterIndex?: CharacterIndexLoader;
  asteroidData?: (name: AsteroidName) => Promise<unknown>;
  staticDataset?: StaticDatasetLoader;
  enabledMethods?: readonly string[];
  promptGuidance?: PromptGuidanceOptions;
  promptProfile?: PromptProfile;
}
