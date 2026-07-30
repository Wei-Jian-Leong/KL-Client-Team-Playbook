import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

type DraftQuestion = {
  question: string;
  type: "SHORT_ANSWER" | "SELECT" | "MULTI_SELECT";
  options: string[] | null;
  correctAnswer: string | null;
  gradingType: "NONE" | "EXACT" | "REFERENCE";
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export async function generateQuizDraft(topicId: string, title: string, content: string | null): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return;

  const plainText = content ? stripHtml(content).slice(0, 2000) : "";
  if (!plainText && !title) return;

  const prompt = `You are a training quiz creator. Given a training topic, generate 3-5 quiz questions to test a reader's understanding.

Topic: ${title}
Content: ${plainText || "(no content provided — base questions on the topic title)"}

Return a JSON array of questions. Each question must have:
- "question": the question text
- "type": one of "SHORT_ANSWER", "SELECT", or "MULTI_SELECT"
- "options": array of option strings for SELECT/MULTI_SELECT, null for SHORT_ANSWER
- "correctAnswer": the correct answer string (for SELECT: matching option text; for MULTI_SELECT: JSON array string like '["A","B"]'; for SHORT_ANSWER: a model answer)
- "gradingType": "EXACT" for SELECT/MULTI_SELECT, "REFERENCE" for SHORT_ANSWER

Return ONLY the JSON array, no other text.`;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0]?.type === "text" ? message.content[0].text : "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return;

    const questions: DraftQuestion[] = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(questions) || questions.length === 0) return;

    const max = await prisma.topicQuestion.aggregate({ where: { topicId }, _max: { order: true } });
    let order = (max._max.order ?? -1) + 1;

    for (const q of questions.slice(0, 5)) {
      if (!q.question?.trim()) continue;
      await prisma.topicQuestion.create({
        data: {
          topicId,
          question: q.question.trim(),
          type: ["SHORT_ANSWER", "SELECT", "MULTI_SELECT"].includes(q.type) ? q.type : "SHORT_ANSWER",
          options: q.options && q.options.length > 0 ? JSON.stringify(q.options) : null,
          correctAnswer: q.correctAnswer ?? null,
          gradingType: ["NONE", "EXACT", "REFERENCE"].includes(q.gradingType) ? q.gradingType : "NONE",
          isRequired: false,
          isDraft: true,
          order: order++,
        },
      });
    }
  } catch {
    // Quiz generation is best-effort — never throw
  }
}
