import * as AstronomyEngine from 'astronomy-engine';

const namespace = AstronomyEngine as unknown as Record<string, unknown>;
export const Astronomy = (Reflect.get(namespace, 'default') ?? AstronomyEngine) as typeof AstronomyEngine;
export type { Body } from 'astronomy-engine';
