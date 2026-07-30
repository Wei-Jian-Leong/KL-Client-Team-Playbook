import { PrismaClient } from '@prisma/client';

// Complete map of Slack message ts → attached files (images/videos only)
const FILES_BY_TS = {
  // C06UEAVBFPZ channel
  '1755302700.955539': [
    { id: 'F09ALA8DE4V', name: 'TL Rollout - Complaint Popup.png', mimeType: 'image/png' },
    { id: 'F09APD220TG', name: 'TL Rollout - Missing Item Policy.png', mimeType: 'image/png' },
    { id: 'F09A9QV7ST1', name: 'TL Rollout - Wrong Order.png', mimeType: 'image/png' },
    { id: 'F09APD2E3PY', name: 'TL Rollout - Bad Food.png', mimeType: 'image/png' },
  ],
  // C0710M7JDJA channel
  '1761247308.904959': [
    { id: 'F09P4BQ9EUQ', name: 'Screenshot 2025-10-23 at 1.15.55 PM.png', mimeType: 'image/png' },
  ],
  '1761249485.571139': [
    { id: 'F09P4JN5DEC', name: 'image (72).png', mimeType: 'image/png' },
  ],
  '1762972060.021969': [
    { id: 'F09SWJYP76D', name: 'image.png', mimeType: 'image/png' },
    { id: 'F09SFLFPUP8', name: 'image.png', mimeType: 'image/png' },
    { id: 'F09SHMZUM7U', name: 'image.png', mimeType: 'image/png' },
    { id: 'F09SBA91RV1', name: 'image.png', mimeType: 'image/png' },
    { id: 'F09TC1HPXME', name: 'image.png', mimeType: 'image/png' },
  ],
  '1762998898.234809': [
    { id: 'F09SJCPL25U', name: 'Delicious Menu (1).png', mimeType: 'image/png' },
  ],
  '1769826515.881939': [
    { id: 'F0ACZ1641R6', name: 'Undo Cart Change.mov', mimeType: 'video/quicktime' },
    { id: 'F0ABP8Q5TL7', name: 'Coupon UI.mp4', mimeType: 'video/mp4' },
    { id: 'F0AC4MR6FLJ', name: 'Party Order update.mov', mimeType: 'video/quicktime' },
  ],
  '1770336796.895839': [
    { id: 'F0AD88SN9UM', name: 'image.png', mimeType: 'image/png' },
  ],
  '1770781442.216539': [
    { id: 'F0AENKX6C49', name: 'image.png', mimeType: 'image/png' },
  ],
  '1770781918.782359': [
    { id: 'F0AE9NXFRAN', name: 'image.png', mimeType: 'image/png' },
  ],
  '1770784749.687379': [
    { id: 'F0AEDFM9PPW', name: 'image.png', mimeType: 'image/png' },
    { id: 'F0AE3FU5EJF', name: 'image.png', mimeType: 'image/png' },
    { id: 'F0AE7RK4K3Q', name: 'image.png', mimeType: 'image/png' },
    { id: 'F0AE7RQA3E2', name: 'image.png', mimeType: 'image/png' },
  ],
  '1770825613.519449': [
    { id: 'F0AF4QN131N', name: 'image.png', mimeType: 'image/png' },
  ],
  '1771210522.983309': [
    { id: 'F0AF44Q7D7G', name: 'image.png', mimeType: 'image/png' },
    { id: 'F0AEZQF8ZEF', name: 'image.png', mimeType: 'image/png' },
  ],
  '1777259315.568189': [
    { id: 'F0AUYGKLWP9', name: 'image.png', mimeType: 'image/png' },
  ],
  '1777260101.883969': [
    { id: 'F0AVAKBHSBF', name: 'image.png', mimeType: 'image/png' },
    { id: 'F0B0CUFEHTK', name: 'image.png', mimeType: 'image/png' },
    { id: 'F0B0U9USPEU', name: 'image.png', mimeType: 'image/png' },
  ],
  '1777409155.251349': [
    { id: 'F0B0E3GAUJJ', name: 'image.png', mimeType: 'image/png' },
  ],
  '1778117346.138619': [
    { id: 'F0B2HV3KZG9', name: 'image.png', mimeType: 'image/png' },
  ],
  '1778123761.095709': [
    { id: 'F0B23EXMMTQ', name: 'image.png', mimeType: 'image/png' },
  ],
  '1779658573.702939': [
    { id: 'F0B5UBRB6BY', name: 'image.png', mimeType: 'image/png' },
  ],
  '1779659283.873459': [
    { id: 'F0B5F0XQUSK', name: 'image.png', mimeType: 'image/png' },
    { id: 'F0B5Q3KBKCK', name: 'image.png', mimeType: 'image/png' },
  ],
  '1779660327.277879': [
    { id: 'F0B60429DEG', name: 'image.png', mimeType: 'image/png' },
    { id: 'F0B5Q4N0SJF', name: 'image.png', mimeType: 'image/png' },
  ],
  '1780012188.685749': [
    { id: 'F0B6XMC0X25', name: 'image.png', mimeType: 'image/png' },
    { id: 'F0B6VSCRLAW', name: 'Anonymous Callers Blocked.mp4', mimeType: 'video/mp4' },
  ],
  '1780100410.100789': [
    { id: 'F0B6P50Q5SB', name: 'image.png', mimeType: 'image/png' },
  ],
  '1780436017.876069': [
    { id: 'F0B7SSVMYK0', name: 'image.png', mimeType: 'image/png' },
    { id: 'F0B7WQ0MSNM', name: 'image.png', mimeType: 'image/png' },
  ],
  '1780868838.855379': [
    { id: 'F0B8PUS5E67', name: 'image.png', mimeType: 'image/png' },
  ],
  '1781749808.650409': [
    { id: 'F0BBFLTK5L1', name: 'image.png', mimeType: 'image/png' },
  ],
  '1781813874.539759': [
    { id: 'F0BBMSPPBPU', name: 'image.png', mimeType: 'image/png' },
    { id: 'F0BBRFT66EQ', name: 'image.png', mimeType: 'image/png' },
    { id: 'F0BBJETL1JR', name: 'image.png', mimeType: 'image/png' },
  ],
  '1781819670.069249': [
    { id: 'F0BBG6974H1', name: 'image.png', mimeType: 'image/png' },
    { id: 'F0BBG69UFCK', name: 'image.png', mimeType: 'image/png' },
    { id: 'F0BBQC6JAQH', name: 'image.png', mimeType: 'image/png' },
  ],
};

function extractTs(slackLink) {
  if (!slackLink) return null;
  const match = slackLink.match(/p(\d{10})(\d+)$/);
  if (match) return `${match[1]}.${match[2]}`;
  return null;
}

const prisma = new PrismaClient();
const articles = await prisma.knowledgeArticle.findMany({
  select: { id: true, title: true, slackLink: true },
});

let updated = 0, skipped = 0;

for (const article of articles) {
  const ts = extractTs(article.slackLink);
  const files = ts ? FILES_BY_TS[ts] : null;
  if (!files) { skipped++; continue; }

  await prisma.knowledgeArticle.update({
    where: { id: article.id },
    data: { files: JSON.stringify(files) },
  });
  console.log(`UPDATED: ${article.title} — ${files.length} file(s)`);
  updated++;
}

await prisma.$disconnect();
console.log(`\nDone: ${updated} updated, ${skipped} skipped`);
