/** Turn Gemini HTTP errors into actionable messages */
export function geminiErrorMessage(status: number, body: string): string {
  const lower = body.toLowerCase();
  if (
    status === 403 &&
    (lower.includes("api_key_service_blocked") || lower.includes("blocked"))
  ) {
    return (
      "Gemini API is blocked for this key (403 API_KEY_SERVICE_BLOCKED). " +
      "Create a new key at https://aistudio.google.com/apikey (Google AI Studio, not only Cloud Console). " +
      "In Google Cloud Console → APIs & Services → Enabled APIs, enable \"Generative Language API\". " +
      "Remove API key restrictions that exclude generativelanguage.googleapis.com. " +
      "Lyria music may require access on a paid/billing-enabled project — check https://ai.google.dev/gemini-api/docs/music-generation"
    );
  }
  if (status === 403) {
    return `Gemini permission denied (403). Check billing and API access on your Google AI project. ${body.slice(0, 200)}`;
  }
  if (status === 429) {
    return `Gemini rate limit (429). Wait and retry, or check quota. ${body.slice(0, 200)}`;
  }
  return `Gemini API error: ${status} ${body.slice(0, 400)}`;
}
