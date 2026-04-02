import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { parseRecipe } from './recipeParser.js';
import { extractFromYouTube, extractFromInstagram, extractFromFacebook } from './extractors.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

app.use(helmet());
app.use(express.json({ limit: '30mb' }));
app.use(morgan('dev'));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

function detectPlatform(url) {
  if (/youtu/.test(url)) return 'youtube';
  if (/instagram\.com/.test(url)) return 'instagram';
  if (/facebook\.com/.test(url)) return 'facebook';
  return 'generic';
}

app.post('/extract', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    const platform = detectPlatform(url);
    let result;

    if (platform === 'youtube') {
      result = await extractFromYouTube(url, process.env.YOUTUBE_API_KEY);
    } else if (platform === 'instagram') {
      result = await extractFromInstagram(url);
    } else if (platform === 'facebook') {
      result = await extractFromFacebook(url);
    } else {
      const resHtml = await import('axios').then(m => m.default.get(url, { timeout: 10000 }));
      result = { title: '', description: '', rawText: resHtml.data.substring(0, 1000), source: 'generic' };
    }

    if (result.error) return res.status(500).json(result);

    const rawText = [result.title, result.description, result.rawText].filter(Boolean).join('\n');
    const parsed = parseRecipe(rawText);

    return res.json({
      platform,
      sourceUrl: url,
      metadata: {
        title: result.title || '',
        source: result.source || platform
      },
      rawText,
      recipe: parsed,
      hasRecipe: Boolean(parsed)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Extraction failed', details: err.message });
  }
});

app.get('/', (req, res) => res.json({ status: 'ok' }));

app.listen(port, () => console.log(`Recipe extractor server running on port ${port}`));
