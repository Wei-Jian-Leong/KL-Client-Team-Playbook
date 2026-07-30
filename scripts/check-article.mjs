import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const r = await p.knowledgeArticle.findFirst({ where: { articleNo: 69 }, select: { files: true, title: true } });
console.log('title:', r?.title);
console.log('files:', r?.files);
await p.$disconnect();
