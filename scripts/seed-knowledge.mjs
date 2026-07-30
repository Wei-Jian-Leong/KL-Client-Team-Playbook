import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ARTICLES = [
  { category:"GD",  title:"Unconfirm Order", date:"5/10/2025", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1746894736048059" },
  { category:"COS", title:"Phone number show when transfer call to resto manually", date:"5/18/2025", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1747616760274689" },
  { category:"GD",  title:"Mistake Guideline", date:"8/7/2025", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1754601005027909" },
  { category:"COS", title:"CRT Manager call process", date:"8/15/2025", slackLink:"https://wonderscorp.slack.com/archives/C06UEAVBFPZ/p1755302700955539" },
  { category:"GD",  title:"Agent process for void order request", date:"9/5/2025", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1757088795673539" },
  { category:"CMA", title:"Special Hour", date:"9/15/2025", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1757982922514859" },
  { category:"GD",  title:"Handling Mistakes Assigned to Agents", date:"10/2/2025", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1759447841132599" },
  { category:"COS", title:"COS Outbound call process", date:"10/3/2025", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1759505614689489" },
  { category:"COS", title:"Opening Spiel for each call type", date:"10/4/2025", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1759606982351899" },
  { category:"GD",  title:"Tap Pay VS Tap to Pay", date:"10/10/2025", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1760131696012829" },
  { category:"COS", title:"AI Rush CX", date:"10/12/2025", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1760292000828129" },
  { category:"COS", title:"Tarro Pay Terminal", date:"10/15/2025", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1760565095605419" },
  { category:"DE",  title:"DE Contact Driver", date:"10/17/2025", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1760728860868339" },
  { category:"COS", title:"Voiding Ticket Due to Agent Mistake", date:"10/17/2025", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1760734088405239" },
  { category:"COS", title:"Upload Menu in CMA", date:"10/18/2025", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1760773157966199" },
  { category:"GD",  title:"Free Fortune Cookies", date:"10/23/2025", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1761249485571139" },
  { category:"COS", title:"Menu Key Info", date:"10/23/2025", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1761243082658519" },
  { category:"COS", title:"CSM Intercom Back Office Ticket Intent", date:"10/23/2025", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1761269492636419" },
  { category:"CMA", title:"Disable Online Order/Reservation", date:"10/23/2025", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1761247308904959" },
  { category:"COS", title:"Menu Change Subintent", date:"11/6/2025", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1762446791740109" },
  { category:"DE",  title:"DE Future Order", date:"11/12/2025", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1762972060021969" },
  { category:"COS", title:"Support Ticket", date:"11/12/2025", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1762998898234809" },
  { category:"COS", title:"3-Way call", date:"11/19/2025", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1763581590622559" },
  { category:"CMA", title:"Menu Price Editor", date:"11/19/2025", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1763585846021289" },
  { category:"DE",  title:"DE Reorder Driver", date:"11/20/2025", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1763658944056859" },
  { category:"CMA", title:"Stock Availability for CL", date:"11/20/2025", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1763658068480659" },
  { category:"CMA", title:"Void Order improvement", date:"12/3/2025", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1764797929580019" },
  { category:"COS", title:"No caller ID", date:"12/6/2025", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1765057931164329" },
  { category:"COS", title:"Referal/Sales Call", date:"12/11/2025", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1765492410146389" },
  { category:"DE",  title:"Cancel DE driver", date:"12/13/2025", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1765672089697679" },
  { category:"GD",  title:"Buffet FAQ", date:"12/16/2025", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1765907291516979" },
  { category:"GD",  title:"Self Delivery Rush order", date:"12/17/2025", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1765999343207859" },
  { category:"GD",  title:"Popular Dish in GD", date:"12/27/2025", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1766897585158739", altLink:"https://wondersco.atlassian.net/wiki/spaces/PM/pages/4018110610/Client+Dashboard+FAQ" },
  { category:"CMA", title:"CMA Dashboard", date:"1/14/2026", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1768422075757649" },
  { category:"GD",  title:"AI Address Helper", date:"1/16/2026", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1768625853418109" },
  { category:"GD",  title:"Party Order Drawer", date:"1/30/2026", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1769826515881939" },
  { category:"GD",  title:"Coupon UI update", date:"1/30/2026", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1769826515881939" },
  { category:"GD",  title:"Undo Button available in GD", date:"1/30/2026", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1769826515881939" },
  { category:"COS", title:"Finance Intercom Backoffice Intend update", date:"1/31/2026", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1769883213187429" },
  { category:"DE",  title:"DE dropoff ETA on receipts", date:"2/5/2026", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1770336796895839" },
  { category:"COS", title:"TarroWeb inquiries", date:"2/10/2026", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1770781918782359" },
  { category:"COS", title:"TarroPay Terminal inquiries", date:"2/10/2026", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1770781442216539" },
  { category:"GD",  title:"CC number Masked in recording", date:"2/10/2026", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1770784749687379" },
  { category:"GD",  title:"Pack in separate bags", date:"2/10/2026", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1770784749687379" },
  { category:"DE",  title:"DE cash order setup for specific time", date:"2/10/2026", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1770784749687379" },
  { category:"COS", title:"Fiery Crab Process update (T3 Resto)", date:"2/11/2026", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1770859149866229" },
  { category:"DE",  title:"DE Client Contribution setup", date:"2/15/2026", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1771210522983309" },
  { category:"DE",  title:"Remove Certain DSP Platform", date:"2/28/2026", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1772294401402099" },
  { category:"CMA", title:"CMA Order ticket UI", date:"3/2/2026", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1772508858850199" },
  { category:"CMA", title:"Credit Card payment Breakdown in daily report", date:"3/6/2026", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1772818636981519" },
  { category:"COS", title:"Reject any translate request", date:"3/12/2026", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1773342002563969" },
  { category:"COS", title:"Resto Hour Change selection in Intercom", date:"3/13/2026", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1773414009831479" },
  { category:"COS", title:"TarroPay FAQ", date:"3/20/2026", slackLink:"https://wondersco.atlassian.net/wiki/x/CYDn_w" },
  { category:"DE",  title:"DE Timeline", date:"3/30/2026", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1774889153122589" },
  { category:"GD",  title:"Percentage-Based Owed Credits", date:"3/31/2026", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1774969238444229" },
  { category:"COS", title:"Adyen Payment Timeline", date:"4/1/2026", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1775058686661009" },
  { category:"GD",  title:"VP Agent Location Inquiries and Pranks Call Process", date:"4/8/2026", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1775666937127749" },
  { category:"GD",  title:"Dish Code Sizes vs. Variant Prompt", date:"4/8/2026", slackLink:"https://wonderscorp.slack.com/archives/C06UEAVBFPZ/p1775696735162559" },
  { category:"COS", title:"Improvements to modify order receipts", date:"4/8/2026", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1775659535915659" },
  { category:"CMA", title:"Blocked Customer", date:"4/11/2026", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1775919601143739" },
  { category:"CMA", title:"Print Driver Report from Driver Management", date:"4/11/2026", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1775921400264029" },
  { category:"COS", title:"Variant Pricing & Availability by Order Type (Pickup vs. Delivery)", date:"4/16/2026", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1776391150864999" },
  { category:"CMA", title:"Restricted financials view for PIN User", date:"4/16/2026", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1776388720394259" },
  { category:"GD",  title:"Dish Help UI/UX Redesign", date:"4/19/2026", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1776623351663779" },
  { category:"GD",  title:"Replace Item", date:"4/19/2026", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1776624211212419" },
  { category:"CMA", title:"Per-delivery pay setting for Tarro driver management", date:"4/19/2026", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1777260101883969" },
  { category:"GD",  title:"Delivery Address Enhancements", date:"4/26/2026", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1777259315568189" },
  { category:"GD",  title:"Pass-through caller customer standing setting", date:"4/28/2026", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1777409155251349" },
  { category:"DE",  title:"Out of ranged (>5 miles) will show on receipt", date:"5/6/2026", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1778117346138619" },
  { category:"GD",  title:"Synced Audio + Screen Playback in Call Recording Review", date:"5/6/2026", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1778123761095709" },
  { category:"GD",  title:"Dish Total on Hover", date:"5/24/2026", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1779658573702939" },
  { category:"CMA", title:"Quote Time Base on Dish Size", date:"5/24/2026", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1779659283873459" },
  { category:"CMA", title:"Stock Availability Editor: Bulk variant editing", date:"5/24/2026", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1779660327277879" },
  { category:"CMA", title:"Block Anonymous Callers", date:"5/28/2026", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1780012188685749" },
  { category:"GD",  title:"No Baby Shrimp with Jumbo Shrimp Agent process", date:"5/29/2026", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1780100410100789" },
  { category:"CMA", title:"Default Pickup Spiel can be setup in CMA", date:"6/2/2026", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1780436017876069" },
  { category:"GD",  title:"Prompt will show when agent edit primary phone number", date:"6/7/2026", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1780868838855379" },
  { category:"CMA", title:"Encourage CL Self Serve Call Driver in CMA", date:"6/17/2026", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1781749808650409" },
  { category:"CMA", title:"Setup Cash Discount in CMA (By Menu Team)", date:"6/18/2026", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1781819670069249" },
  { category:"GD",  title:"Receipt Format update for existing order", date:"6/18/2026", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1781813874539759" },
  // Archived (Removed from playbook)
  { category:"COS", title:"AI Call Summary", date:"12/4/2025", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1764890673129539", isArchived: true },
  { category:"DE",  title:"DE PRO (Switch SD to DE after 20 minutes)", date:"1/14/2026", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1768421867598429", isArchived: true },
  { category:"DE",  title:"DE late order compensation", date:"12/13/2025", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1770336796895839", isArchived: true },
  { category:"COS", title:"Intercom Chat (COS II/COSIII) Do not handle Pizza resto", date:"2/11/2026", slackLink:"https://wonderscorp.slack.com/archives/C0710M7JDJA/p1770825613519449", isArchived: true },
];

async function main() {
  const existing = await prisma.knowledgeArticle.count();
  if (existing > 0) {
    console.log("Already seeded:", existing, "articles");
    return;
  }
  for (const a of ARTICLES) {
    await prisma.knowledgeArticle.create({
      data: {
        category: a.category,
        title: a.title,
        date: a.date,
        slackLink: a.slackLink || null,
        altLink: a.altLink || null,
        isArchived: a.isArchived || false,
        archivedAt: a.isArchived ? new Date() : null,
      },
    });
  }
  console.log("Seeded", ARTICLES.length, "articles");
}

main().catch(console.error).finally(() => prisma.$disconnect());
