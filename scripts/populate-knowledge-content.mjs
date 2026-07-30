import { PrismaClient } from '@prisma/client';
import { readFileSync, readdirSync } from 'fs';

// Parse a Slack tool-result text file and return a ts->text map
function parseTextFile(path) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return {};
  }

  let text;
  try {
    const parsed = JSON.parse(raw);
    // Could be {"messages": "...formatted text..."} or [{"type":"text","text":"..."}]
    if (Array.isArray(parsed)) {
      // persisted-output format
      const textItem = parsed.find(item => item.type === 'text');
      if (textItem) {
        const inner = JSON.parse(textItem.text);
        text = inner.messages || textItem.text;
      }
    } else if (typeof parsed.messages === 'string') {
      text = parsed.messages;
    } else {
      text = raw;
    }
  } catch {
    text = raw;
  }

  if (typeof text !== 'string') return {};

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

// Also handle anonymous messages (no "from" header)
function parseTextFileAnon(path) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return {};
  }

  let text;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const textItem = parsed.find(item => item.type === 'text');
      if (textItem) {
        try {
          const inner = JSON.parse(textItem.text);
          text = inner.messages || textItem.text;
        } catch {
          text = textItem.text;
        }
      }
    } else if (typeof parsed.messages === 'string') {
      text = parsed.messages;
    } else {
      text = raw;
    }
  } catch {
    text = raw;
  }

  if (typeof text !== 'string') return {};

  const map = {};
  // Split on === Message ... === (with or without "from")
  const blocks = text.split(/=== Message(?:[^=]*)===\s*/);
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

// Load all tool-result files
const toolResultsDir = 'C:\\Users\\WeiJianLeong\\.claude\\projects\\C--Users-WeiJianLeong-Desktop-HR-Onboarding\\28aa1cbe-b43d-4d1a-9f36-d37f7f50e527\\tool-results';
const files = readdirSync(toolResultsDir)
  .filter(f => f.includes('slack_read_channel') || f.includes('toolu_'))
  .map(f => `${toolResultsDir}\\${f}`);

const combined = {};
for (const f of files) {
  const map = parseTextFileAnon(f);
  Object.assign(combined, map);
}

// Inline data from direct Slack API responses that were returned in-message
// (not saved to files) - captured from tool call results above

// C0710M7JDJA: Unconfirm Order
combined['1746894736.048059'] = `:loudspeaker: *VPO Agent* *Process Update: Handling Unconfirmed Orders* :loudspeaker:\n\n:pushpin: *What's Happening?*\nWe're seeing cases where we receive CA calls get when the customer *disconnected during the ordering process*, leading to *unconfirmed orders*. Agent will now follow the updated process to ensure we handle these efficiently and avoid unnecessary delays or missed orders.\n\n:arrows_counterclockwise: *Updated Handling Process*\n• *Call got disconnected _after_ customer provided the order + you gave total & delivery time*\n    ◦ Proceed with *2 callback attempts.* If no answer, *send the order*\n• *Call got disconnected _mid-conversation_, with an incomplete order*\n    ◦ Proceed with *2 callback attempts.* If no answer, *Save order > Other > Summary of the call > Confirm*\n• *Call got disconnected _after_ receiving a complete order, but _before_ you could give total & delivery time*\n    ◦ Proceed with *2 callback attempts.* If no answer, *call CA*`;

// C0710M7JDJA: Phone number show when transfer call to resto manually
combined['1747616760.274689'] = `:mega: *[Reminder] Number Shown to Client When Using "Transfer" to Restaurant* :mega:\n\n:brain: What's Happening:\nWhen we click the "*Transfer*" button to connect a client to the restaurant, the number shown to the restaurant is:\n:telephone_receiver: <tel:9172613088|917-261-3088> — not the customer's actual number.\n\n:exclamation: *Why This Matters:*\n• If a client asks why the restaurant didn't receive their call?\n    ◦ We can ask the client if the restaurant saw this number. If yes, we can confirm that the transfer was made.\n• If the client asks why their actual number wasn't shown?\n    ◦ Explain that our system setup uses this number as a bridge, and we are not able to show the customer's number directly.`;

