import { HazardEvent, HealthStatus, ScoredArticle } from '../types/domain';

export const FALLBACK_EVENTS: HazardEvent[] = [
  {
    id: 'EONET_6401',
    title: 'Valparaíso & Biobío Forest Wildfires, Central Chile',
    category: 'wildfires',
    status: 'open',
    closed_at: null,
    sources: [
      {
        id: 'NASA_FIRMS',
        url: 'https://firms.modaps.eosdis.nasa.gov/',
        title: 'NASA FIRMS MODIS/VIIRS Thermal Anomalies',
      },
      {
        id: 'CONAF_CL',
        url: 'https://www.conaf.cl/',
        title: 'Corporación Nacional Forestal (CONAF)',
      },
    ],
    first_seen_at: '2026-10-12T06:00:00Z',
    last_updated_at: '2026-10-14T11:30:00Z',
    observations: [
      {
        id: 1001,
        observed_at: '2026-10-14T11:00:00Z',
        geom: {
          type: 'Polygon',
          coordinates: [
            [
              [-71.68, -33.12],
              [-71.38, -33.12],
              [-71.38, -32.92],
              [-71.68, -32.92],
              [-71.68, -33.12],
            ],
          ],
        },
        magnitude_value: 14200,
        magnitude_unit: 'acres',
      },
      {
        id: 1000,
        observed_at: '2026-10-12T08:00:00Z',
        geom: {
          type: 'Point',
          coordinates: [-71.55, -33.04],
        },
        magnitude_value: 6800,
        magnitude_unit: 'acres',
      },
    ],
    countries: [
      {
        iso_a3: 'CHL',
        iso_a2: 'CL',
        name: 'Chile',
        population: 19603733,
        area_sq_km: 756102,
        population_density: 26,
        currencies: {
          CLP: { name: 'Chilean peso', symbol: '$' },
        },
        match_method: 'intersects',
        retrieved_at: '2026-10-14T11:20:00Z',
      },
    ],
  },
  {
    id: 'EONET_6402',
    title: 'Super Typhoon Kristine (Western Pacific Track)',
    category: 'severeStorms',
    status: 'open',
    closed_at: null,
    sources: [
      {
        id: 'JTWC',
        url: 'https://www.metoc.navy.mil/jtwc/jtwc.html',
        title: 'Joint Typhoon Warning Center (JTWC)',
      },
      {
        id: 'GDACS',
        url: 'https://www.gdacs.org/',
        title: 'Global Disaster Alert and Coordination System',
      },
    ],
    first_seen_at: '2026-10-11T00:00:00Z',
    last_updated_at: '2026-10-14T11:40:00Z',
    observations: [
      {
        id: 2003,
        observed_at: '2026-10-14T11:00:00Z',
        geom: {
          type: 'LineString',
          coordinates: [
            [131.5, 13.8],
            [128.4, 14.9],
            [125.2, 16.1],
            [122.3, 17.4],
          ],
        },
        magnitude_value: 130,
        magnitude_unit: 'kts',
      },
      {
        id: 2002,
        observed_at: '2026-10-13T12:00:00Z',
        geom: {
          type: 'Point',
          coordinates: [125.2, 16.1],
        },
        magnitude_value: 115,
        magnitude_unit: 'kts',
      },
      {
        id: 2001,
        observed_at: '2026-10-12T12:00:00Z',
        geom: {
          type: 'Point',
          coordinates: [128.4, 14.9],
        },
        magnitude_value: 95,
        magnitude_unit: 'kts',
      },
    ],
    countries: [
      {
        iso_a3: 'PHL',
        iso_a2: 'PH',
        name: 'Philippines',
        population: 117337368,
        area_sq_km: 300000,
        population_density: 391,
        currencies: {
          PHP: { name: 'Philippine peso', symbol: '₱' },
        },
        match_method: 'intersects',
        retrieved_at: '2026-10-14T11:25:00Z',
      },
      {
        iso_a3: 'TWN',
        iso_a2: 'TW',
        name: 'Taiwan',
        population: 23894394,
        area_sq_km: 36193,
        population_density: 660,
        currencies: {
          TWD: { name: 'New Taiwan dollar', symbol: 'NT$' },
        },
        match_method: 'coastal_proximity',
        retrieved_at: '2026-10-14T11:25:00Z',
      },
    ],
  },
  {
    id: 'EONET_6403',
    title: 'Mount Sakurajima Explosive Eruption, Kyushu',
    category: 'volcanoes',
    status: 'open',
    closed_at: null,
    sources: [
      {
        id: 'SIVolcano',
        url: 'https://volcano.si.edu/',
        title: 'Smithsonian / USGS Weekly Volcanic Activity Report',
      },
    ],
    first_seen_at: '2026-10-10T04:15:00Z',
    last_updated_at: '2026-10-14T10:50:00Z',
    observations: [
      {
        id: 3001,
        observed_at: '2026-10-14T09:30:00Z',
        geom: {
          type: 'Point',
          coordinates: [130.657, 31.585],
        },
        magnitude_value: null,
        magnitude_unit: null,
      },
    ],
    countries: [
      {
        iso_a3: 'JPN',
        iso_a2: 'JP',
        name: 'Japan',
        population: 124516650,
        area_sq_km: 377930,
        population_density: 329,
        currencies: {
          JPY: { name: 'Japanese yen', symbol: '¥' },
        },
        match_method: 'intersects',
        retrieved_at: '2026-10-14T10:50:00Z',
      },
    ],
  },
  {
    id: 'EONET_6404',
    title: 'Danube & Central European River Basin Flooding',
    category: 'floods',
    status: 'open',
    closed_at: null,
    sources: [
      {
        id: 'COPERNICUS_EMS',
        url: 'https://emergency.copernicus.eu/',
        title: 'Copernicus Emergency Management Service',
      },
    ],
    first_seen_at: '2026-10-08T14:00:00Z',
    last_updated_at: '2026-10-14T09:15:00Z',
    observations: [
      {
        id: 4001,
        observed_at: '2026-10-14T08:00:00Z',
        geom: {
          type: 'Polygon',
          coordinates: [
            [
              [16.15, 48.05],
              [17.35, 48.05],
              [17.35, 48.55],
              [16.15, 48.55],
              [16.15, 48.05],
            ],
          ],
        },
        magnitude_value: null,
        magnitude_unit: null,
      },
    ],
    countries: [
      {
        iso_a3: 'AUT',
        iso_a2: 'AT',
        name: 'Austria',
        population: 9104772,
        area_sq_km: 83871,
        population_density: 109,
        currencies: {
          EUR: { name: 'Euro', symbol: '€' },
        },
        match_method: 'intersects',
        retrieved_at: '2026-10-14T09:15:00Z',
      },
    ],
  },
  {
    id: 'EONET_6405',
    title: 'Iceberg A-83 Drift Anomaly in Open Southern Ocean',
    category: 'seaLakeIce',
    status: 'open',
    closed_at: null,
    sources: [
      {
        id: 'USNIC',
        url: 'https://usicecenter.gov/',
        title: 'U.S. National Ice Center (USNIC)',
      },
    ],
    first_seen_at: '2026-10-01T00:00:00Z',
    last_updated_at: '2026-10-14T07:00:00Z',
    observations: [
      {
        id: 5001,
        observed_at: '2026-10-14T06:00:00Z',
        geom: {
          type: 'Point',
          coordinates: [-41.8, -59.4],
        },
        magnitude_value: 310,
        magnitude_unit: 'NM^2',
      },
    ],
    countries: [], // Open-ocean event outside 100km coastal buffer
  },
  {
    id: 'EONET_6390',
    title: 'Sierra Nevada Oak Creek Wildfire, California (Contained)',
    category: 'wildfires',
    status: 'closed',
    closed_at: '2026-10-11T18:00:00Z',
    sources: [
      {
        id: 'INCISWEB',
        url: 'https://inciweb.wildfire.gov/',
        title: 'InciWeb Interagency All-Risk Incident Information',
      },
    ],
    first_seen_at: '2026-10-03T12:00:00Z',
    last_updated_at: '2026-10-11T18:00:00Z',
    observations: [
      {
        id: 6001,
        observed_at: '2026-10-10T15:00:00Z',
        geom: {
          type: 'Point',
          coordinates: [-118.28, 36.82],
        },
        magnitude_value: 4950,
        magnitude_unit: 'acres',
      },
    ],
    countries: [
      {
        iso_a3: 'USA',
        iso_a2: 'US',
        name: 'United States',
        population: 334914895,
        area_sq_km: 9372610,
        population_density: 36,
        currencies: {
          USD: { name: 'United States dollar', symbol: '$' },
        },
        match_method: 'intersects',
        retrieved_at: '2026-10-11T18:00:00Z',
      },
    ],
  },
];

