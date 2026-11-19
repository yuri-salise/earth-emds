import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchEventArticles,
  fetchEventDetail,
  fetchEvents,
  fetchHealthStatus,
  filterEventsClientSide,
  triggerBackendSync,
} from './api/client';
import { FALLBACK_EVENTS, FALLBACK_HEALTH } from './api/fallbackData';
import { EventDetailDrawer } from './components/EventDetailDrawer';
import { EventSidebarList } from './components/EventSidebarList';
import { FilterBar } from './components/FilterBar';
import { FreshnessBanner } from './components/FreshnessBanner';
import { Header } from './components/Header';
import { EventFilters, HazardEvent, HealthStatus, ScoredArticle } from './types/domain';
import { FILTER_CATEGORIES, isCategoryMatch } from './utils/categories';
import { soundFx } from './utils/soundFx';

const LazyGlobeCanvas = lazy(() =>
  import('./components/GlobeCanvas').then((m) => ({ default: m.GlobeCanvas }))
);

const INITIAL_FILTERS: EventFilters = {
  q: '',
  category: 'all',
  status: 'all',
  start_date: '',
  end_date: '',
  useBbox: false,
  bbox: [-160, -65, 165, 70],
};

function readInitialFiltersFromUrl(): EventFilters {
  if (typeof window === 'undefined') return INITIAL_FILTERS;
  try {
    const params = new URLSearchParams(window.location.search);
    const statusParam = params.get('status');
    const status: EventFilters['status'] =
      statusParam === 'open' || statusParam === 'closed' ? statusParam : 'all';
    return {
      ...INITIAL_FILTERS,
      q: params.get('q') || '',
      category: params.get('category') || 'all',
      status,
      start_date: params.get('start_date') || '',
      end_date: params.get('end_date') || '',
    };
  } catch {
    return INITIAL_FILTERS;
  }
}

