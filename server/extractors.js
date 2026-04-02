import axios from 'axios';
const cheerio = (await import('cheerio')).default;

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    return u.href;
  } catch (err) {
    return null;
  }
}

export async function extractFromYouTube(url, apiKey) {
  const videoId = extractYoutubeId(url);
  if (!videoId) return { error: 'Cannot parse YouTube video ID' };

  if (apiKey) {
    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`;
    const response = await axios.get(apiUrl, { timeout: 10000 });
    const item = response.data.items?.[0];
    if (item?.snippet) {
      const desc = item.snippet.description || '';
      const title = item.snippet.title || '';
      return { title, description: desc, source: 'youtube', rawText: `${title}\n${desc}` };
    }
  }

  // fallback retrieval from public watch page
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const html = (await axios.get(watchUrl, { timeout: 10000 })).data;
  const match = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
  const desc = match?.[1] ? decodeHtml(match[1]) : '';
  return { title: '', description: desc, source: 'youtube', rawText: desc };
}

function decodeHtml(value) {
  return value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

export async function extractFromInstagram(url) {
  const pageUrl = normalizeUrl(url);
  if (!pageUrl) return { error: 'Invalid URL' };

  const response = await axios.get(pageUrl, {
    timeout: 10000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Mobile; rv:109.0) Gecko/20100101 Firefox/109.0'
    }
  });

  const $ = cheerio.load(response.data);
  const ogDesc = $('meta[property="og:description"]').attr('content') || '';
  const title = $('meta[property="og:title"]').attr('content') || '';

  return { title, description: ogDesc, source: 'instagram', rawText: `${title}\n${ogDesc}` };
}

export async function extractFromFacebook(url) {
  const pageUrl = normalizeUrl(url);
  if (!pageUrl) return { error: 'Invalid URL' };

  const response = await axios.get(pageUrl, {
    timeout: 10000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Mobile; rv:109.0) Gecko/20100101 Firefox/109.0'
    }
  });

  const $ = cheerio.load(response.data);
  const ogDesc = $('meta[property="og:description"]').attr('content') || '';
  const title = $('meta[property="og:title"]').attr('content') || '';

  return { title, description: ogDesc, source: 'facebook', rawText: `${title}\n${ogDesc}` };
}

function extractYoutubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1);
    if (u.hostname.includes('youtube.com')) return u.searchParams.get('v');
  } catch {
    return null;
  }
  return null;
}
