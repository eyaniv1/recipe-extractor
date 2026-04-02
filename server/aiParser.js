import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `You are a recipe extraction assistant. You receive raw text from a video description and must extract a structured recipe from it.

Return ONLY valid JSON with this exact structure:
{
  "title": "recipe name",
  "ingredients": ["ingredient 1", "ingredient 2", ...],
  "instructions": ["step 1", "step 2", ...],
  "description": "brief description of the dish"
}

Rules:
- Extract ALL ingredients with their quantities
- Break instructions into clear numbered steps
- Keep each ingredient on its own line, preserving quantities and units
- Keep the original language of the recipe (do not translate)
- If the text contains sub-sections of ingredients (e.g. "for the sauce:", "for the dough:"), prefix each ingredient with the sub-section name
- Remove hashtags, promotional text, and social media metadata
- If no recipe is found, return: {"title": "", "ingredients": [], "instructions": [], "description": "No recipe found in this text."}
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
      ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
      instructions: Array.isArray(parsed.instructions) ? parsed.instructions : [],
      description: parsed.description || '',
    };
  } catch {
    throw new Error('AI returned invalid response. Please try again.');
  }
}
