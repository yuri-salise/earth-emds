from functools import lru_cache
from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_ROOT_ENV = Path(__file__).resolve().parents[2] / ".env"
_LOCAL_ENV = Path(__file__).resolve().parents[1] / ".env"
_ENV_FILES = [str(p) for p in (_ROOT_ENV, _LOCAL_ENV) if p.exists()]

DISCLAIMERS = {
    "geometry_caveat": (
        "Event coordinates and perimeters from NASA EONET v3 are approximate "
        "satellite/agency observations and may reflect upstream reporting delays. "
        "Do not use for local emergency navigation."
    ),
    "population_density_caveat": (
        "Population density is a national macro-level average calculated from "
        "REST Countries v3.1 (National Population ÷ Total Land Area in km²) and "
        "does not measure local population exposure inside the hazard footprint."
    ),
    "news_matching_caveat": (
        "News articles from NewsAPI v2 are matched contextually by hazard keywords, "
        "country/place names, and publication dates—not by verified GPS coordinates "
        "inside the disaster area."
    ),
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV_FILES if _ENV_FILES else None,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    newsapi_key: str = Field(default="", repr=False)
    newsapi_base_url: str = Field(default="https://newsapi.org/v2")
    newsapi_daily_budget: int = Field(default=90, ge=1, le=1000)

    eonet_base_url: str = Field(default="https://eonet.gsfc.nasa.gov/api/v3")
    eonet_poll_interval_seconds: int = Field(default=600, ge=30)
    eonet_closed_limit: int = Field(default=50, ge=1, le=500)

    rest_countries_base_url: str = Field(default="https://restcountries.com/v3.1")

    database_url: str = Field(default="sqlite:///earth_emds.db", repr=False)
    redis_url: str = Field(default="redis://localhost:6379/0", repr=False)
    cache_ttl_seconds: int = Field(default=300, ge=10)

    environment: str = Field(default="development")
    frontend_origin: str = Field(default="http://localhost:3000")
    rate_limit_per_minute: int = Field(default=120, ge=10)

    @property
    def has_live_newsapi_key(self) -> bool:
        key = (self.newsapi_key or "").strip()
        return bool(key) and key != "PASTE_YOUR_FREE_NEWSAPI_KEY_HERE" and len(key) >= 16


@lru_cache
def get_settings() -> Settings:
    return Settings()
