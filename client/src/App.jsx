import { useState } from 'react';

function App() {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const extract = async () => {
    setError('');
    setResult(null);
    if (!url.trim()) {
      setError('Please paste a video URL.');
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || JSON.stringify(data));
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const showList = (items) => {
    if (!items?.length) return <small>No data found.</small>;
    return <ul>{items.map((v, i) => <li key={i}>{v}</li>)}</ul>;
  };

  return (
    <div className="app">
      <header>
        <h1>Recipe Video Extractor</h1>
        <p>Works with YouTube, Instagram, Facebook links.</p>
      </header>

      <main>
        <label htmlFor="url">Video URL</label>
        <input
          id="url"
          placeholder="https://www.youtube.com/watch?v=..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button onClick={extract} disabled={loading}>{loading ? 'Extracting...' : 'Extract Recipe'}</button>

        {error && <div className="error">{error}</div>}

        {result && (
          <section className="result">
            <h2>Extraction Result</h2>
            <p><strong>Platform:</strong> {result.platform}</p>
            <p><strong>Title:</strong> {result.metadata?.title || 'n/a'}</p>
            <p><strong>Source:</strong> <a href={result.sourceUrl} target="_blank" rel="noreferrer">{result.sourceUrl}</a></p>
            <details>
              <summary>Raw Text</summary>
              <pre>{result.rawText}</pre>
            </details>
            <div>
              <h3>Ingredients</h3>
              {showList(result.recipe?.ingredients)}
            </div>
            <div>
              <h3>Steps</h3>
              {showList(result.recipe?.steps)}
            </div>
            {!result.hasRecipe && <div className="warning">No recipe structure detected. Try a detailed description link or paste manually.</div>}
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
