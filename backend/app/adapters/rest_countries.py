from datetime import datetime, timezone
import httpx

from app.config import get_settings
from app.services.demographics import (
    calculate_population_density,
    format_density_label,
)

# Built-in demographic dataset (REST Countries v3.1 baseline) so country profiles
# are always available even when offline or during upstream rate-limiting.
_RAW_FALLBACK_COUNTRIES: list[tuple[str, str, str, int, float, dict]] = [
    ("PHL", "PH", "Philippines", 117337368, 300000.0, {"PHP": {"name": "Philippine peso", "symbol": "₱"}}),
    ("USA", "US", "United States", 334914895, 9372610.0, {"USD": {"name": "United States dollar", "symbol": "$"}}),
    ("JPN", "JP", "Japan", 123294513, 377930.0, {"JPY": {"name": "Japanese yen", "symbol": "¥"}}),
    ("IDN", "ID", "Indonesia", 277534122, 1904569.0, {"IDR": {"name": "Indonesian rupiah", "symbol": "Rp"}}),
    ("CHL", "CL", "Chile", 19629590, 756102.0, {"CLP": {"name": "Chilean peso", "symbol": "$"}}),
    ("AUS", "AU", "Australia", 26638544, 7692024.0, {"AUD": {"name": "Australian dollar", "symbol": "$"}}),
    ("CAN", "CA", "Canada", 40097761, 9984670.0, {"CAD": {"name": "Canadian dollar", "symbol": "$"}}),
    ("MEX", "MX", "Mexico", 128455567, 1964375.0, {"MXN": {"name": "Mexican peso", "symbol": "$"}}),
    ("BRA", "BR", "Brazil", 216422446, 8515767.0, {"BRL": {"name": "Brazilian real", "symbol": "R$"}}),
    ("IND", "IN", "India", 1428627663, 3287590.0, {"INR": {"name": "Indian rupee", "symbol": "₹"}}),
    ("CHN", "CN", "China", 1410710000, 9706961.0, {"CNY": {"name": "Chinese yuan", "symbol": "¥"}}),
    ("ITA", "IT", "Italy", 58761146, 301336.0, {"EUR": {"name": "Euro", "symbol": "€"}}),
    ("GRC", "GR", "Greece", 10361295, 131990.0, {"EUR": {"name": "Euro", "symbol": "€"}}),
    ("TUR", "TR", "Turkey", 85326000, 783562.0, {"TRY": {"name": "Turkish lira", "symbol": "₺"}}),
    ("NZL", "NZ", "New Zealand", 5223100, 270467.0, {"NZD": {"name": "New Zealand dollar", "symbol": "$"}}),
    ("ISL", "IS", "Iceland", 387758, 103000.0, {"ISK": {"name": "Icelandic króna", "symbol": "kr"}}),
    ("RUS", "RU", "Russia", 143826130, 17098242.0, {"RUB": {"name": "Russian ruble", "symbol": "₽"}}),
    ("ESP", "ES", "Spain", 48373336, 505992.0, {"EUR": {"name": "Euro", "symbol": "€"}}),
    ("PRT", "PT", "Portugal", 10525347, 92090.0, {"EUR": {"name": "Euro", "symbol": "€"}}),
    ("FRA", "FR", "France", 68170228, 551695.0, {"EUR": {"name": "Euro", "symbol": "€"}}),
    ("GBR", "GB", "United Kingdom", 67736802, 242900.0, {"GBP": {"name": "British pound", "symbol": "£"}}),
    ("ZAF", "ZA", "South Africa", 60414495, 1221037.0, {"ZAR": {"name": "South African rand", "symbol": "R"}}),
    ("KEN", "KE", "Kenya", 55100586, 580367.0, {"KES": {"name": "Kenyan shilling", "symbol": "Sh"}}),
    ("MDG", "MG", "Madagascar", 30325732, 587041.0, {"MGA": {"name": "Malagasy ariary", "symbol": "Ar"}}),
    ("PER", "PE", "Peru", 34352719, 1285216.0, {"PEN": {"name": "Peruvian sol", "symbol": "S/."}}),
    ("COL", "CO", "Colombia", 52085168, 1141748.0, {"COP": {"name": "Colombian peso", "symbol": "$"}}),
    ("ARG", "AR", "Argentina", 45773884, 2780400.0, {"ARS": {"name": "Argentine peso", "symbol": "$"}}),
    ("ECU", "EC", "Ecuador", 18190484, 276841.0, {"USD": {"name": "United States dollar", "symbol": "$"}}),
    ("GTM", "GT", "Guatemala", 18092026, 108889.0, {"GTQ": {"name": "Guatemalan quetzal", "symbol": "Q"}}),
    ("CRI", "CR", "Costa Rica", 5212173, 51100.0, {"CRC": {"name": "Costa Rican colón", "symbol": "₡"}}),
    ("NIC", "NI", "Nicaragua", 7046310, 130373.0, {"NIO": {"name": "Nicaraguan córdoba", "symbol": "C$"}}),
    ("HND", "HN", "Honduras", 10593798, 112492.0, {"HNL": {"name": "Honduran lempira", "symbol": "L"}}),
    ("SLV", "SV", "El Salvador", 6364943, 21041.0, {"USD": {"name": "United States dollar", "symbol": "$"}}),
    ("CUB", "CU", "Cuba", 11194449, 109884.0, {"CUP": {"name": "Cuban peso", "symbol": "$"}}),
    ("HTI", "HT", "Haiti", 11724763, 27750.0, {"HTG": {"name": "Haitian gourde", "symbol": "G"}}),
    ("DOM", "DO", "Dominican Republic", 11332972, 48671.0, {"DOP": {"name": "Dominican peso", "symbol": "$"}}),
    ("JAM", "JM", "Jamaica", 2825544, 10991.0, {"JMD": {"name": "Jamaican dollar", "symbol": "$"}}),
    ("FJI", "FJ", "Fiji", 936375, 18272.0, {"FJD": {"name": "Fijian dollar", "symbol": "$"}}),
    ("VUT", "VU", "Vanuatu", 334506, 12189.0, {"VUV": {"name": "Vanuatu vatu", "symbol": "Vt"}}),
    ("TON", "TO", "Tonga", 107773, 747.0, {"TOP": {"name": "Tongan paʻanga", "symbol": "T$"}}),
    ("PNG", "PG", "Papua New Guinea", 10329931, 462840.0, {"PGK": {"name": "Papua New Guinean kina", "symbol": "K"}}),
    ("VNM", "VN", "Vietnam", 98858950, 331212.0, {"VND": {"name": "Vietnamese đồng", "symbol": "₫"}}),
    ("THA", "TH", "Thailand", 71801279, 513120.0, {"THB": {"name": "Thai baht", "symbol": "฿"}}),
    ("MMR", "MM", "Myanmar", 54577997, 676578.0, {"MMK": {"name": "Burmese kyat", "symbol": "Ks"}}),
    ("BGD", "BD", "Bangladesh", 172954319, 147570.0, {"BDT": {"name": "Bangladeshi taka", "symbol": "৳"}}),
    ("PAK", "PK", "Pakistan", 240485658, 881912.0, {"PKR": {"name": "Pakistani rupee", "symbol": "₨"}}),
    ("NPL", "NP", "Nepal", 30896590, 147181.0, {"NPR": {"name": "Nepalese rupee", "symbol": "₨"}}),
    ("IRN", "IR", "Iran", 89172767, 1648195.0, {"IRR": {"name": "Iranian rial", "symbol": "﷼"}}),
    ("MAR", "MA", "Morocco", 37840044, 446550.0, {"MAD": {"name": "Moroccan dirham", "symbol": "د.م."}}),
    ("DZA", "DZ", "Algeria", 45606480, 2381741.0, {"DZD": {"name": "Algerian dinar", "symbol": "د.ج"}}),
    ("EGY", "EG", "Egypt", 112716598, 1002450.0, {"EGP": {"name": "Egyptian pound", "symbol": "£"}}),
    ("NGA", "NG", "Nigeria", 223804632, 923768.0, {"NGN": {"name": "Nigerian naira", "symbol": "₦"}}),
    ("ETH", "ET", "Ethiopia", 126527060, 1104300.0, {"ETB": {"name": "Ethiopian birr", "symbol": "Br"}}),
    ("MOZ", "MZ", "Mozambique", 33897354, 801590.0, {"MZN": {"name": "Mozambican metical", "symbol": "MT"}}),
    ("KOR", "KR", "South Korea", 51712619, 100210.0, {"KRW": {"name": "South Korean won", "symbol": "₩"}}),
    ("TWN", "TW", "Taiwan", 23570000, 36193.0, {"TWD": {"name": "New Taiwan dollar", "symbol": "NT$"}}),
    ("MYS", "MY", "Malaysia", 34308525, 330803.0, {"MYR": {"name": "Malaysian ringgit", "symbol": "RM"}}),
    ("SGP", "SG", "Singapore", 5917648, 728.0, {"SGD": {"name": "Singapore dollar", "symbol": "$"}}),
    ("NOR", "NO", "Norway", 5519594, 323802.0, {"NOK": {"name": "Norwegian krone", "symbol": "kr"}}),
    ("SWE", "SE", "Sweden", 10536632, 450295.0, {"SEK": {"name": "Swedish krona", "symbol": "kr"}}),
    ("FIN", "FI", "Finland", 5583911, 338424.0, {"EUR": {"name": "Euro", "symbol": "€"}}),
    ("DEU", "DE", "Germany", 84482267, 357114.0, {"EUR": {"name": "Euro", "symbol": "€"}}),
]


