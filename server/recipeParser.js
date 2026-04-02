export function parseRecipe(text) {
  if (!text) return null;

  const raw = text.replace(/\r/g, '');
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);

  const ingredients = [];
  const steps = [];
  let mode = 'auto';

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (/^ingredients?[:\s]*$/i.test(line) || /ingredients?\s*[-:]/i.test(lower)) {
      mode = 'ingredients';
      continue;
    }
    if (/^(steps?|directions?|method|instructions)[:\s]*$/i.test(line) || /steps?\s*[-:]/i.test(lower)) {
      mode = 'steps';
      continue;
    }

    if (mode === 'ingredients' || (mode === 'auto' && /\b(cups?|tbsp|tsp|grams?|ml|pinch|kg|oz|pound|cup)\b/i.test(line))) {
      const candidate = line.replace(/^[-•\d.\s]+/, '');
      if (candidate.length > 1) ingredients.push(candidate);
      if (mode === 'auto') continue;
    }
    if (mode === 'steps' || (mode === 'auto' && /\b(mix|bake|stir|cook|add|combine|preheat|serve)\b/i.test(line))) {
      const candidate = line.replace(/^\d+[.)]?\s*/, '');
      if (candidate.length > 1) steps.push(candidate);
      if (mode === 'auto') continue;
    }
  }

  if (ingredients.length === 0 && steps.length === 0) {
    return null;
  }

  return {
    ingredients: [...new Set(ingredients)].slice(0, 60),
    steps: steps.slice(0, 80)
  };
}
