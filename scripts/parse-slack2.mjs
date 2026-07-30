import { readFileSync } from 'fs';

const file1 = 'C:\\Users\\WeiJianLeong\\.claude\\projects\\C--Users-WeiJianLeong-Desktop-HR-Onboarding\\28aa1cbe-b43d-4d1a-9f36-d37f7f50e527\\tool-results\\mcp-b8072cdb-54fb-4137-99c9-865895e1c17c-slack_read_channel-1782056004980.txt';
const file2 = 'C:\\Users\\WeiJianLeong\\.claude\\projects\\C--Users-WeiJianLeong-Desktop-HR-Onboarding\\28aa1cbe-b43d-4d1a-9f36-d37f7f50e527\\tool-results\\mcp-b8072cdb-54fb-4137-99c9-865895e1c17c-slack_read_channel-1782056008475.txt';

function parseTextFile(path) {
  const raw = readFileSync(path, 'utf8');
  // The outer structure is {"messages": "...text..."} - it's JSON with a string value
  let text;
  try {
    const parsed = JSON.parse(raw);
    text = parsed.messages || parsed.text || raw;
  } catch {
    text = raw;
  }

  const map = {};
  // Split on the === Message from ... === headers
  const blocks = text.split(/=== Message from .+ ===\s*/);

  for (const block of blocks) {
    // Look for "Message TS: {ts}" at the start of the block
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

console.log('File1 ts count:', Object.keys(map1).length);
console.log('File2 ts count:', Object.keys(map2).length);
console.log('Combined:', Object.keys(combined).length);
console.log('Sample keys:', Object.keys(combined).slice(0, 5));

// Output the full map as JSON to stdout for use in next script
process.stdout.write('\n===MAP_JSON===\n');
process.stdout.write(JSON.stringify(combined, null, 2));
