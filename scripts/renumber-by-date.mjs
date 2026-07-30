import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function parseArticleDate(s) {
  const [m, d, y] = s.split('/').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

const all = await prisma.knowledgeArticle.findMany({
  select: { id: true, date: true, createdAt: true, title: true },
});

all.sort((a, b) => {
  const da = parseArticleDate(a.date).getTime();
  const db = parseArticleDate(b.date).getTime();
  if (da !== db) return da - db;
  return a.createdAt.getTime() - b.createdAt.getTime();
});

// Phase 1: clear all
await prisma.$transaction(
  all.map(a => prisma.knowledgeArticle.update({ where: { id: a.id }, data: { articleNo: null } }))
);

// Phase 2: assign by date order
await prisma.$transaction(
  all.map((a, i) =>
    prisma.knowledgeArticle.update({ where: { id: a.id }, data: { articleNo: i + 1 } })
  )
);

console.log(`Renumbered ${all.length} articles:`);
all.forEach((a, i) => console.log(`  #${String(i + 1).padStart(3, '0')}  ${a.date}  ${a.title.slice(0, 50)}`));

await prisma.$disconnect();
