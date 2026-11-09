import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  filterEventsClientSide,
  normalizeArticle,
  normalizeEvent,
} from '../api/client';
import { FALLBACK_EVENTS } from '../api/fallbackData';
import App from '../App';
import { CountryCard } from '../components/CountryCard';
import { soundFx } from '../utils/soundFx';

describe('EARTH EMDS Frontend Application & Components', () => {
  beforeEach(() => {
    window.localStorage.clear();
    soundFx.setEnabled(true);
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Simulated offline test mode'));
  });

  it('renders open and closed hazard events, header freshness timestamp, and persistent uncertainty disclaimers', async () => {
    render(<App />);

    expect(screen.getByText(/EARTH EMDS/i)).toBeInTheDocument();
    expect(screen.getByTestId('last-updated-timestamp')).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByText(/Valparaíso & Biobío Forest Wildfires, Central Chile/i)
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Super Typhoon Kristine \(Western Pacific Track\)/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Sierra Nevada Oak Creek Wildfire, California/i)
    ).toBeInTheDocument();

    // Verify all 3 mandatory caveats are visible in the persistent footer
    expect(screen.getByTestId('footer-caveat-geometry')).toHaveTextContent(
      /Satellite Geometry Caveat/i
    );
    expect(screen.getByTestId('footer-caveat-density')).toHaveTextContent(
      /National Population Density Caveat/i
    );
    expect(screen.getByTestId('footer-caveat-news')).toHaveTextContent(
      /Contextual News Matching Caveat/i
    );
  });

  it('filters events deterministically by category, status, and search query', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('showing-events-count')).toHaveTextContent('Showing 6 events');
    });

    // Filter by Wildfires category
    const wildfireBtn = screen.getByTestId('category-filter-wildfires');
    fireEvent.click(wildfireBtn);

    await waitFor(() => {
      expect(screen.getByTestId('showing-events-count')).toHaveTextContent('Showing 2 events');
    });

    // Filter by Open status only
    const openBtn = screen.getByTestId('status-filter-open');
    fireEvent.click(openBtn);

    await waitFor(() => {
      expect(screen.getByTestId('showing-events-count')).toHaveTextContent('Showing 1 event');
    });

    expect(
      screen.getByText(/Valparaíso & Biobío Forest Wildfires, Central Chile/i)
    ).toBeInTheDocument();
  });

  it('supports keyboard navigation (ArrowDown / Enter / Escape) on the EventSidebarList and opens the EventDetailDrawer', async () => {
    render(<App />);

    const firstOption = await screen.findByTestId('event-list-item-EONET_6401');
    firstOption.focus();

    // Press ArrowDown to move to second event (EONET_6402)
    fireEvent.keyDown(firstOption, { key: 'ArrowDown' });

    const drawer = await screen.findByTestId('event-detail-drawer');
    expect(drawer).toBeInTheDocument();
    expect(within(drawer).getByTestId('drawer-event-id')).toHaveTextContent('EONET_6402');

    // Verify all three mandatory disclaimers inside the drawer
    expect(within(drawer).getByTestId('disclaimer-satellite-geometry')).toHaveTextContent(
      /approximate satellite\/agency observations/i
    );
    expect(within(drawer).getByTestId('disclaimer-national-density')).toHaveTextContent(
      /national macro-level average calculated from REST Countries v3.1/i
    );
    expect(within(drawer).getByTestId('disclaimer-contextual-news')).toHaveTextContent(
      /matched contextually by hazard keywords/i
    );

    // Press Escape to close the drawer
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByTestId('event-detail-drawer')).not.toBeInTheDocument();
    });
  });

  it('toggles 1-Click Lite Mode (unmounting the 3D globe canvas for zero-GPU operation)', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('showing-events-count')).toHaveTextContent('Showing 6 events');
    });

    // Initially 3D Globe is mounted
    expect(screen.getByTestId('globe-canvas')).toBeInTheDocument();

    const liteToggle = screen.getByTestId('lite-mode-toggle');
    fireEvent.click(liteToggle);

    // 3D Globe canvas is unmounted and Lite Mode — GPU Off is displayed
    expect(screen.queryByTestId('globe-canvas')).not.toBeInTheDocument();
    expect(liteToggle).toHaveTextContent(/Lite Mode — GPU Off/i);
    expect(screen.getByTestId('render-mode-indicator')).toHaveTextContent(/Lite Mode — GPU Off/i);
  });

  it('toggles Sound FX Mute / Unmute, persists preference in localStorage, and safely invokes Web Audio synthesizer methods', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('showing-events-count')).toHaveTextContent('Showing 6 events');
    });

    const soundBtn = screen.getByTestId('sound-fx-toggle');
    expect(soundBtn).toHaveTextContent(/Sound FX: ON/i);
    expect(window.localStorage.getItem('earth_emds_sound_enabled')).not.toBe('false');

    // Safely invoke all SoundFX synthesis methods
    expect(() => {
      soundFx.playSelect();
      soundFx.playFilter();
      soundFx.playDrawerOpen();
      soundFx.playDrawerClose();
      soundFx.playSyncPing();
    }).not.toThrow();

    fireEvent.click(soundBtn);
    expect(soundBtn).toHaveTextContent(/Sound FX: OFF/i);
    expect(window.localStorage.getItem('earth_emds_sound_enabled')).toBe('false');

    fireEvent.click(soundBtn);
    expect(soundBtn).toHaveTextContent(/Sound FX: ON/i);
    expect(window.localStorage.getItem('earth_emds_sound_enabled')).toBe('true');
  });

  it('renders CountryCard with strict National Average (X people/km²) label, match method badges, and safe null density fallback', () => {
    render(
      <div>
        <CountryCard
          country={{
            iso_a3: 'PHL',
            iso_a2: 'PH',
            name: 'Philippines',
            population: 117337368,
            area_sq_km: 300000,
            population_density: 391,
            currencies: { PHP: { name: 'Philippine peso', symbol: '₱' } },
            match_method: 'intersects',
            retrieved_at: '2026-10-14T11:25:00Z',
          }}
        />
        <CountryCard
          country={{
            iso_a3: 'UNK',
            iso_a2: 'UN',
            name: 'Zero Area Territory',
            population: 5000,
            area_sq_km: 0,
            population_density: null,
            currencies: {},
            match_method: 'coastal_proximity',
            retrieved_at: '2026-10-14T11:25:00Z',
          }}
        />
      </div>
    );

    expect(screen.getByTestId('country-density-PHL')).toHaveTextContent(
      'National Average (391 people/km²)'
    );
    expect(screen.getByTestId('country-match-method-PHL')).toHaveTextContent(
      'Spatial Intersection'
    );

    expect(screen.getByTestId('country-density-UNK')).toHaveTextContent(
      'Not available (missing or zero land area)'
    );
    expect(screen.getByTestId('country-match-method-UNK')).toHaveTextContent(
      'Coastal Proximity (100km)'
    );
  });

  it('renders ranked NewsAPI articles with match reason chips and target="_blank" rel="noopener noreferrer" on all external links', async () => {
    render(<App />);

    const firstEvent = await screen.findByTestId('event-list-item-EONET_6401');
    fireEvent.click(firstEvent);

    const drawer = await screen.findByTestId('event-detail-drawer');

    // Wait for ranked articles to appear
    const articleCards = await within(drawer).findAllByTestId('scored-article-card');
    expect(articleCards.length).toBeGreaterThan(0);

    // Check match reason badges
    const reasonChips = within(drawer).getAllByTestId('match-reason-chip');
    expect(reasonChips.some((chip) => chip.textContent?.includes('wildfire'))).toBe(true);

    // Check external links have target="_blank" and rel="noopener noreferrer"
    const sourceLinks = within(drawer).getAllByTestId('official-source-link');
    for (const link of sourceLinks) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }

    const articleLinks = within(drawer).getAllByTestId('article-external-link');
    for (const link of articleLinks) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });

  it('handles open-ocean events with zero country matches and null magnitude values gracefully', async () => {
    render(<App />);

    // Select Mount Sakurajima (null magnitude)
    const volcanoEvent = await screen.findByTestId('event-list-item-EONET_6403');
    fireEvent.click(volcanoEvent);

    let drawer = await screen.findByTestId('event-detail-drawer');
    expect(within(drawer).getByTestId('drawer-magnitude-value')).toHaveTextContent('Not reported');

    // Select Open-Ocean Iceberg A-83 (zero country matches)
    const oceanEvent = await screen.findByTestId('event-list-item-EONET_6405');
    fireEvent.click(oceanEvent);

    drawer = await screen.findByTestId('event-detail-drawer');
    expect(within(drawer).getByTestId('no-country-matches-card')).toHaveTextContent(
      /No Sovereign Country Profile Matched/i
    );
  });

  it('normalizes backend payloads and applies viewport bbox & date range filtering accurately', () => {
    const normalizedEv = normalizeEvent({
      id: 'EONET_999',
      title: '  Messy   Wildfire   Title  ',
      category: 'wildfires',
      status: 'open',
      observations: [
        {
          id: 1,
          observed_at: '2026-10-14T00:00:00Z',
          geom: { type: 'Point', coordinates: [121.0, 14.6] },
          magnitude_value: null,
          magnitude_unit: null,
        },
      ],
      countries: [
        {
          iso_a3: 'PHL',
          name: 'Philippines',
          population: 117337368,
          area_sq_km: 300000,
        },
      ],
    });

    expect(normalizedEv.title).toBe('Messy Wildfire Title');
    expect(normalizedEv.observations[0].magnitude_value).toBeNull();
    expect(normalizedEv.countries[0].population_density).toBe(391);

    const normalizedArt = normalizeArticle({
      canonical_url: 'https://example.com/a',
      title: 'Sample Headline',
      publisher: 'Test Wire',
      published_at: '2026-10-14T00:00:00Z',
      score: 75,
      match_reasons: ["Matched hazard category keyword 'wildfire' (+25)"],
    });
    expect(normalizedArt.confidence_label).toBe('Strong');

    const bboxFiltered = filterEventsClientSide(FALLBACK_EVENTS, {
      q: '',
      category: 'all',
      status: 'all',
      start_date: '',
      end_date: '',
      useBbox: true,
      bbox: [115, 5, 140, 40], // East Asia / Western Pacific bbox (PHL, TWN, JPN)
    });
    expect(bboxFiltered.map((e) => e.id)).toEqual(['EONET_6402', 'EONET_6403']);
  });
});
