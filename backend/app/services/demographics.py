def calculate_population_density(
    population: int | None,
    area_sq_km: float | None,
) -> int | None:
    """Calculate national population density (people/km²) rounded to nearest integer.

    Returns None when population or area_sq_km is missing, or when area_sq_km <= 0
    or population < 0.
    """
    if population is None or area_sq_km is None:
        return None
    if area_sq_km <= 0 or population < 0:
        return None
    return int(round(population / area_sq_km))


def format_density_label(density: int | None) -> str:
    """Return explicit national macro-level population density label."""
    if density is None:
        return "National Average (Unavailable — zero/missing area)"
    return f"National Average ({density} people/km²)"
