import * as React from 'react';
import {
  loadCompatibilityRecords,
  loadDivinationRecords,
  loadPersonalCases,
  onCasesStoreChange,
} from '../../v2-ui/cases-store';

/**
 * 统一订阅个人档案、占卜历史与合盘记录的 React Hook，
 * 替代工作台内分散的 storeRevision 手动监听。
 */
export function useCasesStore() {
  const [storeRevision, setStoreRevision] = React.useState(0);

  React.useEffect(() => {
    return onCasesStoreChange(() => setStoreRevision((n) => n + 1));
  }, []);

  const bumpStoreRevision = React.useCallback(() => {
    setStoreRevision((n) => n + 1);
  }, []);

  const personalCases = React.useMemo(() => {
    void storeRevision;
    return loadPersonalCases();
  }, [storeRevision]);

  const divinationRecords = React.useMemo(() => {
    void storeRevision;
    return loadDivinationRecords();
  }, [storeRevision]);

  const compatibilityRecords = React.useMemo(() => {
    void storeRevision;
    return loadCompatibilityRecords();
  }, [storeRevision]);

  return {
    storeRevision,
    setStoreRevision,
    bumpStoreRevision,
    personalCases,
    divinationRecords,
    compatibilityRecords,
  };
}
