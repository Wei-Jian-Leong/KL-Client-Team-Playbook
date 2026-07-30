import { readFileSync } from 'fs';

const file1 = 'C:\\Users\\WeiJianLeong\\.claude\\projects\\C--Users-WeiJianLeong-Desktop-HR-Onboarding\\28aa1cbe-b43d-4d1a-9f36-d37f7f50e527\\tool-results\\mcp-b8072cdb-54fb-4137-99c9-865895e1c17c-slack_read_channel-1782056004980.txt';
const file2 = 'C:\\Users\\WeiJianLeong\\.claude\\projects\\C--Users-WeiJianLeong-Desktop-HR-Onboarding\\28aa1cbe-b43d-4d1a-9f36-d37f7f50e527\\tool-results\\mcp-b8072cdb-54fb-4137-99c9-865895e1c17c-slack_read_channel-1782056008475.txt';

function parseFile(path) {
  const content = readFileSync(path, 'utf8');
  try {
    const data = JSON.parse(content);
    return data.messages || [];
  } catch(e) {
    console.error('Not JSON:', e.message, content.substring(0, 300));
    return [];
  }
}

const msgs1 = parseFile(file1);
const msgs2 = parseFile(file2);
console.log('File1 messages:', msgs1.length);
console.log('File2 messages:', msgs2.length);

const all = [...msgs1, ...msgs2];
const map = {};
for (const m of all) {
  if (m.ts) map[m.ts] = m.text || '';
}
console.log('Total unique ts:', Object.keys(map).length);
// Print all ts values
Object.keys(map).sort().forEach(ts => console.log('TS:', ts, 'LEN:', map[ts].length));
