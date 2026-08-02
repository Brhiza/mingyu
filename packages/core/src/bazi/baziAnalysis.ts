import { Wuxing, BaziAnalysisResult } from './baziTypes';
import type { HiddenStems, Pillars } from './baziTypes';
import {
  analyzeFormation,
  analyzeRoot,
  analyzeSupport,
  analyzeConstraint,
  analyzeSeasonalStatus,
  analyzeDayMasterStrength,
} from './baziStrengthAnalyzer';
import { determinePattern } from './baziPatternStrategy';
import { createBaziAnalysisPipeline } from './baziAnalysisPipeline';

export class BaziAnalyzer {
  private getWuxing: (ganOrZhi: string) => Wuxing;
  private getTenGod: (gan: string, dayMaster: string) => string;
  private getSeasonStatus: (zhi: string) => Record<string, string>;
  private pipeline: ReturnType<typeof createBaziAnalysisPipeline>;

  constructor(
    getWuxing: (ganOrZhi: string) => Wuxing,
    getTenGod: (gan: string, dayMaster: string) => string,
    getSeasonStatus: (zhi: string) => Record<string, string>,
  ) {
    this.getWuxing = getWuxing;
    this.getTenGod = getTenGod;
    this.getSeasonStatus = getSeasonStatus;
    this.pipeline = createBaziAnalysisPipeline({
      getWuxing: this.getWuxing,
      getTenGod: this.getTenGod,
      getSeasonStatus: this.getSeasonStatus,
      analyzeFormation,
      analyzeRoot,
      analyzeSupport,
      analyzeConstraint,
      analyzeSeasonalStatus,
      analyzeDayMasterStrength,
      determinePattern,
    });
  }

  public analyzeBaziChart(
    pillars: Pillars,
    hiddenStems: HiddenStems,
    monthCommander?: string,
  ): BaziAnalysisResult {
    return this.pipeline.run({
      pillars,
      hiddenStems,
      monthCommander,
    });
  }
}
