import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Assign article numbers: oldest article = #1, newest = highest
// Sort by date ASC, then by createdAt ASC as tiebreaker
const articles = await prisma.knowledgeArticle.findMany({
  select: { id: true, date: true, createdAt: true, articleNo: true },
  orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
});

let num = 1;
for (const a of articles) {
  if (a.articleNo === null) {
    await prisma.knowledgeArticle.update({ where: { id: a.id }, data: { articleNo: num } });
    console.log(`#${num} → ${a.date} (${a.id.slice(0,8)})`);
  } else {
    console.log(`SKIP #${a.articleNo} already set`);
  }
  num++;
}

await prisma.$disconnect();
console.log(`\nDone: ${articles.length} articles numbered`);
