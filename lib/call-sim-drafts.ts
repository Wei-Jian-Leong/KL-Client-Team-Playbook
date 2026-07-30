import fs from "fs";
import path from "path";
import matter from "gray-matter";

const KB_ROOT = path.join(process.env.HOME || "/Users/wonders", "Desktop/HR Onboarding/call-sim-kb");

export type DraftType = "draft" | "simulation" | "quiz" | "edge-case";

export interface CallSimDraft {
  filename: string;
  type: DraftType;
  scenario: string;
  date: string;
  restaurant: string;
  caller: string;
  complexity: "general" | "edge";
  status: string;
  content: string;
  filePath: string;
}

function dirFiles(dir: string): string[] {
  try {
    return fs.readdirSync(dir).filter(f => f.endsWith(".md"));
  } catch {
    return [];
  }
}

function parseFile(filePath: string, type: DraftType): CallSimDraft | null {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const { data, content } = matter(raw);
    const filename = path.basename(filePath);
    // derive scenario from filename if not in frontmatter
    const scenario = data.scenario || filename.replace(/--\d{4}-\d{2}-\d{2}\.md$/, "").replace(/^(sim--|quiz--|edge--)/, "");
    return {
      filename,
      type,
      scenario,
      date: data.date ? String(data.date) : "",
      restaurant: data.restaurant || "",
      caller: data.caller || "",
      complexity: data.complexity || "general",
      status: data.status || "draft",
      content,
      filePath,
    };
  } catch {
    return null;
  }
}

export function getAllDrafts(): CallSimDraft[] {
  const drafts: CallSimDraft[] = [];

  for (const f of dirFiles(path.join(KB_ROOT, "drafts"))) {
    const d = parseFile(path.join(KB_ROOT, "drafts", f), "draft");
    if (d) drafts.push(d);
  }
  for (const f of dirFiles(path.join(KB_ROOT, "simulations"))) {
    const type: DraftType = f.startsWith("quiz--") ? "quiz" : "simulation";
    const d = parseFile(path.join(KB_ROOT, "simulations", f), type);
    if (d) drafts.push(d);
  }
  for (const f of dirFiles(path.join(KB_ROOT, "edge-cases"))) {
    const d = parseFile(path.join(KB_ROOT, "edge-cases", f), "edge-case");
    if (d) drafts.push(d);
  }

  return drafts.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

export function getDraftByFilename(filename: string): CallSimDraft | null {
  const dirs = [
    { dir: path.join(KB_ROOT, "drafts"), type: "draft" as DraftType },
    { dir: path.join(KB_ROOT, "simulations"), type: "simulation" as DraftType },
    { dir: path.join(KB_ROOT, "edge-cases"), type: "edge-case" as DraftType },
  ];
  for (const { dir, type } of dirs) {
    const fp = path.join(dir, filename);
    if (fs.existsSync(fp)) {
      const t: DraftType = filename.startsWith("quiz--") ? "quiz" : type;
      return parseFile(fp, t);
    }
  }
  return null;
}

export function deleteDraftFile(filename: string): boolean {
  const dirs = [
    path.join(KB_ROOT, "drafts"),
    path.join(KB_ROOT, "simulations"),
    path.join(KB_ROOT, "edge-cases"),
  ];
  for (const dir of dirs) {
    const fp = path.join(dir, filename);
    if (fs.existsSync(fp)) {
      fs.unlinkSync(fp);
      return true;
    }
  }
  return false;
}
