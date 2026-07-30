import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const r = await prisma.knowledgeArticle.findMany({ select: { id: true, title: true, slackLink: true, altLink: true } });
r.forEach(a => console.log(JSON.stringify(a)));
await prisma.$disconnect();