// C06UEAVBFPZ: CRT Manager call process
combined['1755302700.955539'] = `Hello <!subteam^S01R0PYUXDH>!\n\nThank you for your feedback with the initial rollout on our revised *Manager Call Handling Policy.* Taking these into consideration, we decided to send a clearer and more streamlined version of this. To reiterate, this is one of the several improvements we're slowly building to improve our <!subteam^S01R0PYUXDH>'s Manager call handling workflow.\n\nPlease take a moment to review it and familiarize yourselves with the steps.\n\nIf you have any questions or comments, feel free to leave them in this thread. Thank you!\n\ncc: <!subteam^S02HMARH4EL> <@U03T7CDHP5Z|Jao Gonzales> <@U04SRNVGG8M|Erwin Dumindin> <@U04T5ML6ULV|Miguel Cariño> <@U078U9MJDN3|Jay Caluag>`;

// C06UEAVBFPZ: Dish Code Sizes vs. Variant Prompt
combined['1775696735.162559'] = `*Title:*\nDish Code Sizes vs. Variant Prompt\n\n*Relevant Tiers:*\nT1, T2, T3, Pizza, Support\n\n*What you need to know:*\n_*This is for non-tokenized dish codes only*._ When you search a dish code in the main dish search, hover over the dish to see its available sizes. *Always follow what the hover shows,* not the Variant Prompt.\n\n*Scenario 1*\nHover shows: Small and Large\nPrompt says: _"Confirm: Large"_\n:white_check_mark: Ask the customer: _"Small or Large?"_\n:x: Don't confirm Large based on the prompt\n\n*Scenario 2*\nHover shows: Small and Large\nPrompt says: _"Ask: Large or Combo"_\n:white_check_mark: Ask the customer: _"Small or Large?"_\n:x: Don't offer Large or Combo based on the prompt\n\n*The simple rule*: If the hover sizes and the Variant Prompt don't match, go with the hover. *The dish code is always the source of truth.*\n\n*Why this matters:*\nCustomers ordering by dish code are likely familiar with the sizes tied to that dish code. If agents follow the Variant Prompt instead, they risk offering sizes the customer wasn't expecting, which can cause confusion and order errors. Following the sizes tied to the dish code (seen in hover) ensures the sizes you offer match what the customer actually has in mind.\n\n*Link/video:*\nN/A\n\n*Sample call/restaurant:*\nN/A`;

// From inline results: 1762446791.740109, 1762972060.021969
combined['1762446791.740109'] = `:intercom: *[Update] Menu Sub-Intent Changes* :intercom:\n:bulb: *What's Happening*\nWe're making updates to the *Menu-related Sub-Intents* to simplify workflows and ensure better tracking.\n\n:gear: *What You Need to Know*\n1. :wastebasket: *"Menu Revalidation"* sub-intent will be *removed*.\n2. :pencil2: *"Menu Change (CSM Use)"* will be *renamed to "Menu Change."*\n3. :jigsaw: Three new *micro-intents* will be added under Menu Change:\n    ◦ *Menu Validation with Client*\n    ◦ *Menu Change Complaint*\n    ◦ *Menu Change Updates*\n:clipboard: *Important Notes*\n• For *Menu Validation with Client*, COS must *double-check all prices* with the client.\n• If the client is *unable to upload a menu to CMA*, it's usually due to an outdated CMA.\n    ◦ Try *basic troubleshooting* first (Update to the latest version, relog in, etc...).\n    ◦ If the issue persists, *create a Tech team ticket* instead.\n:speech_balloon: *Why This Matters*\nTo improve *menu update accuracy*, reduce redundant sub-intents, and make it easier for agents to *categorize requests correctly.*\n\n:+1: *Action Required*\nPlease acknowledge this update by reacting to this post so we know you've read it. Thanks!\n<!subteam^S018R16L079> <!subteam^S055VEMMUFP> <!subteam^S02J5DVNE78> <!subteam^S0556JVHDNC>`;

combined['1762972060.021969'] = `:mega: *[Update] Future DE Orders* :mega:\n\n:bulb: *What's Happening*\nWe've added *scheduled (future) DE orders*, a feature that wasn't previously available but is now essential as DE operations expand.\n\n:gear: *How It Works*\n1. *By mid this week*, the *Future Orders button* will be enabled for *DE orders* as well.\n2. The *closing spiel* has been updated (replacing "Delivery in XX mins") to reflect *future orders*, depending on the scheduled date:\n    ◦ "Your order has been scheduled for XX:XX AM/PM."\n    ◦ "Your order has been scheduled for XX:XX AM/PM tomorrow."\n    ◦ "Your order has been scheduled for MM/DD."\n3. *Future order receipts for DE* now include new timestamps and notes:\n    ◦ Adds "Tarro driver will arrive around xx:xx PM" in the black box and driver info.\n4. A *reminder note* is printed just before the scheduled time to help restaurants prepare on time:\n    ◦ *DE:* "This is a reminder of order #{#} scheduled to be dropped off at {xx:yy AM/PM}. Driver will arrive around {xx:yy AM/PM}."\n    ◦ *Self-Delivery:* "This is a reminder of order #{#} scheduled to be dropped off at {xx:yy AM/PM}. Please plan accordingly or switch to a Tarro driver if you cannot deliver."\n    ◦ *Pickup:* "This is a reminder of order #{#} scheduled to be picked up at {xx:yy AM/PM}."\n5. More updates coming soon — restaurants will later be able to *turn off reminder notes* or *print receipts earlier*, depending on their needs.\n:speech_balloon: Why This Matters\nTo ensure restaurants *don't miss preparing future DE orders* and to improve *clarity on timing* for both DE drivers and clients.`;

