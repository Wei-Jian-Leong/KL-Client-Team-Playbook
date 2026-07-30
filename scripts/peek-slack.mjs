import { readFileSync } from 'fs';

const file1 = 'C:\\Users\\WeiJianLeong\\.claude\\projects\\C--Users-WeiJianLeong-Desktop-HR-Onboarding\\28aa1cbe-b43d-4d1a-9f36-d37f7f50e527\\tool-results\\mcp-b8072cdb-54fb-4137-99c9-865895e1c17c-slack_read_channel-1782056004980.txt';

const content = readFileSync(file1, 'utf8');
console.log('Total length:', content.length);
console.log('First 2000 chars:');
console.log(content.substring(0, 2000));
