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

export async function generateAnnouncementQuizDraft(announcementId: string, title: string, content: string): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return;

  const plainText = stripHtml(content).slice(0, 2000);
  if (!plainText && !title) return;

  const prompt = `You are a quiz creator for a customer operations team. Given an announcement or update, generate 2-4 quiz questions to check that the reader understood the key points.

Announcement title: ${title}
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

    for (let i = 0; i < Math.min(questions.length, 4); i++) {
      const q = questions[i];
      if (!q.question?.trim()) continue;
      const type = ["SELECT", "MULTI_SELECT"].includes(q.type) ? q.type : "SELECT";
      await prisma.announcementQuiz.create({
        data: {
          announcementId,
          question: q.question.trim(),
          type,
          options: q.options && q.options.length > 0 ? JSON.stringify(q.options) : null,
          correctAnswer: q.correctAnswer ?? null,
          gradingType: "EXACT",
          isDraft: true,
          order: i,
        },
      });
    }
  } catch {
    // Best-effort — never throw
  }
}
