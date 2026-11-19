import React from 'react';
import { ScoredArticle } from '../types/domain';
import { formatUtcTimestamp, safeExternalUrl } from '../utils/categories';

interface ArticleListProps {
  articles: ScoredArticle[];
  isLoading: boolean;
}

export const ArticleList: React.FC<ArticleListProps> = React.memo(({ articles, isLoading }) => {
  return (
    <section className="drawer-section" aria-labelledby="drawer-news-heading">
      <div className="drawer-section-header">
        <h3 id="drawer-news-heading" className="drawer-section-title">
          Ranked News Coverage &amp; Match Evidence
        </h3>
        <span className="section-source-tag mono-text">Rule Scorer v1</span>
      </div>

      {/* Mandatory Contextual News Matching Disclaimer Badge */}
      <div
        className="disclaimer-badge disclaimer-news"
        role="note"
        data-testid="disclaimer-contextual-news"
      >
        <strong>Contextual News Matching Caveat:</strong> News articles from NewsAPI v2 are matched
        contextually by hazard keywords, country/place names, and publication dates—not by verified
        GPS coordinates inside the disaster area.
      </div>

      {isLoading ? (
        <div className="articles-skeleton-stack" role="status" aria-label="Loading matched news">
          <span className="sr-only">
            Evaluating candidate NewsAPI v2 coverage with rule-based scorer…
          </span>
          {[0, 1].map((i) => (
            <div key={i} className="skeleton-card" aria-hidden="true">
              <div className="skeleton-line skeleton-short" />
              <div className="skeleton-line skeleton-long" />
              <div className="skeleton-line skeleton-med" />
            </div>
          ))}
        </div>
      ) : articles.length === 0 ? (
        <div className="articles-empty-card" data-testid="no-articles-state">
          <p>
            No candidate news articles met the minimum explainable match threshold (score &ge; 25)
            within the current archive window.
          </p>
        </div>
      ) : (
        <div className="articles-list" data-testid="articles-list">
          {articles.map((article) => {
            const confidenceClass =
              article.confidence_label === 'Strong'
                ? 'confidence-strong'
                : article.confidence_label === 'Moderate'
                  ? 'confidence-moderate'
                  : 'confidence-weak';
            const safeHref = safeExternalUrl(article.original_url || article.canonical_url);

            return (
              <article
                key={article.canonical_url}
                className="article-card"
                data-testid="scored-article-card"
              >
                <div className="article-top-bar">
                  <div className="article-publisher-meta">
                    <span className="article-publisher">{article.publisher}</span>
                    <span className="article-dot" aria-hidden="true">
                      ·
                    </span>
                    <time
                      className="article-date mono-text"
                      dateTime={article.published_at}
                    >
                      {formatUtcTimestamp(article.published_at)}
                    </time>
                  </div>

                  <div className="article-score-group">
                    <span
                      className={`confidence-badge ${confidenceClass}`}
                      data-testid="article-confidence-badge"
                    >
                      {article.confidence_label} Match
                    </span>
                    <span className="score-pill mono-text" data-testid="article-score-value">
                      {article.score}/100 ({article.algorithm_version})
                    </span>
                  </div>
                </div>

                {/* Score Progress Bar */}
                <div className="score-bar-track" aria-hidden="true">
                  <div
                    className={`score-bar-fill ${confidenceClass}`}
                    style={{ width: `${Math.max(5, Math.min(100, article.score))}%` }}
                  />
                </div>

                <h4 className="article-headline">
                  {safeHref ? (
                    <a
                      href={safeHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="article-external-link"
                      data-testid="article-external-link"
                    >
                      <span>{article.title}</span>
                      <span className="external-arrow" aria-hidden="true">
                        ↗
                      </span>
                    </a>
                  ) : (
                    <span>{article.title}</span>
                  )}
                </h4>

                {article.description && (
                  <p className="article-description">{article.description}</p>
                )}

                {/* Human-Readable Match Reasons Chips */}
                <div className="match-reasons-block">
                  <span className="match-reasons-label mono-text">Scoring evidence</span>
                  <div className="match-reasons-chips" data-testid="article-match-reasons">
                    {article.match_reasons.map((reason, idx) => (
                      <span
                        key={`${article.canonical_url}-reason-${idx}`}
                        className="match-reason-chip"
                        data-testid="match-reason-chip"
                      >
                        ✓ {reason}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
});
