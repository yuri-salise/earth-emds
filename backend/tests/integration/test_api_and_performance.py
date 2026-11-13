import time
import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.db import Database
from app.main import create_app


@pytest.fixture()
def test_db(tmp_path):
    db_file = tmp_path / "test_earth_emds.db"
    db = Database(sqlite_path=str(db_file))
    db.init_schema()
    db.seed_initial_data()
    return db


@pytest.fixture()
def client(test_db):
    app = create_app(db_instance=test_db, enable_background_worker=False)
    with TestClient(app) as c:
        yield c


class TestApiIntegrationAndSecurity:
    def test_health_endpoint_and_security_headers(self, client):
        resp = client.get("/api/v1/health")
        assert resp.status_code == 200
        # Verify mandatory security headers
        assert resp.headers.get("X-Content-Type-Options") == "nosniff"
        assert resp.headers.get("X-Frame-Options") == "DENY"
        assert resp.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
        assert "Content-Security-Policy" in resp.headers

        data = resp.json()
        assert data["status"] in ("ok", "degraded")
        assert "last_updated" in data
        assert "disclaimers" in data
        assert "newsapi_budget" in data

    def test_events_list_and_filtering(self, client):
        resp = client.get("/api/v1/events")
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] >= 25
        assert len(body["items"]) >= 20
        assert "last_updated" in body
        assert "disclaimers" in body

        # Filter by category (both canonical and camelCase IDs)
        wf_resp = client.get("/api/v1/events", params={"category": "Wildfires", "status": "open"})
        assert wf_resp.status_code == 200
        wf_items = wf_resp.json()["items"]
        assert len(wf_items) >= 1
        assert all(ev["category"] == "Wildfires" and ev["status"] == "open" for ev in wf_items)

        storm_resp = client.get("/api/v1/events", params={"category": "severeStorms"})
        assert storm_resp.status_code == 200
        storm_items = storm_resp.json()["items"]
        assert len(storm_items) >= 1
        assert all("storm" in ev["category"].lower() for ev in storm_items)

        ice_resp = client.get("/api/v1/events", params={"category": "seaLakeIce"})
        assert ice_resp.status_code == 200
        ice_items = ice_resp.json()["items"]
        assert len(ice_items) >= 1
        assert all("ice" in ev["category"].lower() for ev in ice_items)

        # Filter by Philippines bounding box (minLon,minLat,maxLon,maxLat)
        bbox_resp = client.get("/api/v1/events", params={"bbox": "116.0,4.5,127.5,21.5"})
        assert bbox_resp.status_code == 200
        bbox_items = bbox_resp.json()["items"]
        assert len(bbox_items) >= 1
        assert any("PHL" in [c["iso_a3"] for c in ev.get("countries", [])] for ev in bbox_items)

        # Invalid bbox returns 422/400
        bad_bbox = client.get("/api/v1/events", params={"bbox": "999,999,-999,-999"})
        assert bad_bbox.status_code in (400, 422)

    def test_event_detail_and_articles_endpoints(self, client):
        list_resp = client.get("/api/v1/events", params={"q": "Mayon"})
        assert list_resp.status_code == 200
        items = list_resp.json()["items"]
        assert len(items) >= 1
        event_id = items[0]["id"]

        detail_resp = client.get(f"/api/v1/events/{event_id}")
        assert detail_resp.status_code == 200
        detail = detail_resp.json()
        assert detail["id"] == event_id
        assert len(detail["observations"]) >= 1
        assert len(detail["countries"]) >= 1
        phl = next((c for c in detail["countries"] if c["iso_a3"] == "PHL"), None)
        assert phl is not None
        assert phl["population_density"] is not None
        assert "National Average" in phl["density_label"]
        assert "disclaimers" in detail

        articles_resp = client.get(f"/api/v1/events/{event_id}/articles")
        assert articles_resp.status_code == 200
        art_data = articles_resp.json()
        assert art_data["algorithm_version"] == "v1"
        assert len(art_data["items"]) >= 1
        first_art = art_data["items"][0]
        assert first_art["score"] >= 25
        assert first_art["confidence_label"] in ("Strong", "Moderate", "Weak")
        assert len(first_art["match_reasons"]) >= 1

        # 404 on non-existent event
        not_found = client.get("/api/v1/events/DOES_NOT_EXIST_999999")
        assert not_found.status_code == 404

        # Safe sync trigger endpoint
        sync_resp = client.post("/api/v1/sync", params={"offline": "true"})
        assert sync_resp.status_code == 200
        assert sync_resp.json()["status"] == "completed"

    def test_idempotent_upserts_preserve_observation_history(self, test_db):
        event_payload = {
            "id": "EONET_IDEMPOTENT_01",
            "title": "Taal Volcano Activity",
            "category": "Volcanoes",
            "status": "open",
            "closed_at": None,
            "sources": [{"id": "PHIVOLCS", "url": "https://www.phivolcs.dost.gov.ph"}],
            "observations": [
                {
                    "observed_at": "2026-10-01T00:00:00Z",
                    "geom": {"type": "Point", "coordinates": [120.993, 14.002]},
                    "magnitude_value": None,
                    "magnitude_unit": None,
                }
            ],
        }
        test_db.upsert_event_with_observations(event_payload)
        test_db.upsert_event_with_observations(event_payload)  # Duplicate upsert

        ev1 = test_db.get_event_by_id("EONET_IDEMPOTENT_01")
        assert ev1 is not None
        assert len(ev1["observations"]) == 1
        assert ev1["observations"][0]["magnitude_value"] is None

        # Now add a second dated observation and upsert again
        event_payload["observations"].append(
            {
                "observed_at": "2026-10-02T00:00:00Z",
                "geom": {"type": "Point", "coordinates": [120.995, 14.004]},
                "magnitude_value": 2.5,
                "magnitude_unit": "VEI",
            }
        )
        test_db.upsert_event_with_observations(event_payload)
        ev2 = test_db.get_event_by_id("EONET_IDEMPOTENT_01")
        assert len(ev2["observations"]) == 2

    def test_2000_events_bbox_and_filter_benchmark_under_2_seconds(self, test_db, client):
        # Bulk insert 2,000 events with spatial coordinates across the globe
        bulk_events = []
        categories = ["Wildfires", "Severe Storms", "Volcanoes", "Floods", "Sea and Lake Ice"]
        for i in range(2000):
            lon = -170.0 + (i % 340)
            lat = -70.0 + (i % 140)
            cat = categories[i % len(categories)]
            status = "open" if i % 4 != 0 else "closed"
            bulk_events.append(
                {
                    "id": f"EONET_BENCH_{i:04d}",
                    "title": f"Benchmark {cat} Event #{i}",
                    "category": cat,
                    "status": status,
                    "closed_at": None if status == "open" else "2026-10-03T00:00:00Z",
                    "sources": [{"id": "NASA", "url": "https://eonet.gsfc.nasa.gov"}],
                    "observations": [
                        {
                            "observed_at": "2026-10-04T12:00:00Z",
                            "geom": {"type": "Point", "coordinates": [lon, lat]},
                            "magnitude_value": None,
                            "magnitude_unit": None,
                        }
                    ],
                }
            )
        test_db.bulk_upsert_events_fast(bulk_events)

        t0 = time.perf_counter()
        resp = client.get(
            "/api/v1/events",
            params={
                "bbox": "-180,-90,180,90",
                "category": "Wildfires",
                "status": "open",
                "limit": 500,
            },
        )
        elapsed = time.perf_counter() - t0
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 300
        assert len(data["items"]) >= 300
        assert elapsed < 2.0, f"Expected < 2.0s for 2,000-event query, got {elapsed:.3f}s"

    def test_secrets_never_leak_in_responses(self, client):
        settings = get_settings()
        secret_candidates = [
            settings.newsapi_key,
            "earthemds_local_dev_password",
        ]
        for path in ("/api/v1/health", "/api/v1/events"):
            resp = client.get(path)
            raw_text = resp.text
            for secret in secret_candidates:
                if secret and secret != "PASTE_YOUR_FREE_NEWSAPI_KEY_HERE":
                    assert secret not in raw_text
            assert "earthemds_local_dev_password" not in raw_text
            assert "PASTE_YOUR_FREE_NEWSAPI_KEY_HERE" not in raw_text
