export function repairJSON(raw: string): string {
  let text = raw.trim();

  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/, '');
  text = text.trim();

  // If it already parses, return as-is
  try {
    JSON.parse(text);
    return text;
  } catch {
    // continue to repair
  }

  // Try closing truncated JSON by balancing braces/brackets
  let braces = 0;
  let brackets = 0;
  let inString = false;
  let escape = false;

  for (const ch of text) {
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') braces++;
    if (ch === '}') braces--;
    if (ch === '[') brackets++;
    if (ch === ']') brackets--;
  }

  // Remove trailing incomplete key/value (e.g. `"key": "trunc` or `, "key`)
  if (inString) {
    text += '"';
  }

  // Remove trailing comma before we close
  text = text.replace(/,\s*$/, '');

  // Close open brackets/braces
  while (brackets > 0) { text += ']'; brackets--; }
  while (braces > 0) { text += '}'; braces--; }

  return text;
}
