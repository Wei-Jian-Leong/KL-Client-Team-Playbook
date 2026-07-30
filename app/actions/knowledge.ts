"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { unlink } from "fs/promises";
import path from "path";
import { generateKnowledgeQuizDraft } from "@/lib/generate-knowledge-quiz";
import { translateArticleToZh, type GlossaryTerm, type TranslationExample } from "@/lib/translate-article";
import { pushGlossaryToSheet, pushTranslationMemoryToSheet, pushTalkTrackMemoryToSheet, isGlossarySheetConfigured } from "@/lib/gsheets";
import { generateTalkTrackDraft } from "@/lib/generate-talk-track";
import { detectTermSubstitutions, type TermSubstitution } from "@/lib/detect-term-substitutions";

async function requireAdmin() {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");
  const user = await prisma.user.findUnique({ where: { id: session.id }, select: { isAdmin: true } });
  if (!user?.isAdmin) throw new Error("Admin only");
}

// Parse "M/D/YYYY" or "MM/DD/YYYY" → Date (midnight UTC)
function parseArticleDate(s: string): Date {
  const [m, d, y] = s.split("/").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

// Re-assign articleNo to every article sorted by date asc, createdAt asc.
// Two-phase: clear all first to avoid SQLite unique constraint conflicts mid-update.
async function renumberArticles() {
  const all = await prisma.knowledgeArticle.findMany({
    select: { id: true, date: true, createdAt: true },
  });

  all.sort((a, b) => {
    const da = parseArticleDate(a.date).getTime();
    const db = parseArticleDate(b.date).getTime();
    if (da !== db) return da - db;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  // Phase 1: clear all numbers (avoids unique conflicts during phase 2)
  await prisma.$transaction(
    all.map(a => prisma.knowledgeArticle.update({ where: { id: a.id }, data: { articleNo: null } }))
  );
  // Phase 2: assign new numbers in chronological order
  await prisma.$transaction(
    all.map((a, i) =>
      prisma.knowledgeArticle.update({ where: { id: a.id }, data: { articleNo: i + 1 } })
    )
  );
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

async function checkArticleConflict(
  newTitle: string,
  newContent: string,
  excludeId?: string
): Promise<{ conflict: boolean; matches: { id: string; title: string }[]; error?: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { conflict: false, matches: [], error: "No Gemini API key configured" };
  try {
    const existing = await prisma.knowledgeArticle.findMany({
      where: { isArchived: false, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true, title: true, content: true },
    });
    if (existing.length === 0) return { conflict: false, matches: [] };

    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    const newSnippet = stripHtml(newContent).slice(0, 300);
    const existingList = existing.map((a, i) => {
      const snippet = a.content ? stripHtml(a.content).slice(0, 200) : "";
      return `${i + 1}. Title: "${a.title}"\n   Content: "${snippet}"`;
    }).join("\n");

    const prompt = `You are checking if a new knowledge base article duplicates or conflicts with an existing one.

New article:
Title: "${newTitle}"
Content: "${newSnippet}"

Existing articles:
${existingList}

Return a JSON object: { "conflict": boolean, "matches": string[] }
- conflict: true if any existing article clearly covers the same process or topic as the new one (based on title AND content)
- matches: the titles of conflicting articles (empty array if none)
Return ONLY the JSON, nothing else.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim().replace(/^```json\s*/i, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(text);
    const titleToId = Object.fromEntries(existing.map(a => [a.title, a.id]));
    const matchTitles: string[] = Array.isArray(parsed.matches) ? parsed.matches : [];
    const matches = matchTitles
      .map(t => ({ id: titleToId[t] ?? "", title: t }))
      .filter(m => m.id);
    return { conflict: !!parsed.conflict, matches };
  } catch (e: unknown) {
    return { conflict: false, matches: [], error: e instanceof Error ? e.message : "AI check failed" };
  }
}

export async function createKnowledgeArticle(data: {
  title: string;
  category: string;
  date: string;
  content?: string;
  altLink?: string;
  slackLink?: string;
  force?: boolean;
}) {
  try {
    await requireAdmin();
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Error" };
  }

  if (!data.force) {
    const check = await checkArticleConflict(data.title, data.content ?? "");
    if (check.error && !check.conflict) return { checkError: check.error };
    if (check.conflict) return { conflict: true, matches: check.matches };
  }

  // Create with a temporary articleNo; renumber will fix it
  const article = await prisma.knowledgeArticle.create({
    data: {
      title: data.title,
      category: data.category,
      date: data.date,
      content: data.content || null,
      altLink: data.altLink || null,
      slackLink: data.slackLink || null,
      articleNo: null,
      isDraft: true,
    },
  });

  await renumberArticles();

  // Auto-translate to Chinese — fire-and-forget, never awaited
  getTranslationContext()
    .then(ctx => translateArticleToZh(data.title, data.content || null, ctx))
    .then(({ titleZh, contentZh }) =>
      prisma.knowledgeArticle.update({ where: { id: article.id }, data: { titleZh, contentZh, aiTitleZh: titleZh, aiContentZh: contentZh, zhDraft: true } })
    )
    .catch(() => {});

  revalidatePath("/knowledge");
  revalidatePath("/admin");
  return { success: true, id: article.id };
}

export async function publishKnowledgeArticle(id: string, suppress = false) {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };
  const dbUser = await prisma.user.findUnique({ where: { id: session.id }, select: { isAdmin: true } });
  if (!dbUser?.isAdmin) return { error: "Admin only" };

  const [article, users] = await Promise.all([
    prisma.knowledgeArticle.update({ where: { id }, data: { isDraft: false }, select: { title: true, content: true, files: true } }),
    prisma.user.findMany({ where: { id: { not: session.id } }, select: { id: true } }),
  ]);

  if (!suppress && users.length > 0) {
    await prisma.notification.createMany({
      data: users.map(u => ({
        userId: u.id,
        title: `New article: ${article.title}`,
        content: "A new knowledge base article has been published.",
        link: "/knowledge",
      })),
    });
  }

  if (!suppress && process.env.SLACK_BOT_TOKEN) {
    const appUrl = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
    const isLocalhost = appUrl.includes("localhost") || appUrl.includes("127.0.0.1");
    const html = article.content ?? "";

    // Convert HTML to Slack mrkdwn — preserves wording and structure exactly
    const rawText = html
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, "*$1*")
      .replace(/<b[^>]*>(.*?)<\/b>/gi, "*$1*")
      .replace(/<em[^>]*>(.*?)<\/em>/gi, "_$1_")
      .replace(/<i[^>]*>(.*?)<\/i>/gi, "_$1_")
      .replace(/<li[^>]*>/gi, "\n• ")
      .replace(/<\/li>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/?(h[1-6]|p|ul|ol|div|blockquote)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, 2800);
    const preview = rawText.length === 2800 ? rawText + "…" : rawText;

    // Extract inline uploaded image/video srcs (skip base64)
    const imgSrcs = [...html.matchAll(/src="(\/knowledge-files\/[^"]+\.(?:jpg|jpeg|png|gif|webp|svg))"/gi)].map(m => m[1]);
    const videoSrcs = [...html.matchAll(/src="(\/knowledge-files\/[^"]+\.(?:mp4|mov|webm|avi))"/gi)].map(m => m[1]);

    const msgLines = [
      `:pushpin:[New | KB] *${article.title}*`,
    ];
    if (preview) msgLines.push("", preview);
    msgLines.push("", "*Action Required* :+1:", "Please acknowledge this update by reacting to this post so we know you've read it. Thanks!");
    const msgText = msgLines.join("\n");

    const blocks: object[] = [
      { type: "section", text: { type: "mrkdwn", text: msgText } },
    ];

    // Images and videos require a public URL — skip on localhost
    if (!isLocalhost) {
      for (const src of imgSrcs) {
        blocks.push({ type: "image", image_url: `${appUrl}${src}`, alt_text: "Article image" });
      }
      if (videoSrcs.length > 0) {
        blocks.push({
          type: "section",
          text: { type: "mrkdwn", text: videoSrcs.map(s => `🎬 ${appUrl}${s}`).join("\n") },
        });
      }
    }

    try {
      const slackRes = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channel: "C0A0XFL3074",
          text: msgText,
          blocks,
          mrkdwn: true,
        }),
      });
      const slackJson = await slackRes.json();
      console.log("[Slack]", JSON.stringify(slackJson));
      if (slackJson?.ok && slackJson.ts) {
        const plRes = await fetch(
          `https://slack.com/api/chat.getPermalink?channel=C0A0XFL3074&message_ts=${encodeURIComponent(slackJson.ts)}`,
          { headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` } }
        );
        const plJson = await plRes.json();
        await prisma.knowledgeArticle.update({
          where: { id },
          data: {
            slackMessageTs: slackJson.ts,
            slackLink: plJson?.permalink ?? null,
          },
        });
      }
    } catch (e) { console.error("[Slack error]", e); }
  }

  revalidatePath("/knowledge");
  return { success: true };
}

export async function markArticleRead(articleId: string) {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };
  await prisma.articleRead.upsert({
    where: { userId_articleId: { userId: session.id, articleId } },
    create: { userId: session.id, articleId },
    update: {},
  });
  revalidatePath("/knowledge");
  return { success: true };
}

export async function toggleKnowledgeArchive(id: string, archive: boolean) {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };
  const user = await prisma.user.findUnique({ where: { id: session.id }, select: { isAdmin: true } });
  if (!user?.isAdmin) return { error: "Admin only" };

  await prisma.knowledgeArticle.update({
    where: { id },
    data: { isArchived: archive, archivedAt: archive ? new Date() : null },
  });

  revalidatePath("/knowledge");
  revalidatePath("/admin");
  return { success: true };
}

export async function updateKnowledgeArticle(
  id: string,
  data: {
    title?: string;
    category?: string;
    date?: string;
    content?: string;
    altLink?: string | null;
    slackLink?: string | null;
    isArchived?: boolean;
    changeNotes?: string;
    force?: boolean;
    suppress?: boolean;
  }
) {
  try {
    await requireAdmin();
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Error" };
  }

  // Read current state before update (needed for Slack thread reply check)
  const existing = await prisma.knowledgeArticle.findUnique({
    where: { id },
    select: { isDraft: true, slackMessageTs: true, title: true, changeNotes: true, updateHistory: true },
  });

  if (!data.force && (data.title || data.content)) {
    const check = await checkArticleConflict(data.title ?? "", data.content ?? "", id);
    if (check.error && !check.conflict) return { checkError: check.error };
    if (check.conflict) return { conflict: true, matches: check.matches };
  }

  const { force, changeNotes, suppress, slackLink, ...rest } = data;
  const today = new Date().toISOString().slice(0, 10);
  const historyRaw = existing ? (existing as any).updateHistory ?? "[]" : "[]";
  let history: string[] = [];
  try { history = JSON.parse(historyRaw); } catch { history = []; }
  if (!history.includes(today)) history.push(today);

  // Accumulate changeNotes as a JSON log [{date, text}] — append/merge per day
  let log: { date: string; text: string }[] = [];
  const rawNotes = existing?.changeNotes;
  if (rawNotes) {
    try {
      const p = JSON.parse(rawNotes);
      log = Array.isArray(p) ? p : [{ date: "legacy", text: rawNotes }];
    } catch { log = [{ date: "legacy", text: rawNotes }]; }
  }
  if (changeNotes) {
    const idx = log.findIndex(e => e.date === today);
    if (idx >= 0) log[idx].text = changeNotes;
    else log.push({ date: today, text: changeNotes });
  }
  const newChangeNotes = log.length > 0 ? JSON.stringify(log) : (rawNotes ?? null);

  await prisma.knowledgeArticle.update({
    where: { id },
    data: { ...rest, changeNotes: newChangeNotes, updatedAt: new Date(), updateHistory: JSON.stringify(history), ...(slackLink !== undefined ? { slackLink: slackLink || null } : {}) },
  });

  // Only renumber if the date changed
  if (data.date !== undefined) {
    await renumberArticles();
  }

  // Notify Slack when a published article is updated
  if (!suppress && process.env.SLACK_BOT_TOKEN && !existing?.isDraft) {
    const updateLines = [
      `:pushpin:[Update | KB] *${existing?.title ?? ""}*`,
    ];
    const notes = changeNotes ?? existing?.changeNotes;
    if (notes) updateLines.push("", `📝 *What changed:*\n${notes}`);
    updateLines.push("", "*Action Required* :+1:", "Please acknowledge this update by reacting to this post so we know you've read it. Thanks!");
    const updateText = updateLines.join("\n");
    const msgBody: Record<string, unknown> = {
      channel: "C0A0XFL3074",
      text: updateText,
      blocks: [{ type: "section", text: { type: "mrkdwn", text: updateText } }],
      mrkdwn: true,
    };
    if (existing?.slackMessageTs) msgBody.thread_ts = existing.slackMessageTs;
    try {
      const r = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify(msgBody),
      });
      const j = await r.json();
      console.log("[Slack update]", JSON.stringify(j));
    } catch (e) {
      console.error("[Slack update error]", e);
    }
  }

  revalidatePath("/knowledge");
  revalidatePath("/admin");
  return { success: true };
}

export async function triggerKnowledgeQuizDraft(articleId: string) {
  try { await requireAdmin(); } catch (e: unknown) { return { error: e instanceof Error ? e.message : "Error" }; }
  const article = await prisma.knowledgeArticle.findUnique({ where: { id: articleId }, select: { title: true, content: true } });
  if (!article) return { error: "Article not found" };
  await prisma.knowledgeArticleQuiz.deleteMany({ where: { articleId, isDraft: true } });
  await generateKnowledgeQuizDraft(articleId, article.title, article.content ?? null);
  revalidatePath("/knowledge");
  return { success: true };
}

export async function addKnowledgeQuizQuestion(
  articleId: string,
  data: { question: string; type: string; options: string[]; correctAnswer: string }
) {
  try { await requireAdmin(); } catch (e: unknown) { return { error: e instanceof Error ? e.message : "Error" }; }
  const created = await prisma.knowledgeArticleQuiz.create({
    data: {
      articleId,
      question: data.question,
      type: data.type,
      options: JSON.stringify(data.options.filter(Boolean)),
      correctAnswer: data.correctAnswer,
      isDraft: true,
      order: await prisma.knowledgeArticleQuiz.count({ where: { articleId } }),
    },
  });
  revalidatePath("/knowledge");
  return { success: true, id: created.id };
}

export async function approveKnowledgeQuizQuestion(questionId: string) {
  try { await requireAdmin(); } catch (e: unknown) { return { error: e instanceof Error ? e.message : "Error" }; }
  await prisma.knowledgeArticleQuiz.update({ where: { id: questionId }, data: { isDraft: false } });
  revalidatePath("/knowledge");
  return { success: true };
}

export async function deleteKnowledgeQuizQuestion(questionId: string) {
  try { await requireAdmin(); } catch (e: unknown) { return { error: e instanceof Error ? e.message : "Error" }; }
  await prisma.knowledgeArticleQuiz.delete({ where: { id: questionId } });
  revalidatePath("/knowledge");
  return { success: true };
}

export async function updateKnowledgeQuizQuestion(
  questionId: string,
  data: { question?: string; type?: string; options?: string | null; correctAnswer?: string | null }
) {
  try { await requireAdmin(); } catch (e: unknown) { return { error: e instanceof Error ? e.message : "Error" }; }
  await prisma.knowledgeArticleQuiz.update({ where: { id: questionId }, data });
  revalidatePath("/knowledge");
  return { success: true };
}

export async function submitQuizAttempt(articleId: string, answers: { questionId: string; answer: string }[]) {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const questions = await prisma.knowledgeArticleQuiz.findMany({
    where: { articleId, isDraft: false },
    select: { id: true, type: true, correctAnswer: true },
  });

  const results: { questionId: string; isCorrect: boolean }[] = [];
  let score = 0;
  for (const q of questions) {
    const userAnswer = answers.find(a => a.questionId === q.id)?.answer ?? "";
    let isCorrect = false;
    if (q.correctAnswer) {
      if (q.type === "MULTI_SELECT") {
        try {
          const correct = JSON.parse(q.correctAnswer) as string[];
          const given = JSON.parse(userAnswer) as string[];
          const correctSet = new Set(correct);
          const givenSet = new Set(given);
          isCorrect = correctSet.size === givenSet.size && [...correctSet].every(v => givenSet.has(v));
        } catch { /* skip */ }
      } else {
        isCorrect = userAnswer === q.correctAnswer;
      }
    }
    if (isCorrect) score++;
    results.push({ questionId: q.id, isCorrect });
  }

  await prisma.knowledgeQuizAttempt.upsert({
    where: { userId_articleId: { userId: session.id, articleId } },
    create: { userId: session.id, articleId, score, total: questions.length },
    update: { score, total: questions.length, completedAt: new Date() },
  });

  if (score === questions.length) {
    await prisma.articleRead.upsert({
      where: { userId_articleId: { userId: session.id, articleId } },
      create: { userId: session.id, articleId },
      update: {},
    });
  }

  revalidatePath("/knowledge");
  return { success: true, score, total: questions.length, results };
}

export async function getQuizCompletionList() {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };
  const user = await prisma.user.findUnique({ where: { id: session.id }, select: { isAdmin: true } });
  if (!user?.isAdmin) return { error: "Admin only" };

  const attempts = await prisma.knowledgeQuizAttempt.findMany({
    orderBy: { completedAt: "desc" },
    include: {
      user: { select: { id: true, name: true, position: true } },
      article: { select: { id: true, title: true, articleNo: true } },
    },
  });

  return { success: true, attempts };
}

export async function deleteKnowledgeFile(articleId: string, fileId: string) {
  try {
    await requireAdmin();
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Error" };
  }

  const article = await prisma.knowledgeArticle.findUnique({ where: { id: articleId }, select: { files: true } });
  if (!article) return { error: "Not found" };

  let files: { id: string; name: string; mimeType: string }[] = [];
  try { files = JSON.parse(article.files ?? "[]"); } catch { /* ignore */ }

  const file = files.find(f => f.id === fileId);
  const updated = files.filter(f => f.id !== fileId);

  if (file) {
    const ext = file.mimeType === "video/mp4" ? "mp4" : file.mimeType === "video/quicktime" ? "mov" : file.mimeType.split("/")[1] ?? "png";
    const filePath = path.join(process.cwd(), "public", "knowledge-files", `${fileId}.${ext}`);
    try { await unlink(filePath); } catch { /* file may not exist on disk */ }
  }

  await prisma.knowledgeArticle.update({
    where: { id: articleId },
    data: { files: updated.length ? JSON.stringify(updated) : null },
  });

  revalidatePath("/knowledge");
  return { success: true };
}

export async function addArticleFAQ(articleId: string, question: string, answer: string) {
  await requireAdmin();
  const count = await prisma.articleFAQ.count({ where: { articleId } });
  await prisma.articleFAQ.create({ data: { articleId, question, answer, order: count } });
  revalidatePath("/knowledge");
}

export async function updateArticleFAQ(id: string, question: string, answer: string) {
  await requireAdmin();
  await prisma.articleFAQ.update({ where: { id }, data: { question, answer } });
  revalidatePath("/knowledge");
}

export async function deleteArticleFAQ(id: string) {
  await requireAdmin();
  await prisma.articleFAQ.delete({ where: { id } });
  revalidatePath("/knowledge");
}

export async function publishZhTranslation(id: string) {
  await requireAdmin();
  const article = await prisma.knowledgeArticle.findUnique({
    where: { id },
    select: { aiTitleZh: true, aiContentZh: true, titleZh: true, contentZh: true },
  });
  if (article?.aiTitleZh && article.titleZh) {
    await prisma.translationMemory.create({
      data: {
        articleId: id,
        aiTitleZh: article.aiTitleZh,
        aiContentZh: article.aiContentZh,
        pubTitleZh: article.titleZh,
        pubContentZh: article.contentZh,
      },
    });
  }
  await prisma.knowledgeArticle.update({ where: { id }, data: { zhDraft: false } });
  revalidatePath("/knowledge");
}

export async function updateZhTranslation(id: string, titleZh: string, contentZh: string | null, changeNotesZh: string | null) {
  await requireAdmin();
  await prisma.knowledgeArticle.update({ where: { id }, data: { titleZh, contentZh, changeNotesZh, zhDraft: true } });
  revalidatePath("/knowledge");
}

export async function updatePublishedZhTranslation(id: string, titleZh: string, contentZh: string | null, changeNotesZh: string | null) {
  await requireAdmin();
  await prisma.knowledgeArticle.update({ where: { id }, data: { titleZh, contentZh, changeNotesZh } });
  revalidatePath("/knowledge");
}

export async function retranslateArticle(id: string): Promise<{ titleZh: string | null; contentZh: string | null }> {
  await requireAdmin();
  const article = await prisma.knowledgeArticle.findUnique({ where: { id }, select: { title: true, content: true } });
  if (!article) return { titleZh: null, contentZh: null };
  const ctx = await getTranslationContext();
  const { titleZh, contentZh } = await translateArticleToZh(article.title, article.content, ctx);
  await prisma.knowledgeArticle.update({ where: { id }, data: { titleZh, contentZh, aiTitleZh: titleZh, aiContentZh: contentZh, zhDraft: true } });
  revalidatePath("/knowledge");
  revalidatePath("/admin");
  return { titleZh, contentZh };
}

async function getTranslationContext(): Promise<{ glossary: GlossaryTerm[]; examples: TranslationExample[] }> {
  const [glossary, memories] = await Promise.all([
    prisma.translationGlossary.findMany({ orderBy: { updatedAt: "desc" } }),
    prisma.translationMemory.findMany({ orderBy: { publishedAt: "desc" }, take: 5 }),
  ]);
  return { glossary, examples: memories };
}

// Glossary CRUD
export async function getGlossaryTerms() {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");
  return prisma.translationGlossary.findMany({ orderBy: { createdAt: "asc" } });
}

export async function addGlossaryTerm(termEn: string, termZh: string, note?: string) {
  await requireAdmin();
  const en = termEn.trim();
  const existing = await prisma.translationGlossary.findFirst({ where: { termEn: { equals: en } } });
  if (existing) throw new Error(`EN term "${en}" already exists in the glossary.`);
  await prisma.translationGlossary.create({ data: { termEn: en, termZh: termZh.trim(), note: note?.trim() || null } });
}

export async function updateGlossaryTerm(id: string, termEn: string, termZh: string, note?: string) {
  await requireAdmin();
  const en = termEn.trim();
  const existing = await prisma.translationGlossary.findFirst({ where: { termEn: { equals: en }, NOT: { id } } });
  if (existing) throw new Error(`EN term "${en}" already exists in the glossary.`);
  await prisma.translationGlossary.update({ where: { id }, data: { termEn: en, termZh: termZh.trim(), note: note?.trim() || null } });
}

export async function deleteGlossaryTerm(id: string) {
  await requireAdmin();
  await prisma.translationGlossary.delete({ where: { id } });
}

export async function getTranslationMemories(limit = 10) {
  await requireAdmin();
  return prisma.translationMemory.findMany({
    orderBy: { publishedAt: "desc" },
    take: limit,
    include: { article: { select: { title: true, articleNo: true } } },
  });
}

export async function syncGlossaryToSheet(): Promise<{ ok: boolean; url?: string; error?: string }> {
  await requireAdmin();
  const terms = await prisma.translationGlossary.findMany({ orderBy: { createdAt: "asc" } });
  return pushGlossaryToSheet(terms.map(t => ({ ...t, updatedAt: t.updatedAt })));
}

export async function syncTranslationMemoryToSheet(): Promise<{ ok: boolean; url?: string; error?: string }> {
  await requireAdmin();
  const memories = await prisma.translationMemory.findMany({
    orderBy: { publishedAt: "desc" },
    include: { article: { select: { title: true, articleNo: true } } },
  });
  return pushTranslationMemoryToSheet(memories);
}

export async function syncTalkTrackMemoryToSheet(): Promise<{ ok: boolean; url?: string; error?: string }> {
  await requireAdmin();
  const memories = await prisma.talkTrackMemory.findMany({ orderBy: { savedAt: "desc" } });
  return pushTalkTrackMemoryToSheet(memories);
}

export async function getGlossarySheetConfigured(): Promise<boolean> {
  await requireAdmin();
  return isGlossarySheetConfigured();
}

// ── Talk Track ──────────────────────────────────────────────────────────────

export async function addTalkTrack(articleId: string, content: string, language = "CN", aiDraft?: string) {
  await requireAdmin();
  const count = await prisma.articleTalkTrack.count({ where: { articleId } });
  const track = await prisma.articleTalkTrack.create({
    data: { articleId, content, aiDraft: aiDraft || null, language, order: count },
  });
  if (aiDraft && aiDraft !== content) {
    await prisma.talkTrackMemory.create({
      data: { articleId, language, aiDraft, savedContent: content },
    });
  }
  return track;
}

export async function updateTalkTrack(id: string, content: string) {
  await requireAdmin();
  const existing = await prisma.articleTalkTrack.findUnique({
    where: { id },
    select: { aiDraft: true, articleId: true, language: true },
  });
  await prisma.articleTalkTrack.update({ where: { id }, data: { content } });
  if (existing?.aiDraft && existing.aiDraft !== content) {
    await prisma.talkTrackMemory.create({
      data: { articleId: existing.articleId, language: existing.language, aiDraft: existing.aiDraft, savedContent: content },
    });
  }
  revalidatePath("/knowledge");
}

export async function deleteTalkTrack(id: string) {
  await requireAdmin();
  await prisma.articleTalkTrack.delete({ where: { id } });
  revalidatePath("/knowledge");
}

export async function generateTalkTrack(articleId: string, language = "CN"): Promise<string> {
  await requireAdmin();
  const article = await prisma.knowledgeArticle.findUnique({
    where: { id: articleId },
    select: { title: true, content: true },
  });
  if (!article) return "";

  const memories = await prisma.talkTrackMemory.findMany({
    where: { language },
    orderBy: { savedAt: "desc" },
    take: 3,
    select: { aiDraft: true, savedContent: true },
  });

  return generateTalkTrackDraft(
    article.title,
    article.content,
    language,
    memories
  );
}

export async function getTalkTrackMemories(limit = 20) {
  await requireAdmin();
  return prisma.talkTrackMemory.findMany({
    orderBy: { savedAt: "desc" },
    take: limit,
    select: { id: true, language: true, aiDraft: true, savedContent: true, savedAt: true },
  });
}

export async function checkTermSubstitutions(trackId: string): Promise<TermSubstitution[]> {
  await requireAdmin();
  const track = await prisma.articleTalkTrack.findUnique({
    where: { id: trackId },
    select: { aiDraft: true, content: true },
  });
  if (!track?.aiDraft || track.aiDraft === track.content) return [];

  const substitutions = await detectTermSubstitutions(track.aiDraft, track.content);
  if (!substitutions.length) return [];

  // Filter out terms already in the glossary
  const glossary = await prisma.translationGlossary.findMany({ select: { termZh: true } });
  const existingZh = new Set(glossary.map(g => g.termZh.trim()));
  return substitutions.filter(s => !existingZh.has(s.termZh.trim()));
}
