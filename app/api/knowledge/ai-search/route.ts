import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${GEMINI_API_KEY}`;

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "q required" }, { status: 400 });

  const articles = await prisma.knowledgeArticle.findMany({
    where: { isDraft: false, isArchived: false },
    select: { id: true, title: true, category: true, content: true, articleNo: true },
    orderBy: { articleNo: "desc" },
  });

  // Build compact article list for the prompt (title + first 200 chars of content)
  const articleList = articles.map(a => ({
    id: a.id,
    no: a.articleNo,
    category: a.category,
    title: a.title,
    excerpt: (a.content ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200),
  }));

  const prompt = `You are a knowledge base assistant for the "KL Client Team Playbook" — an internal operations knowledge base for a client services team.

A user asked: "${q}"

Here are the available articles (JSON):
${JSON.stringify(articleList, null, 0)}

Respond with valid JSON only (no markdown, no code blocks):
{
  "answer": "A concise, direct answer to the user's question in 1-3 sentences based on the articles. If no articles are relevant, say so briefly.",
  "articleIds": ["id1", "id2"]
}

Rules:
- articleIds: IDs of the most relevant articles, max 5, empty array if none are relevant
- answer: must be grounded in the articles, do not fabricate information
- Respond ONLY with the JSON object, nothing else`;

  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 512 },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Gemini error:", err);
    return NextResponse.json({ error: "AI search unavailable" }, { status: 502 });
  }

  const data = await res.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  let parsed: { answer: string; articleIds: string[] };
  try {
    // Strip markdown code fences if present
    const clean = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    parsed = JSON.parse(clean);
  } catch {
    return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
  }

  return NextResponse.json({ answer: parsed.answer, articleIds: parsed.articleIds ?? [] });
}