def get_fallback_country_profiles() -> dict[str, dict]:
    now_iso = datetime.now(timezone.utc).isoformat()
    profiles: dict[str, dict] = {}
    for iso3, iso2, name, pop, area, curr in _RAW_FALLBACK_COUNTRIES:
        density = calculate_population_density(pop, area)
        profiles[iso3] = {
            "iso_a3": iso3,
            "iso_a2": iso2,
            "name": name,
            "population": pop,
            "area_sq_km": area,
            "population_density": density,
            "density_label": format_density_label(density),
            "currencies": curr,
            "retrieved_at": now_iso,
        }
    return profiles


def parse_rest_country_payload(raw: dict) -> dict | None:
    """Parse a single REST Countries v3.1 country object, omitting iso_a3 == '-99'."""
    if not isinstance(raw, dict):
        return None
    iso3 = str(raw.get("cca3") or "").strip().upper()
    if not iso3 or iso3 == "-99" or len(iso3) != 3:
        return None
    iso2 = str(raw.get("cca2") or "").strip().upper() or iso3[:2]

    name_obj = raw.get("name")
    if isinstance(name_obj, dict):
        name = str(name_obj.get("common") or name_obj.get("official") or iso3).strip()
    else:
        name = str(name_obj or iso3).strip()

    pop_raw = raw.get("population")
    population = int(pop_raw) if isinstance(pop_raw, (int, float)) and pop_raw >= 0 else None

    area_raw = raw.get("area")
    area_sq_km = float(area_raw) if isinstance(area_raw, (int, float)) else None

    density = calculate_population_density(population, area_sq_km)
    currencies = raw.get("currencies") if isinstance(raw.get("currencies"), dict) else {}

    return {
        "iso_a3": iso3,
        "iso_a2": iso2,
        "name": name,
        "population": population,
        "area_sq_km": area_sq_km if (area_sq_km is not None and area_sq_km >= 0) else None,
        "population_density": density,
        "density_label": format_density_label(density),
        "currencies": currencies,
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
    }


async def fetch_country_profiles(
    iso_codes: list[str],
    force_offline: bool = False,
) -> dict[str, dict]:
    """Fetch country profiles for given ISO3 codes from REST Countries v3.1 with fallback."""
    valid_codes = sorted(
        {
            c.strip().upper()
            for c in iso_codes
            if isinstance(c, str) and len(c.strip()) == 3 and c.strip() != "-99"
        }
    )
    if not valid_codes:
        return {}

    fallback_map = get_fallback_country_profiles()
    results: dict[str, dict] = {
        code: fallback_map[code]
        for code in valid_codes
        if code in fallback_map
    }

    if force_offline:
        return results

    settings = get_settings()
    url = f"{settings.rest_countries_base_url.rstrip('/')}/alpha"
    params = {
        "codes": ",".join(valid_codes),
        "fields": "name,cca2,cca3,population,area,currencies",
    }
    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(5.0, connect=2.5),
            headers={"Accept": "application/json", "User-Agent": "earth-emds/1.0"},
        ) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            payload = resp.json()
            if isinstance(payload, list):
                for item in payload:
                    parsed = parse_rest_country_payload(item)
                    if parsed:
                        results[parsed["iso_a3"]] = parsed
    except Exception:
        pass

    return results
