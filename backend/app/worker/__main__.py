import asyncio
from app.config import get_settings
from app.db import Database


async def run_worker_forever() -> None:
    settings = get_settings()
    db = Database()
    db.init_schema()
    db.seed_initial_data()
    while True:
        try:
            await db.run_live_sync(force_offline=False)
        except Exception:
            pass
        await asyncio.sleep(settings.eonet_poll_interval_seconds)


if __name__ == "__main__":
    asyncio.run(run_worker_forever())
