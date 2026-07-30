import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { question } = await req.json();
  if (!question?.trim()) {
    return NextResponse.json({ error: "No question provided" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  const articles = await prisma.knowledgeArticle.findMany({
    where: { isArchived: false },
    orderBy: { articleNo: "asc" },
    select: { articleNo: true, title: true, category: true, content: true, date: true },
  });

  const articleContext = articles
    .map((a: { articleNo: number | null; category: string; title: string; date: string; content: string | null }) => {
      const num = String(a.articleNo ?? 0).padStart(3, "0");
      const content = a.content
        ? a.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300)
        : "(no content)";
      return `[#${num}] ${a.category} | ${a.title} | ${a.date}\n${content}`;
    })
    .join("\n\n");

  const prompt = `You are a helpful assistant for a customer operations team. Answer the question using ONLY the knowledge base articles provided below. Be concise (2-5 sentences). Cite articles by their number e.g. [#042]. If the answer isn't in the knowledge base, say "I couldn't find this in the knowledge base."

Articles:
${articleContext}

Question: ${question}`;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });
    const text = message.content[0]?.type === "text" ? message.content[0].text : "No response.";
    return NextResponse.json({ answer: text });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
