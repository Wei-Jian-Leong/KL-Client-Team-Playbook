import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";

type DraftQuestion = {
  question: string;
  type: "SELECT" | "MULTI_SELECT";
  options: string[];
  correctAnswer: string;
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export async function generateKnowledgeQuizDraft(articleId: string, title: string, content: string | null): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return;

  const plainText = content ? stripHtml(content).slice(0, 2000) : "";
  if (!plainText && !title) return;

  const prompt = `You are a quiz creator for a customer operations team knowledge base. Given a knowledge base article, generate 3-5 quiz questions to test whether a reader understood the key points.

Article title: ${title}
Content: ${plainText || "(no content — base questions on the title)"}

Return a JSON array of questions. Each question must have:
- "question": the question text
- "type": either "SELECT" (single correct answer) or "MULTI_SELECT" (multiple correct answers)
- "options": array of 3-4 option strings
- "correctAnswer": for SELECT — the matching option text; for MULTI_SELECT — a JSON array string like '["Option A","Option B"]'

Do NOT generate short answer or free-text questions. Only SELECT and MULTI_SELECT types.

Return ONLY the JSON array, no other text.`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return;

    const questions: DraftQuestion[] = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(questions) || questions.length === 0) return;

    const max = await prisma.knowledgeArticleQuiz.aggregate({ where: { articleId }, _max: { order: true } });
    let order = (max._max.order ?? -1) + 1;

    for (const q of questions.slice(0, 5)) {
      if (!q.question?.trim()) continue;
      const type = ["SELECT", "MULTI_SELECT"].includes(q.type) ? q.type : "SELECT";
      await prisma.knowledgeArticleQuiz.create({
        data: {
          articleId,
          question: q.question.trim(),
          type,
          options: q.options && q.options.length > 0 ? JSON.stringify(q.options) : null,
          correctAnswer: q.correctAnswer ?? null,
          gradingType: "EXACT",
          isDraft: true,
          order: order++,
        },
      });
    }
  } catch {
    // Best-effort — never throw
  }
}
