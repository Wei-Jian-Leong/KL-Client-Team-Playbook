import { GoogleGenerativeAI } from "@google/generative-ai";

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export async function generateTalkTrackDraft(
  title: string,
  content: string | null,
  language = "CN",
  corrections?: Array<{ aiDraft: string; savedContent: string }>
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return "";

  const contentText = content ? stripHtml(content).slice(0, 1500) : "(no content)";
  const langLabel = language === "CN" ? "Chinese (Simplified)" : "English";

  const correctionsBlock = corrections?.length
    ? `\nHere are examples showing what I wrote vs what the trainer preferred — write more like the "preferred" version:\n\n${corrections.map((c, i) =>
        `Correction ${i + 1}:\n  AI wrote: ${c.aiDraft.slice(0, 400)}\n  Trainer preferred: ${c.savedContent.slice(0, 400)}`
      ).join("\n\n")}\n`
    : "";

  const prompt = `You are a customer support trainer writing talk track scripts for agents.
Based on the following knowledge base article, write a concise talk track an agent can follow when explaining this topic to a client.
Write the talk track entirely in ${langLabel}. Use clear, conversational language. Format as numbered steps or bullet points. Keep it practical and direct.${correctionsBlock}
Article title: ${title}
Article content: ${contentText}

Return only the talk track script, nothing else.`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (e) {
    console.error("[TalkTrack generate error]", e);
    return "";
  }
}
