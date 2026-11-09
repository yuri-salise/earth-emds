import asyncio
from datetime import datetime, timezone
import random
import httpx

from app.config import get_settings
from app.services.normalizer import (
    clean_event_title,
    normalize_magnitude,
    validate_geojson_geometry,
)

CATEGORY_MAP = {
    "wildfires": "Wildfires",
    "severestorms": "Severe Storms",
    "volcanoes": "Volcanoes",
    "floods": "Floods",
    "seaandlakeice": "Sea and Lake Ice",
    "earthquakes": "Earthquakes",
    "landslides": "Landslides",
    "drought": "Drought",
    "dusthaze": "Dust and Haze",
    "tempextremes": "Temperature Extremes",
    "waterColor": "Water Color",
    "manmade": "Manmade",
}


def _normalize_category(categories: list[dict] | None) -> str:
    if not categories:
        return "Severe Storms"
    first = categories[0] if isinstance(categories[0], dict) else {}
    cid = (first.get("id") or "").strip().lower()
    if cid in CATEGORY_MAP:
        return CATEGORY_MAP[cid]
    title = (first.get("title") or "").strip()
    return title or "Severe Storms"


def parse_eonet_event(raw: dict) -> dict:
    """Normalize a single NASA EONET v3 event payload."""
    event_id = str(raw.get("id") or "").strip()
    if not event_id:
        raise ValueError("EONET event id must not be empty")

    title = clean_event_title(raw.get("title") or "")
    category = _normalize_category(raw.get("categories"))
    closed_raw = raw.get("closed")
    status = "closed" if closed_raw else "open"
    closed_at = str(closed_raw).strip() if closed_raw else None

    sources = []
    for src in raw.get("sources") or []:
        if isinstance(src, dict) and src.get("url"):
            sources.append(
                {
                    "id": str(src.get("id") or "NASA"),
                    "url": str(src.get("url")).strip(),
                }
            )
    if not sources and raw.get("link"):
        sources.append({"id": "EONET", "url": str(raw["link"]).strip()})

    observations = []
    for geom_item in raw.get("geometry") or []:
        if not isinstance(geom_item, dict):
            continue
        geom_type = geom_item.get("type")
        coords = geom_item.get("coordinates")
        try:
            validated_geom = validate_geojson_geometry({"type": geom_type, "coordinates": coords})
            mag_val = normalize_magnitude(geom_item.get("magnitudeValue"))
        except ValueError:
            continue
        obs_date = str(
            geom_item.get("date")
            or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        )
        mag_unit = geom_item.get("magnitudeUnit")
        observations.append(
            {
                "observed_at": obs_date,
                "geom": validated_geom,
                "magnitude_value": mag_val,
                "magnitude_unit": str(mag_unit).strip() if mag_unit else None,
            }
        )

    if not observations:
        raise ValueError(f"EONET event {event_id} has no valid observations")

    observations.sort(key=lambda o: o["observed_at"])
    return {
        "id": event_id,
        "title": title,
        "category": category,
        "status": status,
        "closed_at": closed_at,
        "sources": sources,
        "observations": observations,
    }


