import { GoogleGenerativeAI } from "@google/generative-ai";

export type TermSubstitution = { termEn: string; termZh: string };

export async function detectTermSubstitutions(
  aiDraft: string,
  savedContent: string
): Promise<TermSubstitution[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || aiDraft === savedContent) return [];

  const prompt = `Compare these two versions of a talk track script.
Identify any English words or phrases in Version A that were replaced with Chinese (or other non-English) equivalents in Version B.
Only include substitutions where an English word/phrase was clearly replaced by a non-English one.

Version A (AI draft):
${aiDraft}

Version B (human-edited):
${savedContent}

Return a JSON array of substitutions: [{"termEn": "client", "termZh": "老板"}, ...]
Return an empty array [] if no such substitutions are found.
Return ONLY the JSON, nothing else.`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim()
      .replace(/^```json\s*/i, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item: unknown): item is TermSubstitution =>
        typeof item === "object" && item !== null &&
        typeof (item as TermSubstitution).termEn === "string" &&
        typeof (item as TermSubstitution).termZh === "string"
    );
  } catch (e) {
    console.error("[DetectTermSubs error]", e);
    return [];
  }
}
