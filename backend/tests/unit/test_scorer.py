from app.services.scorer import (
    ALGORITHM_VERSION,
    score_candidate_article,
    score_and_rank_articles,
)


class TestArticleScorer:
    def test_algorithm_version_is_v1(self):
        assert ALGORITHM_VERSION == "v1"

    def test_strong_match_all_criteria(self):
        res = score_candidate_article(
            article={
                "title": "Mayon Volcano Eruption Forces Evacuations in Albay, Philippines",
                "description": "Ash plumes and lava flow reported near Mayon Volcano in the Philippines.",
                "url": "https://news.example.com/mayon-eruption?utm_source=rss",
                "publisher": "Manila Bulletin",
                "published_at": "2026-10-05T08:00:00Z",
            },
            event_title="Mayon Volcano, Philippines",
            event_category="Volcanoes",
            country_names=["Philippines"],
            event_dates=["2026-10-04T12:00:00Z"],
        )
        assert res["score"] == 100
        assert res["confidence_label"] == "Strong"
        assert res["algorithm_version"] == "v1"
        assert res["canonical_url"] == "https://news.example.com/mayon-eruption"
        assert any("Matched event title phrase" in r and "(+35)" in r for r in res["match_reasons"])
        assert any("Matched hazard category keyword" in r and "(+25)" in r for r in res["match_reasons"])
        assert any("Matched country/location" in r and "(+25)" in r for r in res["match_reasons"])
        assert any("Published within event observation window (+15)" in r for r in res["match_reasons"])

    def test_moderate_match_category_country_and_date(self):
        res = score_candidate_article(
            article={
                "title": "New wildfire containment efforts underway across central Chile",
                "description": "Firefighters battle forest blaze during dry conditions.",
                "url": "https://news.example.com/chile-wildfire",
                "publisher": "Reuters",
                "published_at": "2026-10-05T10:00:00Z",
            },
            event_title="Valparaiso Sector Forest Event 992",
            event_category="Wildfires",
            country_names=["Chile"],
            event_dates=["2026-10-04T00:00:00Z"],
        )
        # 25 (category: wildfire) + 25 (country: Chile) + 15 (date window) = 65 -> Moderate
        assert res["score"] == 65
        assert res["confidence_label"] == "Moderate"

    def test_weak_match_and_discard_below_25(self):
        weak = score_candidate_article(
            article={
                "title": "Seasonal typhoon preparations discussed by meteorologists",
                "description": "General weather outlook for the Pacific basin.",
                "url": "https://news.example.com/typhoon-prep",
                "publisher": "Weather Daily",
                "published_at": "2026-08-01T00:00:00Z",
            },
            event_title="Typhoon Krathon",
            event_category="Severe Storms",
            country_names=["Philippines"],
            event_dates=["2026-10-04T00:00:00Z"],
        )
        assert weak["score"] == 25
        assert weak["confidence_label"] == "Weak"

        unrelated = score_candidate_article(
            article={
                "title": "Stock markets rally on tech earnings report",
                "description": "Global equities rose sharply on Tuesday.",
                "url": "https://news.example.com/stocks",
                "publisher": "Finance Wire",
                "published_at": "2026-08-01T00:00:00Z",
            },
            event_title="Mayon Volcano",
            event_category="Volcanoes",
            country_names=["Philippines"],
            event_dates=["2026-10-04T00:00:00Z"],
        )
        assert unrelated["score"] == 0
        assert unrelated["confidence_label"] == "Weak"

    def test_rank_and_deduplicate_by_canonical_url(self):
        candidates = [
            {
                "title": "Mayon Volcano Eruption in Philippines",
                "description": "Volcano ash alert in the Philippines.",
                "url": "https://news.example.com/story-1?utm_source=facebook",
                "publisher": "Inquirer",
                "published_at": "2026-10-04T15:00:00Z",
            },
            {
                "title": "Mayon Volcano Eruption in Philippines",
                "description": "Volcano ash alert in the Philippines.",
                "url": "https://news.example.com/story-1/?fbclid=99999",
                "publisher": "Inquirer",
                "published_at": "2026-10-04T15:00:00Z",
            },
            {
                "title": "Unrelated local sports tournament",
                "description": "Basketball finals.",
                "url": "https://news.example.com/sports",
                "publisher": "Sports News",
                "published_at": "2026-01-01T00:00:00Z",
            },
        ]
        ranked = score_and_rank_articles(
            articles=candidates,
            event_title="Mayon Volcano, Philippines",
            event_category="Volcanoes",
            country_names=["Philippines"],
            event_dates=["2026-10-04T12:00:00Z"],
            min_score=25,
        )
        assert len(ranked) == 1
        assert ranked[0]["canonical_url"] == "https://news.example.com/story-1"
        assert ranked[0]["score"] == 100