RAW_SEED_EONET_EVENTS: list[dict] = [
    {
        "id": "EONET_PHL_MAYON_2026",
        "title": "Mayon Volcano Eruption, Albay, Philippines",
        "closed": None,
        "categories": [{"id": "volcanoes", "title": "Volcanoes"}],
        "sources": [
            {"id": "PHIVOLCS", "url": "https://www.phivolcs.dost.gov.ph"},
            {"id": "GVP", "url": "https://volcano.si.edu/volcano.cfm?vn=273030"},
        ],
        "geometry": [
            {
                "magnitudeValue": 3.0,
                "magnitudeUnit": "VEI",
                "date": "2026-10-04T06:00:00Z",
                "type": "Point",
                "coordinates": [123.685, 13.257],
            },
            {
                "magnitudeValue": 3.2,
                "magnitudeUnit": "VEI",
                "date": "2026-10-06T12:00:00Z",
                "type": "Point",
                "coordinates": [123.686, 13.258],
            },
        ],
    },
    {
        "id": "EONET_PHL_TAAL_2026",
        "title": "Taal Volcano Phreatic Activity, Batangas, Philippines",
        "closed": None,
        "categories": [{"id": "volcanoes", "title": "Volcanoes"}],
        "sources": [
            {"id": "PHIVOLCS", "url": "https://www.phivolcs.dost.gov.ph"},
            {"id": "GVP", "url": "https://volcano.si.edu/volcano.cfm?vn=273070"},
        ],
        "geometry": [
            {
                "magnitudeValue": None,
                "magnitudeUnit": None,
                "date": "2026-10-05T03:30:00Z",
                "type": "Point",
                "coordinates": [120.993, 14.002],
            }
        ],
    },
    {
        "id": "EONET_PHL_KANLAON_2026",
        "title": "Kanlaon Volcano Ash Emission, Negros Island, Philippines",
        "closed": None,
        "categories": [{"id": "volcanoes", "title": "Volcanoes"}],
        "sources": [{"id": "PHIVOLCS", "url": "https://www.phivolcs.dost.gov.ph"}],
        "geometry": [
            {
                "magnitudeValue": 2.0,
                "magnitudeUnit": "VEI",
                "date": "2026-10-03T14:00:00Z",
                "type": "Point",
                "coordinates": [123.132, 10.412],
            }
        ],
    },
    {
        "id": "EONET_STORM_KRATHON_2026",
        "title": "Super Typhoon Krathon (Julian) Western Pacific Track",
        "closed": None,
        "categories": [{"id": "severeStorms", "title": "Severe Storms"}],
        "sources": [
            {"id": "JTWC", "url": "https://www.metoc.navy.mil/jtwc/"},
            {"id": "PAGASA", "url": "https://bagong.pagasa.dost.gov.ph"},
        ],
        "geometry": [
            {
                "magnitudeValue": 115.0,
                "magnitudeUnit": "kts",
                "date": "2026-10-01T00:00:00Z",
                "type": "Point",
                "coordinates": [122.1, 19.8],
            },
            {
                "magnitudeValue": 130.0,
                "magnitudeUnit": "kts",
                "date": "2026-10-02T12:00:00Z",
                "type": "LineString",
                "coordinates": [
                    [123.5, 18.2],
                    [121.9, 20.4],
                    [120.3, 22.6],
                    [121.2, 24.5],
                ],
            },
        ],
    },
    {
        "id": "EONET_STORM_YAGI_2026",
        "title": "Typhoon Yagi (Enteng) Luzon and South China Sea Track",
        "closed": "2026-09-09T18:00:00Z",
        "categories": [{"id": "severeStorms", "title": "Severe Storms"}],
        "sources": [{"id": "JTWC", "url": "https://www.metoc.navy.mil/jtwc/"}],
        "geometry": [
            {
                "magnitudeValue": 125.0,
                "magnitudeUnit": "kts",
                "date": "2026-09-05T06:00:00Z",
                "type": "LineString",
                "coordinates": [
                    [124.2, 14.5],
                    [121.5, 16.2],
                    [115.0, 19.0],
                    [110.2, 20.1],
                    [106.8, 20.9],
                ],
            }
        ],
    },
    {
        "id": "EONET_PHL_CAGAYAN_FLOOD_2026",
        "title": "Cagayan River Basin Monsoon Inundation, Luzon, Philippines",
        "closed": None,
        "categories": [{"id": "floods", "title": "Floods"}],
        "sources": [{"id": "PAGASA", "url": "https://bagong.pagasa.dost.gov.ph"}],
        "geometry": [
            {
                "magnitudeValue": None,
                "magnitudeUnit": None,
                "date": "2026-10-04T09:00:00Z",
                "type": "Polygon",
                "coordinates": [
                    [
                        [121.4, 17.2],
                        [122.0, 17.2],
                        [122.0, 18.2],
                        [121.4, 18.2],
                        [121.4, 17.2],
                    ]
                ],
            }
        ],
    },
    {
        "id": "EONET_USA_PARK_FIRE_2026",
        "title": "Park Fire Perimeter, Northern California, United States",
        "closed": None,
        "categories": [{"id": "wildfires", "title": "Wildfires"}],
        "sources": [
            {"id": "InciWeb", "url": "https://inciweb.wildfire.gov"},
            {"id": "CALFIRE", "url": "https://www.fire.ca.gov"},
        ],
        "geometry": [
            {
                "magnitudeValue": 429603.0,
                "magnitudeUnit": "acres",
                "date": "2026-10-03T18:00:00Z",
                "type": "Polygon",
                "coordinates": [
                    [
                        [-122.0, 39.8],
                        [-121.4, 39.8],
                        [-121.4, 40.3],
                        [-122.0, 40.3],
                        [-122.0, 39.8],
                    ]
                ],
            }
        ],
    },
    {
        "id": "EONET_USA_LINE_FIRE_2026",
        "title": "Line Wildfire, San Bernardino National Forest, California",
        "closed": None,
        "categories": [{"id": "wildfires", "title": "Wildfires"}],
        "sources": [{"id": "InciWeb", "url": "https://inciweb.wildfire.gov"}],
        "geometry": [
            {
                "magnitudeValue": 39232.0,
                "magnitudeUnit": "acres",
                "date": "2026-10-05T14:00:00Z",
                "type": "Point",
                "coordinates": [-117.08, 34.16],
            }
        ],
    },
    {
        "id": "EONET_USA_MILTON_2026",
        "title": "Hurricane Milton Gulf of Mexico and Florida Track",
        "closed": None,
        "categories": [{"id": "severeStorms", "title": "Severe Storms"}],
        "sources": [{"id": "NHC", "url": "https://www.nhc.noaa.gov"}],
        "geometry": [
            {
                "magnitudeValue": 140.0,
                "magnitudeUnit": "kts",
                "date": "2026-10-06T00:00:00Z",
                "type": "LineString",
                "coordinates": [
                    [-92.5, 21.8],
                    [-87.2, 24.5],
                    [-82.6, 27.3],
                    [-80.5, 28.5],
                ],
            }
        ],
    },
    {
        "id": "EONET_USA_KILAUEA_2026",
        "title": "Kilauea East Rift Zone Volcanic Eruption, Hawaii",
        "closed": None,
        "categories": [{"id": "volcanoes", "title": "Volcanoes"}],
        "sources": [{"id": "USGS", "url": "https://www.usgs.gov/volcanoes/kilauea"}],
        "geometry": [
            {
                "magnitudeValue": 1.0,
                "magnitudeUnit": "VEI",
                "date": "2026-10-04T20:00:00Z",
                "type": "Point",
                "coordinates": [-155.287, 19.421],
            }
        ],
    },
    {
        "id": "EONET_CAN_JASPER_FIRE_2026",
        "title": "Jasper Complex Wildfire Perimeter, Alberta, Canada",
        "closed": "2026-09-20T12:00:00Z",
        "categories": [{"id": "wildfires", "title": "Wildfires"}],
        "sources": [{"id": "CWFIS", "url": "https://cwfis.cfs.nrcan.gc.ca"}],
        "geometry": [
            {
                "magnitudeValue": 89000.0,
                "magnitudeUnit": "acres",
                "date": "2026-09-15T12:00:00Z",
                "type": "Polygon",
                "coordinates": [
                    [
                        [-118.3, 52.7],
                        [-117.8, 52.7],
                        [-117.8, 53.1],
                        [-118.3, 53.1],
                        [-118.3, 52.7],
                    ]
                ],
            }
        ],
    },
    {
        "id": "EONET_CHL_VALPARAISO_FIRE_2026",
        "title": "Valparaiso and Vina del Mar Forest Wildfire, Chile",
        "closed": None,
        "categories": [{"id": "wildfires", "title": "Wildfires"}],
        "sources": [{"id": "CONAF", "url": "https://www.conaf.cl"}],
        "geometry": [
            {
                "magnitudeValue": 28500.0,
                "magnitudeUnit": "acres",
                "date": "2026-10-04T16:00:00Z",
                "type": "Point",
                "coordinates": [-71.54, -33.04],
            }
        ],
    },
    {
        "id": "EONET_BRA_PANTANAL_FIRE_2026",
        "title": "Pantanal Wetland Wildfire Complex, Mato Grosso do Sul, Brazil",
        "closed": None,
        "categories": [{"id": "wildfires", "title": "Wildfires"}],
        "sources": [{"id": "INPE", "url": "https://terrabrasilis.dpi.inpe.br"}],
        "geometry": [
            {
                "magnitudeValue": 310000.0,
                "magnitudeUnit": "acres",
                "date": "2026-10-05T15:00:00Z",
                "type": "Polygon",
                "coordinates": [
                    [
                        [-57.6, -19.2],
                        [-56.4, -19.2],
                        [-56.4, -17.8],
                        [-57.6, -17.8],
                        [-57.6, -19.2],
                    ]
                ],
            }
        ],
    },
    {
        "id": "EONET_ISL_REYKJANES_2026",
        "title": "Reykjanes Peninsula Sundhnukur Fissure Eruption, Iceland",
        "closed": None,
        "categories": [{"id": "volcanoes", "title": "Volcanoes"}],
        "sources": [{"id": "IMO", "url": "https://en.vedur.is"}],
        "geometry": [
            {
                "magnitudeValue": 2.0,
                "magnitudeUnit": "VEI",
                "date": "2026-10-05T08:00:00Z",
                "type": "Point",
                "coordinates": [-22.43, 63.88],
            }
        ],
    },
    {
        "id": "EONET_ITA_ETNA_2026",
        "title": "Mount Etna Voragine Crater Eruption, Sicily, Italy",
        "closed": None,
        "categories": [{"id": "volcanoes", "title": "Volcanoes"}],
        "sources": [{"id": "INGV", "url": "https://www.ct.ingv.it"}],
        "geometry": [
            {
                "magnitudeValue": 2.0,
                "magnitudeUnit": "VEI",
                "date": "2026-10-04T22:00:00Z",
                "type": "Point",
                "coordinates": [14.999, 37.748],
            }
        ],
    },
    {
        "id": "EONET_GRC_ATTICA_FIRE_2026",
        "title": "Attica Northeast Wildfire Perimeter, Athens Region, Greece",
        "closed": "2026-09-18T18:00:00Z",
        "categories": [{"id": "wildfires", "title": "Wildfires"}],
        "sources": [{"id": "EFFIS", "url": "https://effis.jrc.ec.europa.eu"}],
        "geometry": [
            {
                "magnitudeValue": 25000.0,
                "magnitudeUnit": "acres",
                "date": "2026-09-14T11:00:00Z",
                "type": "Polygon",
                "coordinates": [
                    [
                        [23.75, 38.10],
                        [24.02, 38.10],
                        [24.02, 38.30],
                        [23.75, 38.30],
                        [23.75, 38.10],
                    ]
                ],
            }
        ],
    },
    {
        "id": "EONET_JPN_SAKURAJIMA_2026",
        "title": "Sakurajima Minamidake Crater Explosive Eruption, Kyushu, Japan",
        "closed": None,
        "categories": [{"id": "volcanoes", "title": "Volcanoes"}],
        "sources": [{"id": "JMA", "url": "https://www.jma.go.jp"}],
        "geometry": [
            {
                "magnitudeValue": 2.0,
                "magnitudeUnit": "VEI",
                "date": "2026-10-05T04:00:00Z",
                "type": "Point",
                "coordinates": [130.657, 31.593],
            }
        ],
    },
    {
        "id": "EONET_IDN_SEMERU_2026",
        "title": "Mount Semeru Pyroclastic Activity, East Java, Indonesia",
        "closed": None,
        "categories": [{"id": "volcanoes", "title": "Volcanoes"}],
        "sources": [{"id": "PVMBG", "url": "https://magma.esdm.go.id"}],
        "geometry": [
            {
                "magnitudeValue": 3.0,
                "magnitudeUnit": "VEI",
                "date": "2026-10-04T07:00:00Z",
                "type": "Point",
                "coordinates": [112.922, -8.108],
            }
        ],
    },
    {
        "id": "EONET_AUS_PILBARA_FIRE_2026",
        "title": "Pilbara Rangeland Bushfire Complex, Western Australia",
        "closed": None,
        "categories": [{"id": "wildfires", "title": "Wildfires"}],
        "sources": [{"id": "DFES", "url": "https://www.emergency.wa.gov.au"}],
        "geometry": [
            {
                "magnitudeValue": 145000.0,
                "magnitudeUnit": "acres",
                "date": "2026-10-05T02:00:00Z",
                "type": "Point",
                "coordinates": [118.6, -21.9],
            }
        ],
    },
    {
        "id": "EONET_BGD_BRAHMAPUTRA_FLOOD_2026",
        "title": "Brahmaputra and Jamuna River Basin Monsoon Floods, Bangladesh",
        "closed": None,
        "categories": [{"id": "floods", "title": "Floods"}],
        "sources": [{"id": "FFWC", "url": "http://www.ffwc.gov.bd"}],
        "geometry": [
            {
                "magnitudeValue": None,
                "magnitudeUnit": None,
                "date": "2026-10-03T06:00:00Z",
                "type": "Polygon",
                "coordinates": [
                    [
                        [89.4, 24.0],
                        [90.2, 24.0],
                        [90.2, 25.4],
                        [89.4, 25.4],
                        [89.4, 24.0],
                    ]
                ],
            }
        ],
    },
    {
        "id": "EONET_COL_RUIZ_2026",
        "title": "Nevado del Ruiz Volcanic Ash Plume, Tolima, Colombia",
        "closed": None,
        "categories": [{"id": "volcanoes", "title": "Volcanoes"}],
        "sources": [{"id": "SGC", "url": "https://www.sgc.gov.co"}],
        "geometry": [
            {
                "magnitudeValue": 2.0,
                "magnitudeUnit": "VEI",
                "date": "2026-10-04T17:00:00Z",
                "type": "Point",
                "coordinates": [-75.322, 4.892],
            }
        ],
    },
    {
        "id": "EONET_NGA_BENUE_FLOOD_2026",
        "title": "Benue and Niger River Confluence Floods, Central Nigeria",
        "closed": None,
        "categories": [{"id": "floods", "title": "Floods"}],
        "sources": [{"id": "NIHSA", "url": "https://nihsa.gov.ng"}],
        "geometry": [
            {
                "magnitudeValue": None,
                "magnitudeUnit": None,
                "date": "2026-10-02T12:00:00Z",
                "type": "Polygon",
                "coordinates": [
                    [
                        [6.5, 7.5],
                        [7.8, 7.5],
                        [7.8, 8.4],
                        [6.5, 8.4],
                        [6.5, 7.5],
                    ]
                ],
            }
        ],
    },
    {
        "id": "EONET_NZL_CANTERBURY_FIRE_2026",
        "title": "Canterbury High Country Scrub Wildfire, South Island, New Zealand",
        "closed": "2026-09-29T06:00:00Z",
        "categories": [{"id": "wildfires", "title": "Wildfires"}],
        "sources": [{"id": "FENZ", "url": "https://www.fireandemergency.nz"}],
        "geometry": [
            {
                "magnitudeValue": 6400.0,
                "magnitudeUnit": "acres",
                "date": "2026-09-27T04:00:00Z",
                "type": "Point",
                "coordinates": [171.8, -43.5],
            }
        ],
    },
    {
        "id": "EONET_ICE_A23A_2026",
        "title": "Antarctic Tabular Iceberg A-23A Southern Ocean Drift Track",
        "closed": None,
        "categories": [{"id": "seaAndLakeIce", "title": "Sea and Lake Ice"}],
        "sources": [{"id": "USNIC", "url": "https://usicecenter.gov"}],
        "geometry": [
            {
                "magnitudeValue": 1120.0,
                "magnitudeUnit": "NM^2",
                "date": "2026-10-01T00:00:00Z",
                "type": "LineString",
                "coordinates": [
                    [-48.2, -60.5],
                    [-46.8, -59.7],
                    [-45.1, -58.9],
                ],
            }
        ],
    },
    {
        "id": "EONET_ICE_BERING_2026",
        "title": "Chukchi and Bering Sea Early Freeze Sea Ice Perimeter, Alaska",
        "closed": None,
        "categories": [{"id": "seaAndLakeIce", "title": "Sea and Lake Ice"}],
        "sources": [{"id": "NSIDC", "url": "https://nsidc.org"}],
        "geometry": [
            {
                "magnitudeValue": None,
                "magnitudeUnit": None,
                "date": "2026-10-04T00:00:00Z",
                "type": "Polygon",
                "coordinates": [
                    [
                        [-167.0, 66.5],
                        [-161.0, 66.5],
                        [-161.0, 69.5],
                        [-167.0, 69.5],
                        [-167.0, 66.5],
                    ]
                ],
            }
        ],
    },
    {
        "id": "EONET_PRT_AVERO_FIRE_2026",
        "title": "Aveiro and Viseu Forest Fire Complex, Northern Portugal",
        "closed": "2026-09-25T18:00:00Z",
        "categories": [{"id": "wildfires", "title": "Wildfires"}],
        "sources": [{"id": "EFFIS", "url": "https://effis.jrc.ec.europa.eu"}],
        "geometry": [
            {
                "magnitudeValue": 48000.0,
                "magnitudeUnit": "acres",
                "date": "2026-09-21T12:00:00Z",
                "type": "Point",
                "coordinates": [-8.35, 40.72],
            }
        ],
    },
]


