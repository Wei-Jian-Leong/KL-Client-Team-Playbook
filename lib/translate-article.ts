import { GoogleGenerativeAI } from "@google/generative-ai";

export type GlossaryTerm = { termEn: string; termZh: string };
export type TranslationExample = {
  aiTitleZh: string;
  pubTitleZh: string;
  aiContentZh?: string | null;
  pubContentZh?: string | null;
};

function buildGlossaryBlock(glossary: GlossaryTerm[]): string {
  if (!glossary.length) return "";
  const lines = glossary.map(({ termEn, termZh }) => `- "${termEn}" → ${termZh}`).join("\n");
  return `\nFixed term overrides (always use these, do not deviate):\n${lines}\n`;
}

function buildExamplesBlock(examples: TranslationExample[]): string {
  const relevant = examples.filter(e => e.aiTitleZh !== e.pubTitleZh).slice(0, 3);
  if (!relevant.length) return "";
  const blocks = relevant.map((e, i) =>
    `Example ${i + 1}:\n  AI draft: "${e.aiTitleZh}"\n  Human-approved: "${e.pubTitleZh}"`
  ).join("\n");
  return `\nLearning from previous human corrections (apply similar patterns):\n${blocks}\n`;
}

export async function translateArticleToZh(
  title: string,
  contentHtml: string | null,
  opts?: { glossary?: GlossaryTerm[]; examples?: TranslationExample[] }
): Promise<{ titleZh: string; contentZh: string | null }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { titleZh: title, contentZh: contentHtml };

  const glossaryBlock = buildGlossaryBlock(opts?.glossary ?? []);
  const examplesBlock = buildExamplesBlock(opts?.examples ?? []);

  if (glossaryBlock || examplesBlock) {
    console.log("[Translate ZH] context injected:", {
      glossaryTerms: opts?.glossary?.length ?? 0,
      examples: opts?.examples?.filter(e => e.aiTitleZh !== e.pubTitleZh).slice(0, 3).length ?? 0,
    });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    const titlePrompt = `Translate the following English text to Simplified Chinese. Return only the translated text, nothing else.${glossaryBlock}${examplesBlock}\n${title}`;
    const titleResult = await model.generateContent(titlePrompt);
    const titleZh = titleResult.response.text().trim();

    let contentZh: string | null = null;
    if (contentHtml) {
      const base64Map: string[] = [];
      const videoMap: string[] = [];

      const strippedHtml = contentHtml
        .replace(/src="(data:[^"]+)"/g, (_, data) => {
          const idx = base64Map.length;
          base64Map.push(data);
          return `src="__BASE64_${idx}__"`;
        })
        .replace(/<kb-video\b[^>]*>[\s\S]*?<\/kb-video>/gi, (match) => {
          const idx = videoMap.length;
          videoMap.push(match);
          return `__VIDEO_${idx}__`;
        })
        .replace(/<video\b[^>]*>[\s\S]*?<\/video>/gi, (match) => {
          const idx = videoMap.length;
          videoMap.push(match);
          return `__VIDEO_${idx}__`;
        });

      const contentPrompt = `Translate the following HTML from English to Simplified Chinese. Rules:
- Translate ONLY the human-readable text content inside HTML tags
- Preserve ALL HTML tags, attributes, and structure exactly as-is
- Do not translate or modify any HTML tag names, attribute names, or attribute values
- Return only the translated HTML, nothing else${glossaryBlock}${examplesBlock}
${strippedHtml}`;
      const contentResult = await model.generateContent(contentPrompt);
      let translatedHtml = contentResult.response.text().trim()
        .replace(/^```(?:html)?\s*/i, "").replace(/\s*```\s*$/, "")
        .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

      base64Map.forEach((data, i) => {
        translatedHtml = translatedHtml.replace(`src="__BASE64_${i}__"`, `src="${data}"`);
      });
      videoMap.forEach((block, i) => {
        translatedHtml = translatedHtml.replace(`__VIDEO_${i}__`, block);
      });

      contentZh = translatedHtml;
    }

    return { titleZh, contentZh };
  } catch (e) {
    console.error("[Translate ZH error]", e);
    return { titleZh: title, contentZh: contentHtml };
  }
}