export const App: React.FC = () => {
  const [filters, setFilters] = useState<EventFilters>(readInitialFiltersFromUrl);
  const [events, setEvents] = useState<HazardEvent[]>(FALLBACK_EVENTS);
  const [totalCount, setTotalCount] = useState<number>(FALLBACK_EVENTS.length);
  const [allEvents, setAllEvents] = useState<HazardEvent[]>(FALLBACK_EVENTS);
  const [health, setHealth] = useState<HealthStatus>(FALLBACK_HEALTH);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string>(FALLBACK_HEALTH.last_updated_at);
  const [isLoadingEvents, setIsLoadingEvents] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const [selectedEvent, setSelectedEvent] = useState<HazardEvent | null>(null);
  const [articles, setArticles] = useState<ScoredArticle[]>([]);
  const [isLoadingArticles, setIsLoadingArticles] = useState<boolean>(false);

  const [liteMode, setLiteMode] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => soundFx.isEnabled());
  const [showDisclaimersModal, setShowDisclaimersModal] = useState<boolean>(false);

  const allEventsRef = useRef<HazardEvent[]>(FALLBACK_EVENTS);
  const hasInitialLoadedRef = useRef<boolean>(false);
  const eventsAbortRef = useRef<AbortController | null>(null);
  const eventsReqIdRef = useRef<number>(0);
  const detailAbortRef = useRef<AbortController | null>(null);
  const detailReqIdRef = useRef<number>(0);
  const selectedEventIdRef = useRef<string | null>(null);
  const prevQueryRef = useRef<string>(filters.q);
  const latestBboxRef = useRef<[number, number, number, number]>(INITIAL_FILTERS.bbox!);

  // Sync non-default filters to URL query parameters for shareable deep links
  useEffect(() => {
    if (typeof window === 'undefined' || !window.history?.replaceState) return;
    try {
      const url = new URL(window.location.href);
      const setOrDelete = (key: string, val: string, defaultVal = '') => {
        if (val && val !== defaultVal) url.searchParams.set(key, val);
        else url.searchParams.delete(key);
      };
      setOrDelete('q', filters.q.trim());
      setOrDelete('category', filters.category, 'all');
      setOrDelete('status', filters.status, 'all');
      setOrDelete('start_date', filters.start_date);
      setOrDelete('end_date', filters.end_date);
      const nextUrl = `${url.pathname}${url.search}${url.hash}`;
      if (nextUrl !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
        window.history.replaceState(null, '', nextUrl);
      }
    } catch {
      // Ignore in restricted history environments
    }
  }, [filters.q, filters.category, filters.status, filters.start_date, filters.end_date]);

  const loadEventsAndHealth = useCallback(
    async (activeFilters: EventFilters, isManualSync = false) => {
      eventsAbortRef.current?.abort();
      const controller = new AbortController();
      eventsAbortRef.current = controller;
      const reqId = ++eventsReqIdRef.current;

      if (isManualSync) {
        setIsSyncing(true);
      } else if (!hasInitialLoadedRef.current) {
        setIsLoadingEvents(true);
      }

      try {
        if (isManualSync) {
          await triggerBackendSync(controller.signal);
        }

        if (!hasInitialLoadedRef.current || isManualSync) {
          const [eventsRes, healthRes] = await Promise.all([
            fetchEvents(INITIAL_FILTERS, controller.signal),
            fetchHealthStatus(controller.signal),
          ]);
          if (reqId !== eventsReqIdRef.current) return;

          allEventsRef.current = eventsRes.items;
          setAllEvents(eventsRes.items);
          hasInitialLoadedRef.current = true;

          const filtered = filterEventsClientSide(eventsRes.items, activeFilters);
          setEvents(filtered);
          setTotalCount(
            activeFilters === INITIAL_FILTERS && !eventsRes.is_demo_fallback
              ? eventsRes.total
              : filtered.length
          );
          setLastUpdatedAt(eventsRes.last_updated_at || healthRes.last_updated_at);
          setHealth({
            ...healthRes,
            cache_freshness:
              eventsRes.cache_freshness === 'cached_fallback'
                ? 'cached_fallback'
                : healthRes.cache_freshness,
          });
        } else {
          const eventsRes = await fetchEvents(activeFilters, controller.signal);
          if (reqId !== eventsReqIdRef.current) return;

          setEvents(eventsRes.items);
          setTotalCount(eventsRes.total);
          if (eventsRes.last_updated_at) {
            setLastUpdatedAt(eventsRes.last_updated_at);
          }
          if (eventsRes.cache_freshness === 'cached_fallback') {
            setHealth((prev) =>
              prev.cache_freshness === 'cached_fallback'
                ? prev
                : { ...prev, cache_freshness: 'cached_fallback' }
            );
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
      } finally {
        if (reqId === eventsReqIdRef.current) {
          setIsLoadingEvents(false);
          setIsSyncing(false);
        }
      }
    },
    []
  );

  // Instant optimistic client filter + debounced remote search (avoids request storms & race conditions)
  useEffect(() => {
    const queryChanged = filters.q !== prevQueryRef.current;
    prevQueryRef.current = filters.q;

    if (hasInitialLoadedRef.current) {
      const optimistic = filterEventsClientSide(allEventsRef.current, filters);
      setEvents(optimistic);
      setTotalCount(optimistic.length);
    }

    if (queryChanged && hasInitialLoadedRef.current) {
      const timerId = window.setTimeout(() => {
        void loadEventsAndHealth(filters, false);
      }, 220);
      return () => window.clearTimeout(timerId);
    }

    void loadEventsAndHealth(filters, false);
    return undefined;
  }, [filters, loadEventsAndHealth]);

  // Cleanup active fetches on unmount
  useEffect(() => {
    return () => {
      eventsAbortRef.current?.abort();
      detailAbortRef.current?.abort();
    };
  }, []);

  const handleSelectEvent = useCallback(async (ev: HazardEvent) => {
    detailAbortRef.current?.abort();
    const controller = new AbortController();
    detailAbortRef.current = controller;
    const reqId = ++detailReqIdRef.current;

    const wasClosed = selectedEventIdRef.current === null;
    const isDifferentEvent = selectedEventIdRef.current !== ev.id;
    selectedEventIdRef.current = ev.id;

    setSelectedEvent(ev);
    if (isDifferentEvent) {
      setArticles([]);
    }
    if (wasClosed) {
      soundFx.playDrawerOpen();
    }
    setIsLoadingArticles(true);

    try {
      const [detailedEvent, fetchedArticles] = await Promise.all([
        fetchEventDetail(ev.id, controller.signal),
        fetchEventArticles(ev.id, controller.signal),
      ]);
      if (reqId !== detailReqIdRef.current) return;
      if (detailedEvent) {
        setSelectedEvent(detailedEvent);
      }
      setArticles(fetchedArticles);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
    } finally {
      if (reqId === detailReqIdRef.current) {
        setIsLoadingArticles(false);
      }
    }
  }, []);

  const handleCloseDrawer = useCallback(() => {
    detailAbortRef.current?.abort();
    detailReqIdRef.current += 1;
    selectedEventIdRef.current = null;
    setSelectedEvent(null);
    setArticles([]);
    setIsLoadingArticles(false);
  }, []);

  const handleSyncNow = useCallback(() => {
    soundFx.playSyncPing();
    void loadEventsAndHealth(filters, true);
    const currentSelectedId = selectedEventIdRef.current;
    if (currentSelectedId) {
      void fetchEventArticles(currentSelectedId).then((nextArts) => {
        if (selectedEventIdRef.current === currentSelectedId) {
          setArticles(nextArts);
        }
      });
    }
  }, [filters, loadEventsAndHealth]);

  const handleToggleLiteMode = useCallback(() => {
    soundFx.playFilter();
    setLiteMode((prev) => !prev);
  }, []);

  const handleToggleSound = useCallback(() => {
    const next = soundFx.toggle();
    setSoundEnabled(next);
  }, []);

  const handleToggleDisclaimersModal = useCallback(() => {
    soundFx.playFilter();
    setShowDisclaimersModal((prev) => !prev);
  }, []);

  const handleCloseDisclaimers = useCallback(() => {
    soundFx.playDrawerClose();
    setShowDisclaimersModal(false);
  }, []);

  const handleViewportBboxChange = useCallback((nextBbox: [number, number, number, number]) => {
    latestBboxRef.current = nextBbox;
    setFilters((prev) => {
      if (!prev.useBbox) {
        return prev;
      }
      const same =
        prev.bbox &&
        Math.abs(prev.bbox[0] - nextBbox[0]) < 0.5 &&
        Math.abs(prev.bbox[1] - nextBbox[1]) < 0.5 &&
        Math.abs(prev.bbox[2] - nextBbox[2]) < 0.5 &&
        Math.abs(prev.bbox[3] - nextBbox[3]) < 0.5;
      if (same) return prev;
      return { ...prev, bbox: nextBbox };
    });
  }, []);

  const handleChangeFilters = useCallback((nextFilters: EventFilters) => {
    if (nextFilters.useBbox) {
      nextFilters = { ...nextFilters, bbox: latestBboxRef.current };
    }
    setFilters(nextFilters);
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters(INITIAL_FILTERS);
  }, []);

  const handleLegendCategoryToggle = useCallback((categoryId: string) => {
    soundFx.playFilter();
    setFilters((prev) => ({
      ...prev,
      category: prev.category === categoryId ? 'all' : categoryId,
    }));
  }, []);

  // Live category counts computed against current non-category filters for scannable pills
  const categoryCounts = useMemo(() => {
    const scoped = filterEventsClientSide(allEvents, { ...filters, category: 'all' });
    const counts: Record<string, number> = { all: scoped.length };
    for (const cat of FILTER_CATEGORIES) {
      if (cat.id !== 'all') counts[cat.id] = 0;
    }
    for (const ev of scoped) {
      for (const cat of FILTER_CATEGORIES) {
        if (cat.id !== 'all' && isCategoryMatch(ev.category, cat.id)) {
          counts[cat.id] = (counts[cat.id] || 0) + 1;
          break;
        }
      }
    }
    return counts;
  }, [allEvents, filters]);

  return (
    <div className="app-shell">
      <a href="#main-workspace" className="skip-link">
        Skip to hazard monitor
      </a>

      <Header
        health={health}
        lastUpdatedAt={lastUpdatedAt}
        liteMode={liteMode}
        onToggleLiteMode={handleToggleLiteMode}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        onSyncNow={handleSyncNow}
        isSyncing={isSyncing}
        showDisclaimersModal={showDisclaimersModal}
        onToggleDisclaimersModal={handleToggleDisclaimersModal}
      />

      <FreshnessBanner
        health={health}
        showDisclaimersModal={showDisclaimersModal}
        onCloseDisclaimers={handleCloseDisclaimers}
      />

      <FilterBar
        filters={filters}
        onChangeFilters={handleChangeFilters}
        onResetFilters={handleResetFilters}
        totalCount={totalCount}
        categoryCounts={categoryCounts}
        liteMode={liteMode}
      />

      <main
        id="main-workspace"
        className={`workspace-main ${liteMode ? 'workspace-lite' : 'workspace-3d'}`}
      >
        <EventSidebarList
          events={events}
          selectedEvent={selectedEvent}
          onSelectEvent={handleSelectEvent}
          onResetFilters={handleResetFilters}
          isLoading={isLoadingEvents}
          liteMode={liteMode}
        />

        {!liteMode && (
          <section className="globe-viewport-panel" aria-label="3D Virtual Globe View">
            <Suspense
              fallback={
                <div className="globe-loading-fallback" role="status">
                  <span className="mono-text">Initializing 3D orbital globe…</span>
                </div>
              }
            >
              <LazyGlobeCanvas
                events={events}
                selectedEvent={selectedEvent}
                onSelectEvent={handleSelectEvent}
                onViewportBboxChange={handleViewportBboxChange}
                onSelectCategory={handleLegendCategoryToggle}
                activeCategory={filters.category}
                useBboxFilter={filters.useBbox}
              />
            </Suspense>
          </section>
        )}

        <EventDetailDrawer
          event={selectedEvent}
          articles={articles}
          isLoadingArticles={isLoadingArticles}
          onClose={handleCloseDrawer}
          disableEscapeClose={showDisclaimersModal}
        />
      </main>

      {/* Persistent Use-Boundary & Mandatory Uncertainty Disclaimers Footer */}
      <footer
        className="uncertainty-footer"
        role="contentinfo"
        data-testid="persistent-uncertainty-footer"
      >
        <div className="footer-boundary-pill">
          <strong>Educational &amp; Informational Use Boundary:</strong> Not an emergency alerting,
          disaster prediction, casualty estimation, or evacuation routing service.
        </div>
        <div className="footer-caveats-row">
          <span data-testid="footer-caveat-geometry">
            <strong>1. Satellite Geometry Caveat:</strong> NASA EONET v3 coordinates/perimeters are
            approximate satellite observations with potential reporting delays.
          </span>
          <span className="footer-sep" aria-hidden="true">
            ·
          </span>
          <span data-testid="footer-caveat-density">
            <strong>2. National Population Density Caveat:</strong> REST Countries v3.1 density is a
            national macro-level average (Population ÷ Land Area in km²), not local disaster-zone
            exposure.
          </span>
          <span className="footer-sep" aria-hidden="true">
            ·
          </span>
          <span data-testid="footer-caveat-news">
            <strong>3. Contextual News Matching Caveat:</strong> NewsAPI v2 articles are matched by
            keywords, country names, and dates—not verified GPS coordinates.
          </span>
        </div>
      </footer>
    </div>
  );
};

export default App;
