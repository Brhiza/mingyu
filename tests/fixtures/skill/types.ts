export type ScenarioCategory =
  | 'vague-longterm'
  | 'longterm-startup'
  | 'missing-hour'
  | 'single-issue'
  | 'direction-negotiation'
  | 'complex-personnel'
  | 'astrology-transit'
  | 'qimen-lifetime'
  | 'synastry-match'
  | 'spatial-fengshui'
  | 'almanac-symbolic'
  | 'fault-and-safety';

export type ProviderMode = 'manual-fixture' | 'aov-fixture' | 'unavailable';

export interface ProvidedFacts {
  birthDateTime?: string;
  birthPlace?: string;
  timeZoneId?: string;
  gender?: 'male' | 'female';
  targetPeriod?: string;
  candidateCities?: string[];
  questionDetail?: string;
  requestedMethod?: string;
  manualChartData?: Record<string, unknown>;
  divinationTime?: string;
  hexagramLines?: number[];
  spreadType?: string;
  cards?: string[];
  sitMountain?: string;
  buildYear?: number;
}

export interface ExpectedRoute {
  primary: string[];
  supplementary: string[];
  prohibited?: string[];
}

export interface IntakeExpectations {
  coreIssue: string;
  timeHorizon: 'lifetime' | 'decadal' | 'multi-year' | 'yearly' | 'monthly' | 'daily' | 'moment';
  stage?: string;
  missingFields?: string[];
  degradationAction?: string;
  shouldRefuseDirectFortune?: boolean;
}

export interface SkillScenario {
  id: string;
  title: string;
  isBoundary: boolean;
  category: ScenarioCategory;
  userMessage: string;
  providedFacts: ProvidedFacts;
  intakeExpectations: IntakeExpectations;
  expectedRoute: ExpectedRoute;
  providerModes: ProviderMode[];
  requiredChecks: string[];
  forbiddenLeakage: string[];
  expectedPromptBlocks?: string[];
  notes?: string;
}

export type VerificationStatus = 'pass' | 'fail' | 'needs_review';

export interface ScoreLevelItem {
  status: VerificationStatus;
  passed: boolean;
  details: string;
}

export interface ModelExecutionArtifact {
  userReply: string;
  prompt?: string;
  identifiedMethods?: string[];
  telemetry?: {
    modelName?: string;
    isLiveOnline?: boolean;
    docsRead?: string[];
    isDegraded?: boolean;
    providerErrorReceived?: boolean;
    durationMs?: number;
    requestDigest?: string;
  };
}

export interface EvaluationResult {
  scenarioId: string;
  title: string;
  category: ScenarioCategory;
  providerMode: ProviderMode;
  passed: boolean;
  status: VerificationStatus;
  scoreLevels: {
    l0Intake: ScoreLevelItem;
    l1Routing: ScoreLevelItem;
    l2Evidence: ScoreLevelItem;
    l3DynamicSynthesis: ScoreLevelItem;
    l4OutputPrompt: ScoreLevelItem;
    l5SafetyPrivacy: ScoreLevelItem;
  };
  errors: string[];
  warnings: string[];
}
