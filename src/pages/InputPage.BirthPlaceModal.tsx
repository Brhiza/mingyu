import { memo } from 'react';
import { WorkspaceButton, WorkspaceDialog } from '@/components/workspace/WorkspaceUI';
import type { useBirthPlace } from '@/hooks/useBirthPlace';

export interface BirthPlaceModalProps {
  birthPlace: ReturnType<typeof useBirthPlace>;
  backdropClassName?: string;
  purpose?: 'birth' | 'observer';
}

function BirthPlaceModalImpl({
  birthPlace,
  backdropClassName = '',
  purpose = 'birth',
}: BirthPlaceModalProps) {
  if (!birthPlace.isBirthPlaceModalOpen) {
    return null;
  }

  return (
    <WorkspaceDialog
      className="birth-place-modal-card"
      backdropClassName={backdropClassName}
      labelledBy="birth-place-modal-title"
      onClose={birthPlace.closeBirthPlaceModal}
    >
      <header className="workspace-ui-dialog-header">
        <h2 id="birth-place-modal-title">
          {purpose === 'observer' ? '选择观测地点' : '选择出生地'}
        </h2>
      </header>

      <div className="birth-place-modal workspace-ui-dialog-body">
        <div className="birth-place-modal-body">
          <div className="draft-selection-tip">当前暂选：{birthPlace.draftSummary}</div>

          <div className="birth-place-search">
            <input
              value={birthPlace.birthPlaceSearch}
              type="text"
              className="workspace-ui-control"
              placeholder="搜索全国城市及地区"
              onChange={(event) => birthPlace.setBirthPlaceSearch(event.target.value)}
            />
          </div>

          {birthPlace.isBirthPlaceDataLoading && birthPlace.provinceOptions.length === 0 ? (
            <div className="birth-place-skeleton" aria-hidden="true">
              <span className="skeleton-block birth-place-skeleton-line" />
              <span className="skeleton-block birth-place-skeleton-line birth-place-skeleton-line-short" />
              <div className="birth-place-skeleton-columns">
                {Array.from({ length: 3 }, (_, index) => (
                  <div className="birth-place-skeleton-column" key={`column-${index}`}>
                    <span className="skeleton-block birth-place-skeleton-title" />
                    {Array.from({ length: 5 }, (_, itemIndex) => (
                      <span
                        className="skeleton-block birth-place-skeleton-item"
                        key={`item-${index}-${itemIndex}`}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : birthPlace.birthPlaceSearch ? (
            <div className="search-results">
              {birthPlace.filteredDistrictResults.map((item) => (
                <button
                  key={item.districtId}
                  type="button"
                  className="search-result-item"
                  onClick={() => birthPlace.selectDistrictFromSearch(item.districtId)}
                >
                  <span className="search-result-main">{item.districtLabel}</span>
                  <span className="search-result-sub">
                    {item.provinceLabel} / {item.cityLabel}
                  </span>
                </button>
              ))}
              {birthPlace.filteredDistrictResults.length === 0 ? (
                <div className="search-empty">未找到匹配地区，请换个关键词。</div>
              ) : null}
            </div>
          ) : (
            <div className="cascade-panel">
              <div className="cascade-column">
                <div className="cascade-title">省份</div>
                {birthPlace.provinceOptions.map((province) => (
                  <button
                    key={province.id}
                    id={`birth-place-province-${province.id}`}
                    type="button"
                    className={`cascade-item ${province.id === birthPlace.draftProvinceId ? 'active' : ''}`}
                    onClick={() => birthPlace.handleProvinceSelect(province.id)}
                  >
                    {province.label}
                  </button>
                ))}
              </div>
              <div className="cascade-column">
                <div className="cascade-title">城市</div>
                {birthPlace.cityOptions.map((city) => (
                  <button
                    key={city.id}
                    id={`birth-place-city-${city.id}`}
                    type="button"
                    className={`cascade-item ${city.id === birthPlace.draftCityId ? 'active' : ''}`}
                    onClick={() => birthPlace.handleCitySelect(city.id)}
                  >
                    {city.label}
                  </button>
                ))}
              </div>
              <div className="cascade-column">
                <div className="cascade-title">区县</div>
                {birthPlace.districtOptions.map((district) => (
                  <button
                    key={district.id}
                    id={`birth-place-district-${district.id}`}
                    type="button"
                    className={`cascade-item ${district.id === birthPlace.draftDistrictId ? 'active' : ''}`}
                    onClick={() => birthPlace.handleDistrictSelect(district.id)}
                  >
                    {district.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="workspace-ui-dialog-footer birth-place-modal-actions">
        <WorkspaceButton onClick={birthPlace.closeBirthPlaceModal}>取消</WorkspaceButton>
        <WorkspaceButton
          variant="primary"
          disabled={!birthPlace.draftDistrictId}
          onClick={birthPlace.confirmBirthPlaceSelection}
        >
          确认选择
        </WorkspaceButton>
      </footer>
    </WorkspaceDialog>
  );
}

export const BirthPlaceModal = memo(BirthPlaceModalImpl);
