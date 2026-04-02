import axios from 'axios';
import * as cheerio from 'cheerio';
import { parseRecipe } from './recipeParser.js';

const TIMEOUT = 15000;

/**
 * Given two strings (typically og:title and og:description), return
 * the longer one. If the shorter is a prefix/substring of the longer,
 * just return the longer. Otherwise concatenate without duplication.
 */
function deduplicateText(a, b) {
  if (!a) return b || '';
  if (!b) return a || '';
  const longer = a.length >= b.length ? a : b;
  const shorter = a.length >= b.length ? b : a;
  // If the shorter text (minus trailing "...") is contained in the longer, just use longer
  const trimmedShorter = shorter.replace(/\.{3}$/, '').trim();
  if (longer.includes(trimmedShorter)) return longer;
  return longer;
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

// --- Platform detection ---

function detectPlatform(url) {
  const host = new URL(url).hostname.toLowerCase();
  if (host.includes('youtube.com') || host.includes('youtu.be')) return 'youtube';
  if (host.includes('instagram.com')) return 'instagram';
  if (host.includes('tiktok.com')) return 'tiktok';
  if (host.includes('facebook.com') || host.includes('fb.watch')) return 'facebook';
  return 'other';
}

// --- YouTube ---

function getYouTubeVideoId(url) {
  const u = new URL(url);
  if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('/')[0];
  if (u.hostname.includes('youtube.com')) {
    if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2];
    return u.searchParams.get('v');
  }
  return null;
}

function getYouTubeEmbedUrl(videoId) {
  return `https://www.youtube.com/embed/${videoId}`;
}

async function extractYouTube(url) {
  const videoId = getYouTubeVideoId(url);
  if (!videoId) throw new Error('Could not parse YouTube video ID');

  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const { data: html } = await axios.get(watchUrl, { timeout: TIMEOUT, headers: HEADERS });

  // Try to get description from ytInitialPlayerResponse
  let title = '';
  let description = '';

  const playerMatch = html.match(/var ytInitialPlayerResponse\s*=\s*(\{.+?\});/s);
  if (playerMatch) {
    try {
      const player = JSON.parse(playerMatch[1]);
      title = player.videoDetails?.title || '';
      description = player.videoDetails?.shortDescription || '';
    } catch { /* fallback below */ }
  }

  // Fallback to meta tags
  if (!description) {
    const $ = cheerio.load(html);
    title = title || $('meta[name="title"]').attr('content') || $('title').text() || '';
    description = $('meta[name="description"]').attr('content') || '';
  }

  return {
    platform: 'youtube',
    videoUrl: watchUrl,
    embedUrl: getYouTubeEmbedUrl(videoId),
    title,
    rawText: description,
  };
}

// --- Instagram ---

