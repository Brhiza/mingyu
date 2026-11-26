import * as React from 'react';
import { BookOpen, MapPin, Search, Sparkles } from 'lucide-react';
import {
  buildSelectionFromDistrict,
  findCascadeDistrictByPlace,
  getBirthPlaceCascadeIndex,
  type CascadeDistrictOption,
} from '../../v2-ui/birth-place-index';
import {
  DEFAULT_SUPPLEMENTARY_VALUES,
  INSPIRATION_CATEGORIES,
  INSPIRATION_LIBRARY,
  getSpecialInspirationForMethod,
  type InspirationCategoryId,
  type QuestionInspirationSection,
  type SupplementaryInfoValues,
} from '../../v2-ui/inspiration-modals';
import { lookupMetaphysicsTerm } from '../../systems/terms';
import { findHexagram, sourceUrl as zhouyiSourceUrl } from '../../systems/zhouyi-text';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '../../components/ui';
import { cn } from '../../lib/utils';
import {
  closePlaceModalSession,
  closeQuestionInspirationSession,
  closeSupplementaryInfoSession,
  closeTermModalSession,
  getModalBusSnapshot,
  subscribeModalBus,
  type InspirationModalSession,
  type PlaceModalSession,
  type SupplementaryModalSession,
  type TermModalSession,
} from '../modal-bus';

