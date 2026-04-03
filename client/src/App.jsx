import { useState, useEffect, useRef } from 'react';
import { t, isRTL, detectTextDirection } from './i18n.js';

const PLATFORM_LABELS = {
  youtube: 'YouTube',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  other: 'Website',
};

const PLATFORM_COLORS = {
  youtube: '#ff0000',
  instagram: '#e1306c',
  tiktok: '#00f2ea',
  facebook: '#1877f2',
  other: '#888',
};

export default function App() {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lang, setLang] = useState('en');

  const rtl = isRTL(lang);
  const hasAutoExtracted = useRef(false);

  const doExtract = async (targetUrl) => {
    const trimmed = targetUrl.trim();
    if (!trimmed) {
      setError(t(lang, 'errorEmpty'));
      return;
    }

    setError('');
    setResult(null);
    setLoading(true);

    try {
      const resp = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Extraction failed');
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Auto-extract when opened via iOS Shortcut share (with ?url= param)
  useEffect(() => {
    if (hasAutoExtracted.current) return;
    const search = window.location.search;
    const urlMatch = search.match(/[?&]url=(.+)/);
    const textMatch = search.match(/[?&]text=(.+)/);
    const raw = urlMatch?.[1] || textMatch?.[1];
    if (raw) {
      const sharedUrl = decodeURIComponent(raw);
      hasAutoExtracted.current = true;
      setUrl(sharedUrl);
      window.history.replaceState({}, '', window.location.pathname);
      doExtract(sharedUrl);
    }
  }, []);

  const handleExtract = () => doExtract(url);

  const handleAiParse = async () => {
    if (!result?.rawText) return;

    setResult(prev => ({ ...prev, aiLoading: true, aiError: '' }));

    try {
      const resp = await fetch('/api/ai-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: result.rawText }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'AI parsing failed');

      setResult(prev => ({
        ...prev,
        recipe: data.recipe,
        hasRecipe: true,
        aiParsed: true,
        aiLoading: false,
      }));
    } catch (err) {
      setResult(prev => ({ ...prev, aiLoading: false, aiError: err.message }));
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleExtract();
  };

  const handleClear = () => {
    setUrl('');
    setResult(null);
    setError('');
  };

  return (
    <div className="container" dir={rtl ? 'rtl' : 'ltr'}>
      <button
        className="lang-toggle"
        onClick={() => setLang(lang === 'en' ? 'he' : 'en')}
      >
        {t(lang, 'langToggle')}
      </button>

      <header className="header">
        <h1>{t(lang, 'title')}</h1>
        <p className="subtitle">{t(lang, 'subtitle')}</p>
      </header>

      <div className="input-group">
        <div className="input-row">
          <input
            type="url"
            dir="ltr"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder={t(lang, 'placeholder')}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
        </div>
        <div className="button-row">
          <button className="btn-primary" onClick={handleExtract} disabled={loading}>
            {loading ? (
              <span className="spinner-wrap">
                <span className="spinner" />
                {t(lang, 'extracting')}
              </span>
            ) : (
              t(lang, 'extract')
            )}
          </button>
          {(result || error) && (
            <button className="btn-secondary" onClick={handleClear}>
              {t(lang, 'clear')}
            </button>
          )}
        </div>
      </div>

      {error && <div className="error-card">{error}</div>}

      {result && <RecipeResult data={result} lang={lang} onAiParse={handleAiParse} />}
    </div>
  );
}

function RecipeResult({ data, lang, onAiParse }) {
  const platformColor = PLATFORM_COLORS[data.platform] || '#888';
  const platformLabel = PLATFORM_LABELS[data.platform] || data.platform;
  const { recipe } = data;

  const contentDir = detectTextDirection(data.rawText);

  const handleSave = async () => {
    const title = recipe?.title || data.title || 'Recipe';
    const parts = [title, ''];

    if (recipe?.ingredientGroups?.length > 0) {
      parts.push(t(lang, 'ingredients').toUpperCase(), '');
      for (const group of recipe.ingredientGroups) {
        if (group.group) parts.push(group.group + ':');
        for (const item of group.items || []) parts.push('- ' + item);
        parts.push('');
      }
    } else if (recipe?.ingredients?.length > 0) {
      parts.push(t(lang, 'ingredients').toUpperCase(), '');
      for (const item of recipe.ingredients) parts.push('- ' + item);
      parts.push('');
    }

    if (recipe?.instructions?.length > 0) {
      parts.push(t(lang, 'instructions').toUpperCase(), '');
      recipe.instructions.forEach((step, i) => parts.push(`${i + 1}. ${step}`));
      parts.push('');
    }

    parts.push(t(lang, 'watchVideo') + ': ' + data.videoUrl);

    const text = parts.join('\n');

    if (navigator.share) {
      try {
        await navigator.share({ title, text });
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(text);
      alert('Copied to clipboard!');
    }
  };

  return (
    <div className="result">
      {/* Platform badge + title */}
      <div className="result-header">
        <span className="platform-badge" style={{ backgroundColor: platformColor }}>
          {platformLabel}
        </span>
        {data.title && <h2 className="result-title" dir={detectTextDirection(data.title)}>{data.title}</h2>}
      </div>

      {/* Video link + Save */}
      <div className="result-actions">
        <a
          href={data.videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="video-link"
        >
          {t(lang, 'watchVideo')} &rarr;
        </a>
        <button className="btn-save" onClick={handleSave}>
          {t(lang, 'save')}
        </button>
      </div>

      {/* YouTube embed */}
      {data.embedUrl && (
        <div className="embed-wrapper">
          <iframe
            src={data.embedUrl}
            title="Video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {/* AI Parse button */}
      {!data.aiParsed && (
        <button
          className="btn-ai"
          onClick={onAiParse}
          disabled={data.aiLoading}
        >
          {data.aiLoading ? (
            <span className="spinner-wrap">
              <span className="spinner" />
              {t(lang, 'aiParsing')}
            </span>
          ) : (
            t(lang, 'aiParse')
          )}
        </button>
      )}

      {data.aiParsed && (
        <div className="ai-badge">{t(lang, 'aiParsed')}</div>
      )}

      {data.aiError && <div className="error-card">{data.aiError}</div>}

      {!data.hasRecipe && !data.aiParsed && (
        <div className="warning-card">
          {t(lang, 'noRecipe')}
        </div>
      )}

      {/* Recipe sections */}
      <div className="recipe-sections">
        {recipe?.title && (
          <h2 className="recipe-name" dir={detectTextDirection(recipe.title)}>{recipe.title}</h2>
        )}

        {(recipe?.ingredientGroups?.length > 0 || recipe?.ingredients?.length > 0) && (
          <section className="recipe-card" dir={contentDir}>
            <h3>{t(lang, 'ingredients')}</h3>
            {recipe.ingredientGroups?.length > 0 ? (
              recipe.ingredientGroups.map((group, gi) => (
                <div key={gi} className="ingredient-group">
                  {group.group && <h4 className="ingredient-group-title">{group.group}</h4>}
                  <ul className="ingredient-list">
                    {group.items?.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))
            ) : (
              <ul className="ingredient-list">
                {recipe.ingredients.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        )}

        {recipe?.instructions?.length > 0 && (
          <section className="recipe-card" dir={contentDir}>
            <h3>{t(lang, 'instructions')}</h3>
            <ol className="instruction-list">
              {recipe.instructions.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </section>
        )}

        {recipe?.description && (
          <section className="recipe-card" dir={contentDir}>
            <h3>{t(lang, 'description')}</h3>
            <p className="description-text">{recipe.description}</p>
          </section>
        )}
      </div>

      {/* Raw text collapsible */}
      <details className="raw-text-details">
        <summary>{t(lang, 'showRaw')}</summary>
        <pre dir={contentDir}>{data.rawText}</pre>
      </details>
    </div>
  );
}
