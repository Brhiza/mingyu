import type * as React from 'react';
import type { Method } from '../method-meta';
import {
  getPersonalCaseById,
  loadCompatibilityRecords,
  loadDivinationRecords,
  setActiveCaseId,
  type PersonalCase,
} from '../v2-ui/cases-store';
import {
  isCompatibilityChartMethod,
  isPersonalChartMethod,
  type CompatibilityChartTabId,
  type PersonalChartTabId,
} from '../v2-ui/chart-tabs';
import type { ResultPageController } from '../v2-ui/result-page';
import type { TopDomainId, WorkspaceRouteId } from './workspace-catalog';
import {
  loadResultSnapshot,
  resolveResultFallbackTarget,
  type ParsedWorkspaceLocation,
  type ResultMode,
} from './workspace-router';

export interface ActiveResultMeta {
  mode: ResultMode;
  caseId?: string;
  recordId?: string;
  featureId: string;
  domainHint: TopDomainId;
}

export interface RestoreResultDeps {
  activeResultMetaRef: React.MutableRefObject<ActiveResultMeta>;
  setCompatibilityMethod: (method: CompatibilityChartTabId) => void;
  setPreferredPersonalChartTab: (tab: PersonalChartTabId) => void;
  openResult: (ctx: Parameters<ResultPageController['openWithContext']>[0]) => Promise<void>;
  navigateToRoute: (
    route: WorkspaceRouteId,
    params?: {
      featureId?: string;
      method?: Method;
      domain?: TopDomainId;
      historyMode?: 'push' | 'replace' | 'none';
    },
  ) => void;
}

export async function restoreResultFromLocationAction(
  deps: RestoreResultDeps,
  parsed: ParsedWorkspaceLocation,
): Promise<void> {
  const snapshot = loadResultSnapshot();
  const refMode = parsed.resultRef?.mode;
  const refCaseId = parsed.resultRef?.caseId;
  const refRecordId = parsed.resultRef?.recordId;

  if (
    snapshot &&
    (snapshot.url === parsed.canonicalPath ||
      (snapshot.activeMethod === parsed.method &&
        (!refMode || snapshot.mode === refMode) &&
        (!refRecordId || snapshot.recordId === refRecordId) &&
        (!refCaseId || snapshot.caseId === refCaseId)))
  ) {
    deps.activeResultMetaRef.current = {
      mode: snapshot.mode,
      caseId: snapshot.caseId,
      recordId: snapshot.recordId,
      featureId: snapshot.featureId || parsed.featureId,
      domainHint: snapshot.domainHint || parsed.domainHint,
    };
    await deps.openResult({
      mode: snapshot.mode,
      activeMethod: snapshot.activeMethod,
      person: snapshot.person as PersonalCase | undefined,
      partner: snapshot.partner as PersonalCase | undefined,
      question: snapshot.question,
      initialPayload: snapshot.initialPayload,
      initialResult: snapshot.initialResult,
    });
    return;
  }

  if (refRecordId) {
    if (refMode === 'compatibility' || isCompatibilityChartMethod(parsed.method)) {
      const compatRec = loadCompatibilityRecords().find((r) => r.id === refRecordId);
      if (compatRec) {
        const tab: CompatibilityChartTabId = isCompatibilityChartMethod(parsed.method)
          ? parsed.method
          : isCompatibilityChartMethod(compatRec.method)
            ? compatRec.method
            : 'bazi-synastry';
        deps.setCompatibilityMethod(tab);
        deps.activeResultMetaRef.current = {
          mode: 'compatibility',
          recordId: compatRec.id,
          featureId: 'compatibility',
          domainHint: 'personal-chart',
        };
        await deps.openResult({
          mode: 'compatibility',
          activeMethod: tab,
          person: compatRec.person1,
          partner: compatRec.person2,
          question: compatRec.question,
        });
        return;
      }
    } else {
      const divRec = loadDivinationRecords().find((r) => r.id === refRecordId);
      if (divRec) {
        let payload: Record<string, unknown> = {};
        try {
          payload = JSON.parse(divRec.inputJson) as Record<string, unknown>;
        } catch {}
        const method = parsed.method;
        const mode: ResultMode =
          isPersonalChartMethod(method) && parsed.domainHint === 'personal-chart'
            ? 'personal'
            : 'divination';
        deps.activeResultMetaRef.current = {
          mode,
          recordId: divRec.id,
          featureId: parsed.featureId,
          domainHint: parsed.domainHint,
        };
        await deps.openResult({
          mode,
          activeMethod: method,
          question: divRec.question,
          initialPayload: payload,
          initialResult: divRec.result as {
            summary?: unknown;
            prompt?: { text: string };
            data?: unknown;
          },
        });
        return;
      }
    }
  }

  if (refCaseId && isPersonalChartMethod(parsed.method)) {
    const foundCase = getPersonalCaseById(refCaseId);
    if (foundCase) {
      setActiveCaseId(foundCase.id);
      deps.setPreferredPersonalChartTab(parsed.method);
      deps.activeResultMetaRef.current = {
        mode: 'personal',
        caseId: foundCase.id,
        featureId: parsed.method,
        domainHint: 'personal-chart',
      };
      await deps.openResult({
        mode: 'personal',
        activeMethod: parsed.method,
        person: foundCase,
      });
      return;
    }
  }

  const fallback = resolveResultFallbackTarget({
    method: parsed.method,
    mode: parsed.resultRef?.mode,
    featureId: parsed.featureId,
    domainHint: parsed.domainHint,
  });
  deps.navigateToRoute(fallback.route, {
    ...fallback,
    historyMode: 'replace',
  });
}
