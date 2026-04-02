import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractRecipe } from './extractor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 4001;

app.use(cors());
app.use(express.json());

// API routes
app.post('/api/extract', async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'A valid URL is required.' });
  }

  try {
    const result = await extractRecipe(url.trim());
    return res.json(result);
  } catch (err) {
    console.error('Extraction failed:', err.message);
    return res.status(500).json({ error: 'Failed to extract recipe. The platform may be blocking requests or the URL is invalid.' });
  }
});

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// Serve built React frontend in production
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
