/**
 * Parse raw text (typically a video description) and split it into
 * ingredients and instructions/description.
 * Supports English and Hebrew.
 */
export function parseRecipe(text) {
  if (!text || text.trim().length < 10) return null;

  const raw = text.replace(/\r/g, '');
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);

  const ingredients = [];
  const instructions = [];
  const description = [];
  let section = 'auto'; // auto | ingredients | instructions | description

  for (const line of lines) {
    // Detect section headers (English)
    if (/^#{0,3}\s*ingredients?\s*[:\-]?\s*$/i.test(line)) {
      section = 'ingredients';
      continue;
    }
    if (/^#{0,3}\s*(steps?|directions?|method|instructions?|preparation|how to make)\s*[:\-]?\s*$/i.test(line)) {
      section = 'instructions';
      continue;
    }
    if (/^#{0,3}\s*(description|about|notes?|intro)\s*[:\-]?\s*$/i.test(line)) {
      section = 'description';
      continue;
    }

    // Detect section headers (Hebrew)
    if (/^#{0,3}\s*(מצרכים|חומרים|רכיבים)\s*[:\-]?\s*$/i.test(line)) {
      section = 'ingredients';
      continue;
    }
    if (/^#{0,3}\s*(הוראות הכנה|הוראות|אופן ההכנה|אופן הכנה|הכנה|שלבים|שלבי הכנה)\s*[:\-]?\s*$/i.test(line)) {
      section = 'instructions';
      continue;
    }
    if (/^#{0,3}\s*(תיאור|הערות|הקדמה|על המתכון)\s*[:\-]?\s*$/i.test(line)) {
      section = 'description';
      continue;
    }

    // In explicit sections, collect directly
    if (section === 'ingredients') {
      const cleaned = line.replace(/^[-•*\u2022\u2023\u25E6]\s*/, '').trim();
      if (cleaned.length > 1) ingredients.push(cleaned);
      continue;
    }
    if (section === 'instructions') {
      const cleaned = line.replace(/^\d+[.)]\s*/, '').trim();
      if (cleaned.length > 1) instructions.push(cleaned);
      continue;
    }
    if (section === 'description') {
      description.push(line);
      continue;
    }

    // Auto-detect mode: try to classify each line
    // English measurements
    const enMeasure = /\b(\d+\/?\d*\s*)(cups?|tbsps?|tablespoons?|tsps?|teaspoons?|grams?|g\b|ml\b|liters?|oz|ounces?|pounds?|lbs?|kg|pinch|dash|handful|cloves?|slices?|pieces?|bunch|sprigs?|cans?|packets?|sticks?)\b/i;
    // Hebrew measurements
    const heMeasure = /(\d+\/?\d*\s*)(כוסות|כוס|כפות|כף|כפיות|כפית|גרם|מ"ל|ליטר|קילו|ק"ג|חבילה|חבילות|יחידה|יחידות|שיניים|שן|פרוסות|פרוסה|קורט|חופן|צרור|ענפים|ענף|שקיות|שקית)\b/;
    const ingredientItemPattern = /^[-•*\u2022]\s+.+/;

    if (enMeasure.test(line) || heMeasure.test(line) || ingredientItemPattern.test(line)) {
      const cleaned = line.replace(/^[-•*\u2022\u2023\u25E6]\s*/, '').trim();
      if (cleaned.length > 1) ingredients.push(cleaned);
      continue;
    }

    const stepPattern = /^\d+[.)]\s+/;
    // English action verbs
    const enAction = /\b(preheat|mix|stir|whisk|bake|cook|boil|simmer|fry|saut[ée]|chop|dice|mince|slice|fold|knead|marinate|season|garnish|serve|combine|pour|spread|heat|roast|grill|blend|drain|rinse|set aside|let it|remove from|place in|transfer)\b/i;
    // Hebrew action verbs
    const heAction = /\b(לחמם|לערבב|לבחוש|להקציף|לאפות|לבשל|להרתיח|לטגן|לקצוץ|לחתוך|לפרוס|לקפל|ללוש|להשרות|לתבל|לקשט|להגיש|לשפוך|למרוח|לחמם|לצלות|לטחון|לסנן|לשטוף|להוסיף|להניח|להעביר|מערבבים|מוסיפים|שמים|מחממים|אופים|מבשלים|מטגנים|חותכים|מקציפים|מגישים|שופכים|מערבבים|טוחנים|מורחים)\b/;

    if (stepPattern.test(line) || enAction.test(line) || heAction.test(line)) {
      const cleaned = line.replace(/^\d+[.)]\s*/, '').trim();
      if (cleaned.length > 1) instructions.push(cleaned);
      continue;
    }

    // Anything else goes to description
    description.push(line);
  }

  if (ingredients.length === 0 && instructions.length === 0 && description.length === 0) {
    return null;
  }

  return {
    ingredients: [...new Set(ingredients)].slice(0, 80),
    instructions: instructions.slice(0, 60),
    description: description.join('\n').trim(),
  };
}