def get_seed_eonet_events() -> list[dict]:
    """Return normalized seed NASA EONET events."""
    return [parse_eonet_event(item) for item in RAW_SEED_EONET_EVENTS]


async def _fetch_eonet_endpoint(client: httpx.AsyncClient, url: str, params: dict) -> list[dict]:
    last_err: Exception | None = None
    for attempt in range(2):
        try:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            payload = resp.json()
            return payload.get("events") or []
        except Exception as exc:
            last_err = exc
            if attempt == 0:
                await asyncio.sleep(0.2 + random.random() * 0.2)
    if last_err:
        raise last_err
    return []


async def fetch_eonet_events(
    include_closed: bool = True,
    force_offline: bool = False,
) -> dict:
    """Fetch open and recent closed events from NASA EONET v3 with curated seed fallback."""
    settings = get_settings()
    seed_events = get_seed_eonet_events()
    by_id: dict[str, dict] = {ev["id"]: ev for ev in seed_events}

    if force_offline:
        return {
            "outcome": "success",
            "events": list(by_id.values()),
            "error_class": None,
        }

    base_url = f"{settings.eonet_base_url.rstrip('/')}/events"
    live_parsed = 0
    error_class: str | None = None
    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(6.0, connect=3.0),
            headers={"Accept": "application/json", "User-Agent": "earth-emds/1.0"},
        ) as client:
            open_raw = await _fetch_eonet_endpoint(
                client, base_url, {"status": "open", "limit": 60}
            )
            closed_raw: list[dict] = []
            if include_closed:
                closed_raw = await _fetch_eonet_endpoint(
                    client,
                    base_url,
                    {"status": "closed", "limit": min(settings.eonet_closed_limit, 40)},
                )
            for raw_item in open_raw + closed_raw:
                try:
                    parsed = parse_eonet_event(raw_item)
                    by_id[parsed["id"]] = parsed
                    live_parsed += 1
                except ValueError:
                    continue
    except Exception as exc:
        error_class = type(exc).__name__

    outcome = "success" if live_parsed > 0 or error_class is None else "partial"
    return {
        "outcome": outcome,
        "events": list(by_id.values()),
        "error_class": error_class,
    }