async function extractInstagram(url) {
  // Try oEmbed first (more reliable, no auth needed)
  try {
    const oembedUrl = `https://graph.facebook.com/v18.0/instagram_oembed?url=${encodeURIComponent(url)}&access_token=IGQVJ`;
    const { data } = await axios.get(oembedUrl, { timeout: TIMEOUT });
    if (data.title) {
      return {
        platform: 'instagram',
        videoUrl: url,
        embedUrl: null,
        title: data.author_name || '',
        rawText: data.title || '',
      };
    }
  } catch { /* fall through to page scrape */ }

  // Fallback: scrape the page
  const { data: html } = await axios.get(url, {
    timeout: TIMEOUT,
    headers: { ...HEADERS, 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
  });

  const $ = cheerio.load(html);
  const title = $('meta[property="og:title"]').attr('content') || '';
  const description = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '';

  // Instagram often puts the full post text in both title and description.
  // Deduplicate and extract a short display title from the og:title.
  const longer = deduplicateText(title, description);
  const displayTitle = extractInstagramAuthor(title);

  return {
    platform: 'instagram',
    videoUrl: url,
    embedUrl: null,
    title: displayTitle,
    rawText: longer,
  };
}

function extractInstagramAuthor(ogTitle) {
  // og:title is often like "Author Name on Instagram: "full post text...""
  // Extract just the author part.
  const match = ogTitle.match(/^(.+?)\s+on Instagram/i);
  if (match) return match[1].replace(/^‎|‎$/g, '').trim();
  // Or "Author Name (@handle) • Instagram"
  const match2 = ogTitle.match(/^(.+?)\s*[•·]\s*Instagram/i);
  if (match2) return match2[1].replace(/^‎|‎$/g, '').trim();
  return ogTitle;
}

// --- TikTok ---

async function extractTikTok(url) {
  // TikTok oEmbed is public and reliable
  try {
    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
    const { data } = await axios.get(oembedUrl, { timeout: TIMEOUT });
    return {
      platform: 'tiktok',
      videoUrl: url,
      embedUrl: null,
      title: data.author_name || '',
      rawText: data.title || '',
    };
  } catch { /* fall through */ }

  // Fallback: scrape page
  const { data: html } = await axios.get(url, { timeout: TIMEOUT, headers: HEADERS });
  const $ = cheerio.load(html);
  const title = $('meta[property="og:title"]').attr('content') || '';
  const description = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '';

  return {
    platform: 'tiktok',
    videoUrl: url,
    embedUrl: null,
    title,
    rawText: `${title}\n${description}`,
  };
}

// --- Facebook ---

async function extractFacebook(url) {
  const { data: html } = await axios.get(url, {
    timeout: TIMEOUT,
    headers: { ...HEADERS, 'User-Agent': 'facebookexternalhit/1.1' },
  });

  const $ = cheerio.load(html);
  const title = $('meta[property="og:title"]').attr('content') || '';
  const description = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '';

  // Facebook often duplicates: title has the full text, description has a truncated copy.
  // Use the longer one and deduplicate.
  const rawText = deduplicateText(title, description);
  const displayTitle = extractFacebookAuthor(title);

  return {
    platform: 'facebook',
    videoUrl: url,
    embedUrl: null,
    title: displayTitle,
    rawText,
  };
}

function extractFacebookAuthor(ogTitle) {
  // og:title often ends with "| Author Name" or "| Author Name | Page Name"
  const pipeMatch = ogTitle.match(/\|\s*([^|]+?)\s*$/);
  if (pipeMatch) return pipeMatch[1].trim();
  return '';
}

// --- Generic ---

async function extractGeneric(url) {
  const { data: html } = await axios.get(url, { timeout: TIMEOUT, headers: HEADERS });
  const $ = cheerio.load(html);

  const title = $('meta[property="og:title"]').attr('content') || $('title').text() || '';
  const description = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '';

  // Try to find JSON-LD Recipe schema
  let recipeText = '';
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html());
      const recipes = Array.isArray(json) ? json : [json];
      for (const item of recipes) {
        if (item['@type'] === 'Recipe') {
          const ingredients = (item.recipeIngredient || []).join('\n');
          const instructions = (item.recipeInstructions || [])
            .map(s => typeof s === 'string' ? s : s.text || '')
            .join('\n');
          recipeText = `Ingredients:\n${ingredients}\n\nInstructions:\n${instructions}`;
        }
      }
    } catch { /* skip invalid json-ld */ }
  });

  return {
    platform: 'other',
    videoUrl: url,
    embedUrl: null,
    title,
    rawText: recipeText || `${title}\n${description}`,
  };
}

// --- Main export ---

export async function extractRecipe(url) {
  // Validate URL
  let parsed;
  try { parsed = new URL(url); } catch {
    throw new Error('Invalid URL');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('URL must use http or https');
  }

  const platform = detectPlatform(url);

  let raw;
  switch (platform) {
    case 'youtube':   raw = await extractYouTube(url); break;
    case 'instagram': raw = await extractInstagram(url); break;
    case 'tiktok':    raw = await extractTikTok(url); break;
    case 'facebook':  raw = await extractFacebook(url); break;
    default:          raw = await extractGeneric(url); break;
  }

  const recipe = parseRecipe(raw.rawText);

  return {
    ...raw,
    recipe,
    hasRecipe: recipe !== null,
  };
}
