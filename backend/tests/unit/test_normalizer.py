import pytest
from app.services.normalizer import (
    clean_event_title,
    normalize_magnitude,
    canonicalize_url,
    validate_geojson_geometry,
)


class TestCleanEventTitle:
    def test_collapses_messy_whitespace_and_trims(self):
        raw = "  \t  Typhoon   Yagi\n\u00a0  (Severe   Storm)  \r\n "
        assert clean_event_title(raw) == "Typhoon Yagi (Severe Storm)"

    def test_raises_on_empty_or_whitespace_only(self):
        with pytest.raises(ValueError, match="title"):
            clean_event_title("")
        with pytest.raises(ValueError, match="title"):
            clean_event_title("   \t\n  ")
        with pytest.raises(ValueError, match="title"):
            clean_event_title(None)  # type: ignore[arg-type]


class TestNormalizeMagnitude:
    def test_preserves_none_strictly_as_none(self):
        assert normalize_magnitude(None) is None

    def test_converts_valid_numbers_to_float(self):
        assert normalize_magnitude(65) == 65.0
        assert isinstance(normalize_magnitude(65), float)
        assert normalize_magnitude(120.5) == 120.5
        assert normalize_magnitude(0) == 0.0

    def test_rejects_nan_or_infinite(self):
        with pytest.raises(ValueError):
            normalize_magnitude(float("nan"))
        with pytest.raises(ValueError):
            normalize_magnitude(float("inf"))


class TestCanonicalizeUrl:
    def test_strips_tracking_query_params_and_trailing_slash(self):
        raw = (
            "HTTPS://Example.COM/news/mayon-eruption-2026/?"
            "utm_source=twitter&utm_medium=social&utm_campaign=breaking"
            "&fbclid=IwAR12345&gclid=abc&ref=home&mc_cid=11&mc_eid=22#section-2"
        )
        assert canonicalize_url(raw) == "https://example.com/news/mayon-eruption-2026"

    def test_preserves_non_tracking_params_in_deterministic_order(self):
        url1 = "https://news.example.org/article/?id=42&lang=en&utm_term=volcano&utm_content=top"
        url2 = "https://NEWS.example.org/article?lang=en&id=42&fbclid=xyz"
        assert canonicalize_url(url1) == "https://news.example.org/article?id=42&lang=en"
        assert canonicalize_url(url1) == canonicalize_url(url2)

    def test_raises_on_invalid_url(self):
        with pytest.raises(ValueError):
            canonicalize_url("")
        with pytest.raises(ValueError):
            canonicalize_url("not-a-valid-url")


class TestValidateGeoJsonGeometry:
    def test_valid_point(self):
        geom = {"type": "Point", "coordinates": [123.685, 13.257]}
        validated = validate_geojson_geometry(geom)
        assert validated["type"] == "Point"
        assert validated["coordinates"] == [123.685, 13.257]

    def test_valid_linestring(self):
        geom = {
            "type": "LineString",
            "coordinates": [[125.0, 14.0], [123.5, 15.2], [121.0, 16.5]],
        }
        validated = validate_geojson_geometry(geom)
        assert validated["type"] == "LineString"
        assert len(validated["coordinates"]) == 3

    def test_valid_polygon(self):
        geom = {
            "type": "Polygon",
            "coordinates": [
                [
                    [120.0, 14.0],
                    [121.0, 14.0],
                    [121.0, 15.0],
                    [120.0, 15.0],
                    [120.0, 14.0],
                ]
            ],
        }
        validated = validate_geojson_geometry(geom)
        assert validated["type"] == "Polygon"

    def test_rejects_out_of_bounds_longitude_or_latitude(self):
        with pytest.raises(ValueError, match="longitude"):
            validate_geojson_geometry({"type": "Point", "coordinates": [185.0, 13.0]})
        with pytest.raises(ValueError, match="latitude"):
            validate_geojson_geometry({"type": "Point", "coordinates": [120.0, -95.0]})

    def test_rejects_empty_or_malformed_coordinates(self):
        with pytest.raises(ValueError):
            validate_geojson_geometry({"type": "Point", "coordinates": []})
        with pytest.raises(ValueError):
            validate_geojson_geometry({"type": "LineString", "coordinates": [[120.0, 14.0]]})
        with pytest.raises(ValueError):
            validate_geojson_geometry({"type": "Polygon", "coordinates": []})
        with pytest.raises(ValueError):
            validate_geojson_geometry({"type": "UnknownType", "coordinates": [0, 0]})
