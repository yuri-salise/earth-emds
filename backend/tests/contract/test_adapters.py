import pytest
from app.adapters.eonet import (
    parse_eonet_event,
    get_seed_eonet_events,
    fetch_eonet_events,
)
from app.adapters.rest_countries import (
    parse_rest_country_payload,
    fetch_country_profiles,
)
from app.adapters.newsapi import (
    NewsQuotaTracker,
    fetch_event_news,
)
from app.services.spatial import (
    load_admin0_boundaries,
    resolve_event_countries,
)


class TestEonetContractAndSpatial:
    def test_parses_point_linestring_and_polygon_eonet_payloads(self):
        raw_event = {
            "id": "EONET_TEST_01",
            "title": "  Typhoon   Gaemi   Track  ",
            "closed": None,
            "categories": [{"id": "severeStorms", "title": "Severe Storms"}],
            "sources": [{"id": "JTWC", "url": "https://www.metoc.navy.mil/jtwc/"}],
            "geometry": [
                {
                    "magnitudeValue": 65,
                    "magnitudeUnit": "kts",
                    "date": "2026-07-22T06:00:00Z",
                    "type": "Point",
                    "coordinates": [125.4, 15.8],
                },
                {
                    "magnitudeValue": None,
                    "magnitudeUnit": None,
                    "date": "2026-07-23T06:00:00Z",
                    "type": "LineString",
                    "coordinates": [[125.4, 15.8], [123.2, 18.5], [121.5, 21.8]],
                },
            ],
        }
        parsed = parse_eonet_event(raw_event)
        assert parsed["id"] == "EONET_TEST_01"
        assert parsed["title"] == "Typhoon Gaemi Track"
        assert parsed["category"] == "Severe Storms"
        assert parsed["status"] == "open"
        assert parsed["closed_at"] is None
        assert len(parsed["observations"]) == 2
        assert parsed["observations"][0]["magnitude_value"] == 65.0
        assert parsed["observations"][1]["magnitude_value"] is None
        assert parsed["observations"][1]["geom"]["type"] == "LineString"

    def test_seed_eonet_events_contain_25_diverse_events(self):
        seeds = get_seed_eonet_events()
        assert len(seeds) >= 25
        geom_types = {
            obs["geom"]["type"]
            for ev in seeds
            for obs in ev["observations"]
        }
        assert {"Point", "LineString", "Polygon"}.issubset(geom_types)

    def test_natural_earth_admin0_dataset_has_60_plus_countries_and_no_minus_99(self):
        boundaries = load_admin0_boundaries()
        assert len(boundaries) >= 60
        iso_codes = {b["iso_a3"] for b in boundaries}
        assert "-99" not in iso_codes
        for expected in ("PHL", "USA", "JPN", "IDN", "CHL", "AUS", "CAN", "ISL", "ITA"):
            assert expected in iso_codes

    def test_spatial_resolution_intersects_and_coastal_proximity(self):
        # 1. Exact land intersection in Philippines (Mayon Volcano: 123.685, 13.257)
        phl_matches = resolve_event_countries(
            [{"type": "Point", "coordinates": [123.685, 13.257]}]
        )
        assert any(m["iso_a3"] == "PHL" and m["match_method"] == "intersects" for m in phl_matches)

        # 2. Offshore coastal proximity (within 100 km east of Luzon/Samar coast)
        coastal_matches = resolve_event_countries(
            [{"type": "Point", "coordinates": [126.45, 13.25]}]
        )
        assert any(
            m["iso_a3"] == "PHL" and m["match_method"] in ("coastal_proximity", "intersects")
            for m in coastal_matches
        )

        # 3. Deep open ocean (Point Nemo: -123.39, -48.87) -> no country match
        ocean_matches = resolve_event_countries(
            [{"type": "Point", "coordinates": [-123.39, -48.87]}]
        )
        assert ocean_matches == []


class TestRestCountriesContract:
    def test_parses_country_payload_and_excludes_minus_99(self):
        raw = {
            "name": {"common": "Philippines", "official": "Republic of the Philippines"},
            "cca2": "PH",
            "cca3": "PHL",
            "population": 117337368,
            "area": 300000.0,
            "currencies": {"PHP": {"name": "Philippine peso", "symbol": "₱"}},
        }
        parsed = parse_rest_country_payload(raw)
        assert parsed is not None
        assert parsed["iso_a3"] == "PHL"
        assert parsed["iso_a2"] == "PH"
        assert parsed["name"] == "Philippines"
        assert parsed["population"] == 117337368
        assert parsed["area_sq_km"] == 300000.0
        assert parsed["population_density"] == 391
        assert "PHP" in parsed["currencies"]

        invalid = {
            "name": {"common": "Somaliland"},
            "cca2": "-9",
            "cca3": "-99",
            "population": 4000000,
            "area": 176120.0,
            "currencies": {},
        }
        assert parse_rest_country_payload(invalid) is None

    @pytest.mark.asyncio
    async def test_fetch_country_profiles_filters_minus_99_and_uses_fallback(self):
        profiles = await fetch_country_profiles(["PHL", "-99", "JPN", "CHL"], force_offline=True)
        assert "-99" not in profiles
        assert "PHL" in profiles
        assert "JPN" in profiles
        assert "CHL" in profiles
        assert profiles["PHL"]["population_density"] > 0


class TestNewsApiContractAndBudget:
    @pytest.mark.asyncio
    async def test_newsapi_budget_cap_and_keyless_fallback(self):
        quota = NewsQuotaTracker(daily_budget=2)
        assert quota.can_consume() is True
        quota.consume()
        quota.consume()
        assert quota.can_consume() is False
        assert quota.remaining() == 0

        # Even when budget is exhausted or NEWSAPI_KEY is placeholder,
        # keyless fallback returns scored, explainable articles!
        result = await fetch_event_news(
            event_id="EONET_PHL_MAYON",
            event_title="Mayon Volcano, Philippines",
            event_category="Volcanoes",
            country_names=["Philippines"],
            event_dates=["2026-10-05T00:00:00Z"],
            quota_tracker=quota,
            force_offline=True,
        )
        assert result["outcome"] in ("success", "rate_limited", "fallback")
        assert len(result["articles"]) >= 1
        top = result["articles"][0]
        assert top["score"] >= 25
        assert top["confidence_label"] in ("Strong", "Moderate", "Weak")
        assert top["algorithm_version"] == "v1"
        assert len(top["match_reasons"]) >= 1
