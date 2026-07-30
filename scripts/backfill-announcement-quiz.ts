/**
 * Backfill script: generate draft quizzes for all July 2026 announcements that don't have quizzes.
 * Run: npx tsx scripts/backfill-announcement-quiz.ts
 */

import { PrismaClient } from "@prisma/client";
import { GoogleGenerativeAI } from "@google/generative-ai";

const prisma = new PrismaClient();

async function generateQuiz(announcementId: string, title: string, content: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) { console.log("No GEMINI_API_KEY — skipping quiz generation"); return; }

  const plainText = content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 2000);

  const prompt = `You are a quiz creator for a customer operations team. Given an announcement, generate 2-4 quiz questions.

Announcement title: ${title}
Content: ${plainText || "(no content)"}

Return a JSON array of questions. Each question must have:
- "question": the question text
- "type": either "SELECT" or "MULTI_SELECT"
- "options": array of 3-4 option strings
- "correctAnswer": for SELECT — matching option text; for MULTI_SELECT — a JSON array string like '["A","B"]'

Return ONLY the JSON array, no other text.`;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
  const result = await model.generateContent(prompt);
  const text = result.response.text();

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return;

  const questions = JSON.parse(jsonMatch[0]);
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
        options: q.options?.length ? JSON.stringify(q.options) : null,
        correctAnswer: q.correctAnswer ?? null,
        gradingType: "EXACT",
        isDraft: true,
        order: i,
      },
    });
  }
}

async function main() {
  const julyStart = new Date("2026-07-01T00:00:00.000Z");

  const announcements = await prisma.announcement.findMany({
    where: { createdAt: { gte: julyStart } },
    include: { _count: { select: { quizzes: true } } },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Found ${announcements.length} July announcements`);

  let skipped = 0;
  let generated = 0;

  for (const a of announcements) {
    if (a._count.quizzes > 0) {
      console.log(`  SKIP  ${a.title} (already has ${a._count.quizzes} quiz questions)`);
      skipped++;
      continue;
    }
    console.log(`  GEN   ${a.title}…`);
    try {
      await generateQuiz(a.id, a.title, a.content);
      generated++;
      console.log(`         ✓ done`);
    } catch (err) {
      console.error(`         ✗ error: ${err}`);
    }
  }

  console.log(`\nDone. Generated: ${generated}, Skipped: ${skipped}`);
  await prisma.$disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