combined['1770336796.895839'] = `:pushpin:[Update | Dropoff ETA on receipts] - *Can check receipt ETA to determine if the DE order consider late*\n\nHi Team, for *DE order*, on the receipt now will show estimated completion time. You may refer to the receipt to determine if the order is consider late for compensation.\n\nExample refer snip below :\nDelivery completed at 12:51PM and estimated time show 1PM on the receipt = this order is not consider late and will be no compensation for late.`;

combined['1770781918.782359'] = `:pushpin:[TarroWeb] *Submit Business Impact/Churn Back Office Ticket to CSM*\n\n*Details as below :* \nTarroWeb is the WIP online order solution, it's been started out as a replacement for the legacy sesame menu product.\n\nWhat to do once a CL indicates interest in Online Order?\n• For *COS*: Create an Intercom ticket:\n    ◦ Interest in Additional Tarro Products > *TarroWeb*\nFor FAQ refer <https://wondersco.atlassian.net/wiki/spaces/GDT/pages/4189552649/TarroWeb+FAQ+Feb+2026|here>`;

combined['1770781442.216539'] = `:pushpin:[TarroPay Terminal inquiry] *Submit Business Impact/Churn Back Office Ticket*\n\n*Details as below :* \nFor TarroPay Terminal, we will *only do reactive selling for TarroPay Terminal*, i.e. we will *not* be proactively promoting TarroPay Terminal unless the CL asks or specifically requests for it.\n\n:green_tick: Example scenario - what we *can* do for now:\n1. CL calls in and asks if we have in-store credit card processing\n2. CL is interested to sign up for TarroPay Voice - either standalone or as a bundle with DE\n3. CL is hesitant because they do not want to deal with another credit card provider / statement at the end of the month\n:x: Example scenario - what we *cannot* do for now:\n1. CL did not mention anything related to in-store credit card payment processing, *do not* proactively promoting TarroPay Terminal.\nWhat to do once a CL indicates interest in TarroPay Voice / Terminal?\n• For *COS*: Create an Intercom ticket:\n    ◦ TarroPay Voice = CL interested in TarroPay but did not mention about terminal\n    ◦ TarroPay Voice + Terminal  = CL interested in TarroPay Terminal and does not have Tarro Pay Voice\n    ◦ TarroPay Terminal = CL already has Tarro Pay voice and interested in TarroPay Terminal`;

combined['1770784749.687379'] = `:pushpin:[CC Number *Masked* in Recording]\n:pushpin:[FYI : Late night cash restriction for DE order] *Can setup up CC only for certain period of time for DE order.* \n:pushpin:[Update : Pack in Separate Bags]\n\n:one:Hi Team, due to PCI concern, CC number will be masked from call/screen recording and transcript.\n\nWhen CL inquiry:\nExplain to CL due to PCI-DSS (Payment Card Industry Data Security Standard), COS now are not able to check call recording for CC card number, offer solution instead such as call to CX directly for card number again.\n\n:two:Just FYI, some resto will receive call from our team regarding we will setup a late night cash restriction for DE order. They will setup a schedule which allow CC payment only. This is currently pilot test for few resto.\n\n:three:Pack in separate bag update.\n *Agent UI Redesign -* By clicking the 3dot beside the dish item, now can select add new bag which will show Bag 1, Bag 2 for which dish. Agent can select move to the bag to arrange the dish in each bags refer snip 1.\n\n*CMA & Fee Configuration -* Resto can setup bag fees as flat fee per order or fee per bag refer snip 2. This feature will only enable when allow pack in separate bags in enable. refer snip 3`;