function BirthPlaceDialog({ session }: { session: PlaceModalSession | null }) {
  const index = React.useMemo(() => getBirthPlaceCascadeIndex(), []);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [draftProvinceId, setDraftProvinceId] = React.useState('');
  const [draftCityId, setDraftCityId] = React.useState('');
  const [draftDistrictId, setDraftDistrictId] = React.useState('');

  const cascadeRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!session) return;
    setSearchQuery('');
    const matched =
      findCascadeDistrictByPlace(session.options.initialDistrictId) ??
      findCascadeDistrictByPlace(session.options.initialPlace);
    if (matched) {
      setDraftProvinceId(matched.provinceId);
      setDraftCityId(matched.cityId);
      setDraftDistrictId(matched.id);
    } else {
      const firstProv = index.provinces[0];
      const firstCity = firstProv?.cities[0];
      const firstDist = firstCity?.districts[0];
      setDraftProvinceId(firstProv?.id ?? '');
      setDraftCityId(firstCity?.id ?? '');
      setDraftDistrictId(firstDist?.id ?? '');
    }
    const timer = window.setTimeout(() => {
      cascadeRef.current
        ?.querySelectorAll<HTMLElement>('[data-selected="true"]')
        .forEach((node) => node.scrollIntoView({ block: 'center', inline: 'nearest' }));
    }, 30);
    return () => window.clearTimeout(timer);
  }, [session, index]);

  const activeProvince = React.useMemo(
    () => index.provinces.find((p) => p.id === draftProvinceId),
    [index, draftProvinceId],
  );
  const cityOptions = activeProvince?.cities ?? [];
  const activeCity = React.useMemo(
    () => cityOptions.find((c) => c.id === draftCityId),
    [cityOptions, draftCityId],
  );
  const districtOptions = activeCity?.districts ?? [];
  const activeDistrict = React.useMemo(
    () => districtOptions.find((d) => d.id === draftDistrictId),
    [districtOptions, draftDistrictId],
  );

  const filteredResults = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const results: CascadeDistrictOption[] = [];
    for (const item of index.allDistricts) {
      if (!item.searchTerms.includes(q)) continue;
      results.push(item);
      if (results.length >= 60) break;
    }
    return results;
  }, [index, searchQuery]);

  const summaryText = `${activeProvince?.label || '未选择省份'} / ${activeCity?.label || '未选择城市'} / ${activeDistrict?.label || '未选择区县'}`;

  const handleConfirm = () => {
    const matched = draftDistrictId ? index.districtById.get(draftDistrictId) : undefined;
    if (!matched || !session) return;
    session.options.onConfirm?.(buildSelectionFromDistrict(matched));
    closePlaceModalSession(session.key);
  };

  return (
    <Dialog
      open={Boolean(session)}
      onOpenChange={(open) => {
        if (!open && session) closePlaceModalSession(session.key);
      }}
    >
      <DialogContent
        layer="nested"
        className="birth-place-modal-card max-w-[780px]"
        aria-labelledby="birth-place-modal-title"
      >
        <DialogHeader>
          <DialogTitle id="birth-place-modal-title" className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-[var(--accent-strong)]" />
            <span>{session?.options.purpose === 'observer' ? '选择观测地点' : '选择出生地'}</span>
          </DialogTitle>
          <DialogDescription>当前暂选：{summaryText}</DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto px-5 py-4">
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-3 h-4 w-4 text-[var(--text-muted)]" />
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索全国省市区县及海外主要城市..."
              className="pl-9"
              autoFocus
            />
          </div>

          {searchQuery.trim() ? (
            <div className="max-h-[320px] overflow-y-auto rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-2">
              {filteredResults.length === 0 ? (
                <div className="py-10 text-center text-xs text-[var(--text-muted)]">
                  未找到匹配地区，请更换城市或区县关键词。
                </div>
              ) : (
                <div className="grid gap-1">
                  {filteredResults.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setDraftProvinceId(item.provinceId);
                        setDraftCityId(item.cityId);
                        setDraftDistrictId(item.id);
                        setSearchQuery('');
                      }}
                      className="flex items-center justify-between rounded-lg border-0 bg-transparent px-3 py-2 text-left text-xs hover:bg-[var(--surface-base)] cursor-pointer"
                    >
                      <strong className="font-bold text-[var(--text-strong)]">{item.label}</strong>
                      <span className="text-[var(--text-muted)]">
                        {item.provinceLabel} / {item.cityLabel}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div ref={cascadeRef} className="grid grid-cols-3 gap-2.5">
              {/* 第一列：省份 */}
              <div className="flex h-[300px] flex-col overflow-hidden rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)]">
                <div className="shrink-0 border-b border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2 text-xs font-extrabold text-[var(--text-muted)]">
                  省份 / 区域
                </div>
                <div className="flex-1 overflow-y-auto p-1">
                  {index.provinces.map((prov) => {
                    const active = prov.id === draftProvinceId;
                    return (
                      <button
                        key={prov.id}
                        type="button"
                        data-selected={active ? 'true' : undefined}
                        onClick={() => {
                          setDraftProvinceId(prov.id);
                          const firstCity = prov.cities[0];
                          setDraftCityId(firstCity?.id ?? '');
                          setDraftDistrictId(firstCity?.districts[0]?.id ?? '');
                        }}
                        className={cn(
                          'block w-full rounded-lg border-0 px-2.5 py-1.5 text-left text-xs cursor-pointer transition-colors',
                          active
                            ? 'bg-[var(--state-selected-surface-strong)] font-bold text-[var(--state-selected-text)]'
                            : 'bg-transparent text-[var(--text-primary)] hover:bg-[var(--state-hover-surface)]',
                        )}
                      >
                        {prov.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 第二列：城市 */}
              <div className="flex h-[300px] flex-col overflow-hidden rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)]">
                <div className="shrink-0 border-b border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2 text-xs font-extrabold text-[var(--text-muted)]">
                  城市 / 国家
                </div>
                <div className="flex-1 overflow-y-auto p-1">
                  {cityOptions.map((city) => {
                    const active = city.id === draftCityId;
                    return (
                      <button
                        key={city.id}
                        type="button"
                        data-selected={active ? 'true' : undefined}
                        onClick={() => {
                          setDraftCityId(city.id);
                          setDraftDistrictId(city.districts[0]?.id ?? '');
                        }}
                        className={cn(
                          'block w-full rounded-lg border-0 px-2.5 py-1.5 text-left text-xs cursor-pointer transition-colors',
                          active
                            ? 'bg-[var(--state-selected-surface-strong)] font-bold text-[var(--state-selected-text)]'
                            : 'bg-transparent text-[var(--text-primary)] hover:bg-[var(--state-hover-surface)]',
                        )}
                      >
                        {city.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 第三列：区县 */}
              <div className="flex h-[300px] flex-col overflow-hidden rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)]">
                <div className="shrink-0 border-b border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2 text-xs font-extrabold text-[var(--text-muted)]">
                  区县 / 城市点
                </div>
                <div className="flex-1 overflow-y-auto p-1">
                  {districtOptions.map((dist) => {
                    const active = dist.id === draftDistrictId;
                    return (
                      <button
                        key={dist.id}
                        type="button"
                        data-selected={active ? 'true' : undefined}
                        onClick={() => setDraftDistrictId(dist.id)}
                        className={cn(
                          'block w-full rounded-lg border-0 px-2.5 py-1.5 text-left text-xs cursor-pointer transition-colors',
                          active
                            ? 'bg-[var(--state-selected-surface-strong)] font-bold text-[var(--state-selected-text)]'
                            : 'bg-transparent text-[var(--text-primary)] hover:bg-[var(--state-hover-surface)]',
                        )}
                      >
                        {dist.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="birth-place-modal-actions">
          <Button
            variant="secondary"
            size="md"
            onClick={() => session && closePlaceModalSession(session.key)}
          >
            取消
          </Button>
          <Button
            variant="primary"
            size="md"
            disabled={!draftDistrictId}
            onClick={handleConfirm}
          >
            确认选择
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuestionInspirationDialog({ session }: { session: InspirationModalSession | null }) {
  const special = React.useMemo(
    () => (session?.method ? getSpecialInspirationForMethod(session.method) : undefined),
    [session],
  );
  const filters = React.useMemo(
    () => [
      ...(special ? [{ value: 'special', label: special.label }] : []),
      ...INSPIRATION_CATEGORIES.map((cat) => ({ value: cat.id, label: cat.label })),
    ],
    [special],
  );
  const [activeFilter, setActiveFilter] = React.useState('marriage');
  const [searchQuery, setSearchQuery] = React.useState('');

  React.useEffect(() => {
    if (!session) return;
    setActiveFilter(special ? 'special' : 'marriage');
    setSearchQuery('');
  }, [session, special]);

  const matchedSections = React.useMemo<QuestionInspirationSection[]>(() => {
    const kw = searchQuery.trim();
    const raw =
      activeFilter === 'special' && special
        ? special.sections
        : INSPIRATION_LIBRARY[activeFilter as Exclude<InspirationCategoryId, 'special'>] ??
          INSPIRATION_LIBRARY.marriage;
    return raw
      .map((sec, idx) => ({
        id: `${activeFilter}-${idx}`,
        heading: sec.heading,
        items: sec.questions
          .filter((q) => !kw || q.includes(kw))
          .map((q, qIdx) => ({ id: `${activeFilter}-${idx}-${qIdx}`, question: q })),
      }))
      .filter((sec) => sec.items.length > 0);
  }, [activeFilter, special, searchQuery]);

  return (
    <Dialog
      open={Boolean(session)}
      onOpenChange={(open) => {
        if (!open) closeQuestionInspirationSession();
      }}
    >
      <DialogContent layer="nested" className="max-w-[740px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--accent-strong)]" />
            <span>问题灵感</span>
          </DialogTitle>
          <DialogDescription>按领域浏览常见问法，点击后自动写入当前提示词问题</DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto px-5 py-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {filters.map((f) => (
              <Button
                key={f.value}
                variant={activeFilter === f.value ? 'pillActive' : 'pill'}
                size="xs"
                onClick={() => setActiveFilter(f.value)}
              >
                {f.label}
              </Button>
            ))}
          </div>

          <Input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索常见问题关键词..."
            autoFocus
          />

          {matchedSections.length === 0 ? (
            <div className="py-10 text-center text-xs text-[var(--text-muted)]">
              没有找到匹配的问题，请换个搜索词或切换主题分类。
            </div>
          ) : (
            <div className="grid gap-4">
              {matchedSections.map((sec) => (
                <section key={sec.id} className="grid gap-2">
                  {sec.heading ? (
                    <h3 className="m-0 text-xs font-extrabold text-[var(--text-muted)]">
                      {sec.heading}
                    </h3>
                  ) : null}
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {sec.items.map((item) => {
                      const isSelected = session?.selectedQuestion === item.question;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            session?.onSelect(item.question);
                            closeQuestionInspirationSession();
                          }}
                          className={cn(
                            'rounded-xl border px-3 py-2.5 text-left text-xs leading-relaxed cursor-pointer transition-colors',
                            isSelected
                              ? 'border-[var(--accent-strong)] bg-[var(--state-selected-surface)] font-bold text-[var(--state-selected-text)]'
                              : 'border-[var(--border-soft)] bg-[var(--surface-soft)] text-[var(--text-primary)] hover:border-[var(--border-contrast)] hover:bg-[var(--surface-base)]',
                          )}
                        >
                          {item.question}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const SUPPLEMENTARY_TEXT_FIELDS: ReadonlyArray<{
  key: 'userSupplement' | 'constraints';
  label: string;
  placeholder: string;
}> = [
  {
    key: 'userSupplement',
    label: '现状与已知前提',
    placeholder: '简述当前事件经过、已确定的客观事实或各方态度…',
  },
  {
    key: 'constraints',
    label: '期望目标与现实限制',
    placeholder: '说明想优先达成的目标，或时间期限、资金、地域等现实约束…',
  },
];

function SupplementaryInfoDialog({ session }: { session: SupplementaryModalSession | null }) {
  const [draft, setDraft] = React.useState<SupplementaryInfoValues>(DEFAULT_SUPPLEMENTARY_VALUES);

  React.useEffect(() => {
    if (!session) return;
    const vals = session.values ?? {};
    const mergedUser = [
      vals.userSupplement,
      vals.currentSituation,
      vals.currentState,
      vals.knownFacts,
    ]
      .filter((s) => s?.trim())
      .join('\n');
    const mergedConstraints = [vals.desiredOutcome, vals.constraints]
      .filter((s) => s?.trim())
      .join('\n');
    setDraft({
      ...DEFAULT_SUPPLEMENTARY_VALUES,
      ...vals,
      userSupplement: mergedUser,
      currentSituation: '',
      currentState: '',
      knownFacts: '',
      desiredOutcome: '',
      constraints: mergedConstraints,
    });
  }, [session]);

  return (
    <Dialog
      open={Boolean(session)}
      onOpenChange={(open) => {
        if (!open) closeSupplementaryInfoSession();
      }}
    >
      <DialogContent layer="nested" className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>详细背景补充</DialogTitle>
          <DialogDescription>
            {session?.description ??
              '补充事件经过、已知客观前提与现实限制，留空部分不会写入提示词。'}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            session?.onSave(draft);
            closeSupplementaryInfoSession();
          }}
          className="grid min-h-0 flex-1 grid-cols-1 gap-3.5 overflow-y-auto px-5 py-4"
        >
          {SUPPLEMENTARY_TEXT_FIELDS.map((field) => (
            <label
              key={field.key}
              className="grid gap-1.5 text-xs font-bold text-[var(--text-secondary)]"
            >
              <span>{field.label}</span>
              <textarea
                rows={3}
                value={draft[field.key]}
                placeholder={field.placeholder}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, [field.key]: e.target.value }))
                }
                className="w-full min-w-0 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] p-2.5 text-[13px] font-normal text-[var(--text-strong)] placeholder:text-[var(--text-soft)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)]"
              />
            </label>
          ))}

          <DialogFooter className="-mx-5 -mb-4 mt-1 px-5 py-3">
            <Button
              variant="secondary"
              size="md"
              onClick={() => closeSupplementaryInfoSession()}
            >
              取消
            </Button>
            <Button type="submit" variant="primary" size="md">
              保存补充
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TermDetailDialog({ session }: { session: TermModalSession | null }) {
  const resolved = React.useMemo(() => {
    if (!session) return null;
    const cleaned = session.query.trim();
    const term = lookupMetaphysicsTerm(cleaned);
    const stripped = cleaned.replace(/卦$/u, '').trim();
    const shouldLookupHex =
      session.fallback?.preferHexagram ||
      cleaned.endsWith('卦') ||
      stripped.length >= 2 ||
      !term;
    const hexagram = shouldLookupHex ? findHexagram(cleaned) : undefined;
    return { cleaned, term, hexagram, fallback: session.fallback };
  }, [session]);

  const title =
    resolved?.term?.term ??
    (resolved?.hexagram ? `第${resolved.hexagram.id}卦 · ${resolved.hexagram.name}` : undefined) ??
    resolved?.fallback?.title ??
    resolved?.cleaned ??
    '术数术语详释';

  const category =
    resolved?.term?.category ??
    (resolved?.hexagram ? `周易六十四卦 · ${resolved.hexagram.palace}宫` : undefined) ??
    resolved?.fallback?.category ??
    '词义参考';

  const subtitle =
    resolved?.term?.summary ??
    (resolved?.hexagram
      ? `上${resolved.hexagram.upper}下${resolved.hexagram.lower} · ${resolved.hexagram.palace}宫卦`
      : undefined) ??
    resolved?.fallback?.subtitle;

  return (
    <Dialog
      open={Boolean(session)}
      onOpenChange={(open) => {
        if (!open) closeTermModalSession();
      }}
    >
      <DialogContent layer="nested" className="max-w-2xl" aria-label={title}>
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2 pr-8">
            <Badge variant="accent">{category}</Badge>
            {resolved?.term?.aliases && resolved.term.aliases.length > 0 && (
              <span className="text-[12px] text-[var(--text-muted)]">
                别名：{resolved.term.aliases.join('、')}
              </span>
            )}
          </div>
          <DialogTitle className="mt-1 flex items-center gap-2">
            <BookOpen className="size-4 text-[var(--accent-strong)] shrink-0" />
            <span>{title}</span>
          </DialogTitle>
          {subtitle && <DialogDescription>{subtitle}</DialogDescription>}
        </DialogHeader>

        <div className="flex max-h-[64vh] flex-col gap-3.5 overflow-y-auto px-5 py-4 text-[13.5px] leading-relaxed text-[var(--text-primary)]">
          {resolved?.term && (
            <div className="flex flex-col gap-3">
              <div className="rounded-[var(--radius-md)] border border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-3">
                <div className="mb-1 text-[11.5px] font-semibold text-[var(--accent-strong)]">
                  术语精解
                </div>
                <p className="text-[13.5px] leading-relaxed text-[var(--text-primary)]">
                  {resolved.term.detail}
                </p>
              </div>

              {(resolved.term.positive || resolved.term.negative) && (
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {resolved.term.positive && (
                    <div className="rounded-[var(--radius-md)] border border-[rgba(22,101,52,0.18)] bg-[rgba(240,253,244,0.65)] px-3.5 py-2.5">
                      <div className="mb-0.5 text-[11.5px] font-semibold text-[#166534]">
                        吉象 / 得用
                      </div>
                      <p className="text-[12.5px] text-[var(--text-secondary)]">
                        {resolved.term.positive}
                      </p>
                    </div>
                  )}
                  {resolved.term.negative && (
                    <div className="rounded-[var(--radius-md)] border border-[rgba(180,83,9,0.2)] bg-[rgba(255,251,235,0.75)] px-3.5 py-2.5">
                      <div className="mb-0.5 text-[11.5px] font-semibold text-[#9a3412]">
                        忌象 / 留意
                      </div>
                      <p className="text-[12.5px] text-[var(--text-secondary)]">
                        {resolved.term.negative}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {resolved.term.advice && (
                <div className="rounded-[var(--radius-md)] border border-[var(--border-soft)] bg-[var(--surface-panel)] px-3.5 py-2.5">
                  <div className="mb-0.5 text-[11.5px] font-semibold text-[var(--text-secondary)]">
                    推演取用参考
                  </div>
                  <p className="text-[12.5px] text-[var(--text-secondary)]">
                    {resolved.term.advice}
                  </p>
                </div>
              )}

              {resolved.term.classicRef && (
                <div className="text-[12px] text-[var(--text-muted)]">
                  典籍出处：{resolved.term.classicRef}
                </div>
              )}
            </div>
          )}

          {resolved?.hexagram && (
            <div className="flex flex-col gap-3">
              <div className="rounded-[var(--radius-md)] border border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-3">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11.5px] font-semibold text-[var(--accent-strong)]">
                    《周易》第{resolved.hexagram.id}卦 · {resolved.hexagram.name}
                  </span>
                  <span className="text-[11.5px] text-[var(--text-muted)]">
                    上{resolved.hexagram.upper}下{resolved.hexagram.lower} · {resolved.hexagram.palace}宫
                  </span>
                </div>
                <p className="font-semibold text-[var(--text-primary)]">
                  卦辞：{resolved.hexagram.guaCi}
                </p>
                <p className="mt-1.5 text-[12.5px] text-[var(--text-secondary)]">
                  彖传：{resolved.hexagram.tuanCi}
                </p>
                <p className="mt-1 text-[12.5px] text-[var(--text-secondary)]">
                  大象：{resolved.hexagram.daXiang}
                </p>
                {resolved.hexagram.yongCi && (
                  <p className="mt-1 text-[12.5px] text-[var(--text-secondary)]">
                    用辞：{resolved.hexagram.yongCi}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {resolved.hexagram.yaos.map((yao) => (
                  <div
                    key={yao.position}
                    className="rounded-[var(--radius-sm)] border border-[var(--border-soft)] bg-[var(--surface-panel)] px-3 py-2"
                  >
                    <div className="text-[12px] font-semibold text-[var(--accent-strong)]">
                      {yao.positionName}：{yao.yaoCi}
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-[var(--text-muted)]">
                      象曰：{yao.xiaoXiang}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-[var(--text-muted)]">
                <span>维基文库校订版《周易》经文（仅作当前卦象参考）</span>
                <a
                  href={zhouyiSourceUrl(resolved.hexagram)}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="underline hover:text-[var(--accent-strong)]"
                >
                  查看校勘版本
                </a>
              </div>
            </div>
          )}

          {!resolved?.term && !resolved?.hexagram && (
            <div className="flex flex-col gap-3">
              {resolved?.fallback?.keywords && resolved.fallback.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {resolved.fallback.keywords.map((kw) => (
                    <Badge key={kw} variant="default">
                      {kw}
                    </Badge>
                  ))}
                </div>
              )}
              {(resolved?.fallback?.detail || resolved?.fallback?.summary) ? (
                <div className="rounded-[var(--radius-md)] border border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-3">
                  {resolved.fallback.summary && (
                    <p className="font-medium text-[var(--text-primary)]">
                      {resolved.fallback.summary}
                    </p>
                  )}
                  {resolved.fallback.detail && (
                    <p className="mt-1.5 text-[13px] text-[var(--text-secondary)]">
                      {resolved.fallback.detail}
                    </p>
                  )}
                  {resolved.fallback.advice && (
                    <p className="mt-1.5 text-[12.5px] text-[var(--text-muted)]">
                      解读线索：{resolved.fallback.advice}
                    </p>
                  )}
                  {resolved.fallback.classicRef && (
                    <p className="mt-1.5 text-[11.5px] text-[var(--text-muted)]">
                      依据：{resolved.fallback.classicRef}
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-[var(--radius-md)] border border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-3 text-[var(--text-secondary)]">
                  暂未收录「{resolved?.cleaned}」的独立百科词条，请结合当前盘面主宫关系、十神生克或所占问事综合判断。
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="primary" size="md" onClick={() => closeTermModalSession()}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PortalModals() {
  const [snap, setSnap] = React.useState(() => getModalBusSnapshot());

  React.useEffect(() => {
    return subscribeModalBus(() => setSnap(getModalBusSnapshot()));
  }, []);

  return (
    <>
      <BirthPlaceDialog session={snap.place} />
      <QuestionInspirationDialog session={snap.inspiration} />
      <SupplementaryInfoDialog session={snap.supplementary} />
      <TermDetailDialog session={snap.term} />
    </>
  );
}
