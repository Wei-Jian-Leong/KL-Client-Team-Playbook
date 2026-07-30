import { readFileSync, readdirSync } from 'fs';

const toolResultsDir = 'C:\\Users\\WeiJianLeong\\.claude\\projects\\C--Users-WeiJianLeong-Desktop-HR-Onboarding\\28aa1cbe-b43d-4d1a-9f36-d37f7f50e527\\tool-results';

function parseTextFile(path) {
  const raw = readFileSync(path, 'utf8');
  let text;
  try {
    const parsed = JSON.parse(raw);
    text = parsed.messages || parsed.text || raw;
    if (typeof text !== 'string') text = raw;
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

// Read all slack_read_channel result files
const files = readdirSync(toolResultsDir)
  .filter(f => f.includes('slack_read_channel'))
  .map(f => `${toolResultsDir}\\${f}`);

console.log('Files found:', files.length);

const combined = {};
for (const f of files) {
  const map = parseTextFile(f);
  Object.assign(combined, map);
}

console.log('Total unique ts:', Object.keys(combined).length);

// All required timestamps from articles
const required = [
  '1746894736.048059',
  '1747616760.274689',
  '1754601005.027909',
  '1755302700.955539',
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
  '1775696735.162559',
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

console.log(`\nFound: ${found.length}/${required.length}`);
if (missing.length > 0) {
  console.log('Missing timestamps:');
  missing.forEach(ts => {
    const num = parseFloat(ts);
    const date = new Date(num * 1000).toISOString();
    console.log(' ', ts, '=', date);
  });
}

// Show ranges per file
for (const f of files) {
  const map = parseTextFile(f);
  const keys = Object.keys(map).map(Number).sort((a,b)=>a-b);
  if (keys.length > 0) {
    console.log(`\n${f.split('\\').pop()}: ${keys.length} msgs, range ${keys[0]} - ${keys[keys.length-1]}`);
  }
}
