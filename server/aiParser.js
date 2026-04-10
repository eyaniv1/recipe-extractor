import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `You are a recipe extraction assistant. You receive raw text from a video description and must extract a structured recipe from it.

Return ONLY valid JSON with this exact structure:
{
  "title": "recipe name",
  "ingredientGroups": [
    {
      "group": "group name (e.g. for the dough, for the filling)",
      "items": ["ingredient 1", "ingredient 2", ...]
    }
  ],
  "instructions": ["step 1", "step 2", ...],
  "description": "brief description of the dish"
}

Rules:
- Extract ALL ingredients with their quantities
- Group ingredients by their purpose/sub-section (e.g. "for the dough", "for the sauce", "for the filling", "for the glaze")
- If there are no clear sub-sections, use a single group with an empty group name ""
- For EVERY measurement given by weight (grams, kg, ounces, pounds, etc.) or volume in ml/liters, add an approximate cups/spoons equivalent in parentheses. Use these common conversions:
  - Flour: 120g ≈ 1 cup
  - Sugar: 200g ≈ 1 cup
  - Butter: 227g ≈ 1 cup, 113g ≈ ½ cup, 14g ≈ 1 tbsp
  - Cocoa powder: 85g ≈ 1 cup
  - Liquids (milk/water/oil): 240ml ≈ 1 cup, 15ml ≈ 1 tbsp, 5ml ≈ 1 tsp
  - Salt: 6g ≈ 1 tsp, 18g ≈ 1 tbsp
  - 1 oz ≈ 28g, 1 lb ≈ 454g
  - For other dry ingredients, approximate 1 cup ≈ 130g
  - Use friendly fractions: ½, ⅓, ¼, ⅔, ¾ instead of decimals
  - IMPORTANT: Write conversions in natural order — quantity BEFORE unit, largest unit first. Correct: "(≈ ⅓ cup + 2 tbsp)". Wrong: "(≈ cup + 2 tbsp ⅓)".
  - When possible, simplify to a single unit instead of combining (e.g. "≈ ½ cup" instead of "≈ ⅓ cup + 2 tbsp + 2 tsp")
  Examples: "500 גרם קמח (≈ 4 cups)", "100g oil (≈ ½ cup)", "30g butter (≈ 2 tbsp)"
- Break instructions into clear numbered steps
- Keep each ingredient on its own line, preserving quantities and units
- Keep the original language of the recipe (do not translate)
- Remove hashtags, promotional text, and social media metadata
- If no recipe is found, return: {"title": "", "ingredientGroups": [], "instructions": [], "description": "No recipe found in this text."}
- Return ONLY the JSON, no markdown fencing, no explanation`;

let client = null;

function getClient() {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set. Add it to your Render environment variables.');
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

const TRANSLATE_PROMPT = `You are a recipe translator. You receive a recipe in JSON format and must translate ALL text content to Hebrew.

Return ONLY valid JSON with the exact same structure as the input. Translate:
- The title
- All ingredient group names
- All ingredient items (keep original measurements and their cup/spoon equivalents, only translate the ingredient names and group labels)
- All instruction steps
- The description

Rules:
- Preserve the JSON structure exactly
- Keep numbers, measurements, and unit abbreviations (g, kg, ml, cups, tbsp, tsp) as-is
- Translate ingredient names, group names, cooking verbs, and descriptions to Hebrew
- If text is already in Hebrew, keep it as-is
- Return ONLY the JSON, no markdown fencing, no explanation`;

export async function aiTranslateRecipe(recipe) {
  const anthropic = getClient();

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: TRANSLATE_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Translate this recipe to Hebrew:\n\n${JSON.stringify(recipe)}`,
      },
    ],
  });

  const text = response.content[0]?.text || '';

  try {
    const cleaned = text.replace(/^```json?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      title: parsed.title || '',
      ingredientGroups: Array.isArray(parsed.ingredientGroups) ? parsed.ingredientGroups : [],
      ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
      instructions: Array.isArray(parsed.instructions) ? parsed.instructions : [],
      description: parsed.description || '',
    };
  } catch {
    throw new Error('AI translation returned invalid response. Please try again.');
  }
}

export async function aiParseRecipe(rawText) {
  const anthropic = getClient();

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Extract the recipe from this video description:\n\n${rawText}`,
      },
    ],
  });

  const text = response.content[0]?.text || '';

  try {
    // Parse JSON — handle possible markdown fencing just in case
    const cleaned = text.replace(/^```json?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      title: parsed.title || '',
      ingredientGroups: Array.isArray(parsed.ingredientGroups) ? parsed.ingredientGroups : [],
      instructions: Array.isArray(parsed.instructions) ? parsed.instructions : [],
      description: parsed.description || '',
    };
  } catch {
    throw new Error('AI returned invalid response. Please try again.');
  }
}
