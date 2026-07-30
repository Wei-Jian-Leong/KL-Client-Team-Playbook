import { readFileSync } from 'fs';

const file1 = 'C:\\Users\\WeiJianLeong\\.claude\\projects\\C--Users-WeiJianLeong-Desktop-HR-Onboarding\\28aa1cbe-b43d-4d1a-9f36-d37f7f50e527\\tool-results\\mcp-b8072cdb-54fb-4137-99c9-865895e1c17c-slack_read_channel-1782056004980.txt';
const file2 = 'C:\\Users\\WeiJianLeong\\.claude\\projects\\C--Users-WeiJianLeong-Desktop-HR-Onboarding\\28aa1cbe-b43d-4d1a-9f36-d37f7f50e527\\tool-results\\mcp-b8072cdb-54fb-4137-99c9-865895e1c17c-slack_read_channel-1782056008475.txt';

function parseTextFile(path) {
  const raw = readFileSync(path, 'utf8');
  let text;
  try {
    const parsed = JSON.parse(raw);
    text = parsed.messages || parsed.text || raw;
  } catch {
    text = raw;
  }

  const map = {};
  const blocks = text.split(/=== Message from .+ ===\s*/);
  for (const block of blocks) {
    const tsMatch = block.match(/^Message TS: (\d+\.\d+)\n([\s\S]*?)(?=\nReactions:|$)/);
    if (tsMatch) {
      const ts = tsMatch[1];
      const msgText = tsMatch[2].trim();
      map[ts] = msgText;
    }
  }
  return map;
}

const map1 = parseTextFile(file1);
const map2 = parseTextFile(file2);
const combined = { ...map1, ...map2 };

// All required timestamps from articles (excluding TarroPay FAQ which is Atlassian)
const required = [
  '1746894736.048059',
  '1747616760.274689',
  '1754601005.027909',
  '1755302700.955539', // C06UEAVBFPZ
  '1757088795.673539',
  '1757982922.514859',
  '1759447841.132599',
  '1759505614.689489',
  '1759606982.351899',
  '1760131696.012829',
  '1760292000.828129',
  '1760565095.605419',
  '1760728860.868339',
  '1760734088.405239',
  '1760773157.966199',
  '1761249485.571139',
  '1761243082.658519',
  '1761269492.636419',
  '1761247308.904959',
  '1762446791.740109',
  '1762972060.021969',
  '1762998898.234809',
  '1763581590.622559',
  '1763585846.021289',
  '1763658944.056859',
  '1763658068.480659',
  '1764797929.580019',
  '1765057931.164329',
  '1765492410.146389',
  '1765672089.697679',
  '1765907291.516979',
  '1765999343.207859',
  '1766897585.158739',
  '1768422075.757649',
  '1768625853.418109',
  '1769826515.881939',
  '1769883213.187429',
  '1770336796.895839',
  '1770781918.782359',
  '1770781442.216539',
  '1770784749.687379',
  '1770859149.866229',
  '1771210522.983309',
  '1772294401.402099',
  '1772508858.850199',
  '1772818636.981519',
  '1773342002.563969',
  '1773414009.831479',
  '1774889153.122589',
  '1774969238.444229',
  '1775058686.661009',
  '1775666937.127749',
  '1775696735.162559', // C06UEAVBFPZ
  '1775659535.915659',
  '1775919601.143739',
  '1775921400.264029',
  '1776391150.864999',
  '1776388720.394259',
  '1776623351.663779',
  '1776624211.212419',
  '1777260101.883969',
  '1777259315.568189',
  '1777409155.251349',
  '1778117346.138619',
  '1778123761.095709',
  '1779658573.702939',
  '1779659283.873459',
  '1779660327.277879',
  '1780012188.685749',
  '1780100410.100789',
  '1780436017.876069',
  '1780868838.855379',
  '1781749808.650409',
  '1781819670.069249',
  '1781813874.539759',
  '1764890673.129539',
  '1768421867.598429',
  '1770825613.519449',
];

const found = required.filter(ts => combined[ts]);
const missing = required.filter(ts => !combined[ts]);

console.log(`Found: ${found.length}/${required.length}`);
console.log('Missing timestamps:');
missing.forEach(ts => console.log(' ', ts));

// Check what range is in file1
const keys1 = Object.keys(map1).map(Number).sort((a,b)=>a-b);
const keys2 = Object.keys(map2).map(Number).sort((a,b)=>a-b);
console.log('\nFile1 range:', keys1[0], 'to', keys1[keys1.length-1]);
console.log('File2 range:', keys2[0], 'to', keys2[keys2.length-1]);