combined['1770859149.866229'] = `:pushpin:[Fiery Crab Process update] *Always submit menu Back Office ticket* for any *menu updates*\n\nHi Team, starting today for any *Fiery Crab Menu updates* (price changes, out of stock, FAQ, payment, special hours and etc.) Even the request was doable by COS, *do not update manually* and *leave clear instruction/request*, we must always *submit menu Back Office ticket* to menu team for update. This is *only applicable for all Fiery Crab Resto*.`;

combined['1770825613.519449'] = `:pushpin:[Intercom Chat update] *Do not handle any Pizza resto chat*\n\nHi all <!subteam^S0382ATRMK8>, for *Pizza resto chat* will be handle by dedicated *Pizza skilled agent*. If you are handling intercom chat and receive a pizza resto chat, do not reply the chat. The chat suppose not to be route to *COS NON VOICE* inbox, if you receive the chat by any chance, please manually reroute it back to *EN COS* inbox for the dedicated pizza skilled agent to handle as snip below\n\nReminder, we should always show empathy to any call/chat to our client. Talk track as below :\n> 好的老板，请您稍等，我现在为您查询  Certainly, please allow me a moment while I check that for you\n> 非常抱歉为您带来困扰，我们会尽快为您处理.  We sincerely apologize for the inconvenience. We will resolve this for you as soon as possible\n_For more intercom chat spiel, feels free to check out_ *<https://docs.google.com/spreadsheets/d/1sHbKb9rbXcIVpV_jmV8xsZEAQylUfkvcOfp0oMSn9GU/edit?gid=1934291731#gid=1934291731|COS NH Playbook>* _for more info, and drop some comments for any feedback!_`;

combined['1781819670.069249'] = `:pushpin:[Update | CMA] *Setup Cash Discount in CMA (By Menu Team)*\n\nSome clients might encourage CX to pay with cash by providing them a cash discount. Right now we can setup this in CMA (*by Menu Team*), Wira Ticket \`Live Support Menu\` > \`Resto Information Update\` > \`Payment Methods Update\`\n\n*How it works :* \n*CMA :*\n• A new Cash Discount toggle + discount percentage input field is now available under Restaurant Configuration → Payments\n• Once enabled, all cash discounting behavior below activates automatically\n• Order cards show card total by default. Marking an order as "Paid using Cash" updates the order card to show the discounted cash total\n• Billing and invoicing pull from whichever total is on the order at end of day\n\n*Agent UI*\n• After an order is placed at a cash discount restaurant, *agents will see a post-order warning* showing the discounted cash total (e.g. "Total is $X.XX if paid in cash")\n• *Agents don't proactively mention this* (it's purely informational in case the customer asks)\n\n*Receipts*\n• For cash discount restaurants, receipts now print both the card total and the cash total\n• Drivers don't need to calculate anything and they collect based on whichever method the customer uses at the door\n\n*Discount logic*\n• The cash discount applies to the order subtotal (menu items before taxes and fees)\n• It applies after any existing promo or item-level discounts\n• Flat dollar fees are unaffected`;

console.log(`Total ts in map: ${Object.keys(combined).length}`);

// Helper to extract ts from slackLink
function extractTs(slackLink) {
  if (!slackLink) return null;
  // Match p{digits} at end of URL
  const match = slackLink.match(/p(\d{10})(\d+)$/);
  if (match) {
    return `${match[1]}.${match[2]}`;
  }
  return null;
}

// Run DB updates
const prisma = new PrismaClient();

const articles = await prisma.knowledgeArticle.findMany({
  select: { id: true, title: true, slackLink: true }
});

let updated = 0;
let skipped = 0;
let notFound = 0;

for (const article of articles) {
  // Skip TarroPay FAQ (Atlassian link, not Slack)
  if (article.slackLink && article.slackLink.includes('atlassian.net') && !article.slackLink.includes('slack.com')) {
    console.log(`SKIP (Atlassian): ${article.title}`);
    skipped++;
    continue;
  }

  const ts = extractTs(article.slackLink);
  if (!ts) {
    console.log(`SKIP (no ts): ${article.title} | ${article.slackLink}`);
    skipped++;
    continue;
  }

  const content = combined[ts];
  if (!content) {
    console.log(`NOT FOUND ts=${ts}: ${article.title}`);
    notFound++;
    continue;
  }

  await prisma.knowledgeArticle.update({
    where: { id: article.id },
    data: { content }
  });
  console.log(`UPDATED: ${article.title} (ts=${ts}, len=${content.length})`);
  updated++;
}

await prisma.$disconnect();
console.log(`\nDone: ${updated} updated, ${skipped} skipped, ${notFound} not found`);