export const FALLBACK_ARTICLES_BY_EVENT: Record<string, ScoredArticle[]> = {
  EONET_6401: [
    {
      canonical_url: 'https://example.org/news/valparaiso-biobio-wildfire-chile-response',
      original_url: 'https://example.org/news/valparaiso-biobio-wildfire-chile-response',
      title: 'Forestry Crews Mobilize Against Valparaíso & Biobío Forest Wildfires in Central Chile',
      description:
        'Satellite thermal observations from NASA FIRMS show active wildfire perimeters expanding across dry hillsides in Chile.',
      publisher: 'Andes Science & Environment Dispatch',
      published_at: '2026-10-14T08:30:00Z',
      retrieved_at: '2026-10-14T11:30:00Z',
      score: 100,
      confidence_label: 'Strong',
      match_reasons: [
        'Matched event title phrase in headline (+35)',
        "Matched hazard category keyword 'wildfire' (+25)",
        "Matched country/location 'Chile' (+25)",
        'Published within event date window (+15)',
      ],
      algorithm_version: 'v1',
    },
    {
      canonical_url: 'https://example.org/news/chile-seasonal-fire-prevention-update',
      original_url: 'https://example.org/news/chile-seasonal-fire-prevention-update',
      title: 'Chile Expands Aerial Water-Bombing Fleet Amid Spring Wildfire Conditions',
      description:
        'Regional forestry monitors in Central Chile report elevated temperatures and gusting coastal winds.',
      publisher: 'Southern Cone Monitor',
      published_at: '2026-10-13T16:10:00Z',
      retrieved_at: '2026-10-14T11:30:00Z',
      score: 65,
      confidence_label: 'Moderate',
      match_reasons: [
        "Matched hazard category keyword 'wildfire' (+25)",
        "Matched country/location 'Chile' (+25)",
        'Published within event date window (+15)',
      ],
      algorithm_version: 'v1',
    },
  ],
  EONET_6402: [
    {
      canonical_url: 'https://example.org/news/super-typhoon-kristine-philippine-sea-track',
      original_url: 'https://example.org/news/super-typhoon-kristine-philippine-sea-track',
      title: 'Super Typhoon Kristine Intensifies Over Philippine Sea as Coastal Monitors Track Path',
      description:
        'Meteorological agencies in the Philippines and Taiwan are closely monitoring storm trajectory and offshore swells.',
      publisher: 'Asia-Pacific Weather Wire',
      published_at: '2026-10-14T07:45:00Z',
      retrieved_at: '2026-10-14T11:40:00Z',
      score: 100,
      confidence_label: 'Strong',
      match_reasons: [
        'Matched event title phrase in headline (+35)',
        "Matched hazard category keyword 'typhoon' (+25)",
        "Matched country/location 'Philippines' (+25)",
        'Published within event date window (+15)',
      ],
      algorithm_version: 'v1',
    },
    {
      canonical_url: 'https://example.org/news/western-pacific-cyclone-shipping-advisory',
      original_url: 'https://example.org/news/western-pacific-cyclone-shipping-advisory',
      title: 'Maritime Shipping Advisory Issued Across Luzon Strait for Tropical Cyclone Activity',
      description:
        'Vessels transiting between northern Luzon and southern Taiwan advised to monitor storm updates.',
      publisher: 'Maritime Telemetry Daily',
      published_at: '2026-10-13T19:00:00Z',
      retrieved_at: '2026-10-14T11:40:00Z',
      score: 65,
      confidence_label: 'Moderate',
      match_reasons: [
        "Matched hazard category keyword 'cyclone' (+25)",
        "Matched country/location 'Taiwan' (+25)",
        'Published within event date window (+15)',
      ],
      algorithm_version: 'v1',
    },
  ],
  EONET_6403: [
    {
      canonical_url: 'https://example.org/news/sakurajima-volcano-plume-observation-japan',
      original_url: 'https://example.org/news/sakurajima-volcano-plume-observation-japan',
      title: 'Mount Sakurajima Explosive Eruption Sends Ash Plume Above Kagoshima Bay in Japan',
      description:
        'Volcanological observatories in Kyushu recorded ongoing crater activity and ash dispersion.',
      publisher: 'Pacific Rim Earth Observatory News',
      published_at: '2026-10-14T05:20:00Z',
      retrieved_at: '2026-10-14T10:50:00Z',
      score: 100,
      confidence_label: 'Strong',
      match_reasons: [
        'Matched event title phrase in headline (+35)',
        "Matched hazard category keyword 'eruption' (+25)",
        "Matched country/location 'Japan' (+25)",
        'Published within event date window (+15)',
      ],
      algorithm_version: 'v1',
    },
  ],
  EONET_6404: [
    {
      canonical_url: 'https://example.org/news/danube-river-basin-flooding-austria-hydrology',
      original_url: 'https://example.org/news/danube-river-basin-flooding-austria-hydrology',
      title: 'Hydrological Stations Along Danube River Basin in Austria Record High Water Levels',
      description:
        'Copernicus satellite flood mapping captures elevated river stages after sustained rainfall across Central Europe.',
      publisher: 'European Hydrology Bulletin',
      published_at: '2026-10-13T14:00:00Z',
      retrieved_at: '2026-10-14T09:15:00Z',
      score: 90,
      confidence_label: 'Strong',
      match_reasons: [
        'Matched event title phrase in headline (+35)',
        "Matched hazard category keyword 'flood' (+25)",
        "Matched country/location 'Austria' (+25)",
        'Published within event date window (+15)',
      ],
      algorithm_version: 'v1',
    },
  ],
  EONET_6405: [
    {
      canonical_url: 'https://example.org/news/iceberg-a83-southern-ocean-satellite-tracking',
      original_url: 'https://example.org/news/iceberg-a83-southern-ocean-satellite-tracking',
      title: 'Polar Satellites Track Iceberg A-83 Drift Anomaly in Southern Ocean Waters',
      description:
        'U.S. National Ice Center analysts updated coordinates for tabular sea ice drifting in open ocean currents.',
      publisher: 'Cryosphere & Polar Telemetry Review',
      published_at: '2026-10-13T11:00:00Z',
      retrieved_at: '2026-10-14T07:00:00Z',
      score: 75,
      confidence_label: 'Strong',
      match_reasons: [
        'Matched event title phrase in headline (+35)',
        "Matched hazard category keyword 'iceberg' (+25)",
        'Published within event date window (+15)',
      ],
      algorithm_version: 'v1',
    },
  ],
  EONET_6390: [
    {
      canonical_url: 'https://example.org/news/sierra-nevada-oak-creek-wildfire-contained',
      original_url: 'https://example.org/news/sierra-nevada-oak-creek-wildfire-contained',
      title: 'Sierra Nevada Oak Creek Wildfire Reaches Full Containment After Cooler Weather',
      description:
        'Incident teams in California confirmed perimeter stability across the 4,950-acre mountain footprint.',
      publisher: 'Western Forestry & Fire Journal',
      published_at: '2026-10-11T16:30:00Z',
      retrieved_at: '2026-10-11T18:00:00Z',
      score: 90,
      confidence_label: 'Strong',
      match_reasons: [
        'Matched event title phrase in headline (+35)',
        "Matched hazard category keyword 'wildfire' (+25)",
        "Matched country/location 'United States' (+25)",
        'Published within event date window (+15)',
      ],
      algorithm_version: 'v1',
    },
  ],
};

export const FALLBACK_HEALTH: HealthStatus = {
  status: 'healthy',
  cache_freshness: 'fresh',
  last_updated_at: '2026-10-14T11:40:00Z',
  providers: {
    eonet: {
      outcome: 'success',
      last_sync_at: '2026-10-14T11:40:00Z',
      records_processed: 6,
      error_class: null,
    },
    rest_countries: {
      outcome: 'success',
      last_sync_at: '2026-10-14T11:25:00Z',
      records_processed: 5,
      error_class: null,
    },
    newsapi: {
      outcome: 'success',
      last_sync_at: '2026-10-14T11:40:00Z',
      records_processed: 8,
      error_class: null,
    },
  },
  is_demo_fallback: true,
};
