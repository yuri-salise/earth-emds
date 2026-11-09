from app.services.demographics import (
    calculate_population_density,
    format_density_label,
)


class TestDemographics:
    def test_calculates_rounded_integer_density(self):
        # Philippines approx: 117,337,368 / 300,000 = 391.12 -> 391
        density = calculate_population_density(117_337_368, 300_000.0)
        assert density == 391
        assert isinstance(density, int)

    def test_rounds_to_nearest_integer(self):
        assert calculate_population_density(155, 100.0) == 2
        assert calculate_population_density(149, 100.0) == 1
        assert calculate_population_density(0, 500.0) == 0

    def test_returns_none_for_zero_negative_or_missing_area(self):
        assert calculate_population_density(1_000_000, 0) is None
        assert calculate_population_density(1_000_000, 0.0) is None
        assert calculate_population_density(1_000_000, -10.5) is None
        assert calculate_population_density(1_000_000, None) is None

    def test_returns_none_for_missing_or_negative_population(self):
        assert calculate_population_density(None, 300_000.0) is None
        assert calculate_population_density(-500, 300_000.0) is None
        assert calculate_population_density(None, None) is None

    def test_formats_density_labels_correctly(self):
        assert format_density_label(391) == "National Average (391 people/km²)"
        assert format_density_label(0) == "National Average (0 people/km²)"
        assert (
            format_density_label(None)
            == "National Average (Unavailable — zero/missing area)"
        )
