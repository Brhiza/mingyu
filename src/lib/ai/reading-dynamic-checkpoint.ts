import {
  isAstrolabeDynamicReadingCheckpoint,
  type AstrolabeDynamicReadingCheckpoint,
} from './astrolabe-dynamic-reading';
import {
  isAstrolabeDynamicCollectionCheckpoint,
  type AstrolabeDynamicCollectionCheckpoint,
} from './astrolabe-dynamic-collection';

export type ReadingDynamicCheckpoint =
  AstrolabeDynamicReadingCheckpoint | AstrolabeDynamicCollectionCheckpoint;

export function isReadingDynamicCheckpoint(value: unknown): value is ReadingDynamicCheckpoint {
  return (
    isAstrolabeDynamicReadingCheckpoint(value) || isAstrolabeDynamicCollectionCheckpoint(value)
  );
}
