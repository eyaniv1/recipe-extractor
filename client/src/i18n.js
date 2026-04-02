const strings = {
  en: {
    title: 'Recipe Extractor',
    subtitle: 'Paste a video URL from YouTube, Instagram, TikTok, or Facebook to extract the recipe.',
    placeholder: 'https://www.youtube.com/watch?v=...',
    extract: 'Extract Recipe',
    extracting: 'Extracting...',
    clear: 'Clear',
    errorEmpty: 'Please paste a video URL.',
    watchVideo: 'Watch original video',
    noRecipe: 'Could not detect a structured recipe in the video description. The raw text is shown below.',
    ingredients: 'Ingredients',
    instructions: 'Instructions',
    description: 'Description',
    paste: 'Paste',
    aiParse: 'AI Parse',
    aiParsing: 'AI Parsing...',
    aiParsed: 'Parsed by AI',
    showRaw: 'Show raw extracted text',
    langToggle: 'עברית',
  },
  he: {
    title: 'מחלץ מתכונים',
    subtitle: 'הדביקו קישור לסרטון מ-YouTube, Instagram, TikTok או Facebook כדי לחלץ את המתכון.',
    placeholder: 'https://www.youtube.com/watch?v=...',
    extract: 'חלץ מתכון',
    extracting: 'מחלץ...',
    clear: 'נקה',
    errorEmpty: 'נא להדביק קישור לסרטון.',
    watchVideo: 'צפו בסרטון המקורי',
    noRecipe: 'לא זוהה מבנה מתכון בתיאור הסרטון. הטקסט הגולמי מוצג למטה.',
    ingredients: 'מצרכים',
    instructions: 'הוראות הכנה',
    description: 'תיאור',
    paste: 'הדבק',
    aiParse: 'פענוח AI',
    aiParsing: 'מפענח...',
    aiParsed: 'פוענח ע"י AI',
    showRaw: 'הצג טקסט גולמי',
    langToggle: 'English',
  },
};

export function t(lang, key) {
  return strings[lang]?.[key] || strings.en[key] || key;
}

export function isRTL(lang) {
  return lang === 'he';
}

export function detectTextDirection(text) {
  if (!text) return 'ltr';
  const hebrewChars = (text.match(/[\u0590-\u05FF]/g) || []).length;
  const latinChars = (text.match(/[a-zA-Z]/g) || []).length;
  return hebrewChars > latinChars ? 'rtl' : 'ltr';
}
