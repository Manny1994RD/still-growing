/**
 * Encouragement library. Scripture is quoted from the World English Bible
 * (public domain). `{name}` is replaced with the user's first name.
 */

export interface Verse {
  ref: string;
  text: string;
}

export const VERSES: Verse[] = [
  { ref: "2 Corinthians 5:17", text: "If anyone is in Christ, he is a new creation. The old things have passed away. Behold, all things have become new." },
  { ref: "Lamentations 3:22–23", text: "His mercies don't fail. They are new every morning. Great is your faithfulness." },
  { ref: "Philippians 4:13", text: "I can do all things through Christ, who strengthens me." },
  { ref: "Isaiah 41:10", text: "Don't you be afraid, for I am with you. Don't be dismayed, for I am your God. I will strengthen you." },
  { ref: "Joshua 1:9", text: "Be strong and courageous. Don't be afraid. Don't be dismayed, for Yahweh your God is with you wherever you go." },
  { ref: "Galatians 6:9", text: "Let's not be weary in doing good, for we will reap in due season, if we don't give up." },
  { ref: "Philippians 1:6", text: "He who began a good work in you will complete it until the day of Jesus Christ." },
  { ref: "Psalm 46:1", text: "God is our refuge and strength, a very present help in trouble." },
  { ref: "Matthew 11:28", text: "Come to me, all you who labor and are heavily burdened, and I will give you rest." },
  { ref: "Psalm 119:105", text: "Your word is a lamp to my feet, and a light for my path." },
  { ref: "Isaiah 40:31", text: "Those who wait for Yahweh will renew their strength. They will run, and not be weary. They will walk, and not faint." },
  { ref: "Zephaniah 3:17", text: "Yahweh, your God, is among you, a mighty one who will save. He will rejoice over you with joy." },
  { ref: "Proverbs 16:3", text: "Commit your deeds to Yahweh, and your plans shall succeed." },
  { ref: "1 Peter 5:7", text: "Casting all your worries on him, because he cares for you." },
  { ref: "Romans 12:2", text: "Don't be conformed to this world, but be transformed by the renewing of your mind." },
  { ref: "Romans 8:1", text: "There is therefore now no condemnation to those who are in Christ Jesus." },
  { ref: "Galatians 5:1", text: "Stand firm therefore in the liberty by which Christ has made us free." },
  { ref: "Hebrews 12:1", text: "Let's run with perseverance the race that is set before us." },
];

export type MessageType = "morning" | "checkin" | "grace" | "milestone" | "evening" | "slip";

export interface Message {
  id: string;
  type: MessageType;
  category?: string;
  text: string;
  ref?: string;
}

export const MESSAGES: Message[] = [
  // Morning blessings
  { id: "m01", type: "morning", text: "Good morning, {name}. You are a new creation today.", ref: "2 Corinthians 5:17" },
  { id: "m02", type: "morning", text: "His mercies are new this morning, {name}. So is your chance to grow.", ref: "Lamentations 3:22–23" },
  { id: "m03", type: "morning", text: "God goes with you into this day. One faithful step at a time.", ref: "Joshua 1:9" },
  { id: "m04", type: "morning", text: "You are still growing, {name}. And He is not finished with you.", ref: "Philippians 1:6" },
  { id: "m05", type: "morning", text: "Whatever today holds, you don't hold it alone.", ref: "Isaiah 41:10" },
  { id: "m06", type: "morning", text: "Start small today. Small and faithful is how roots grow." },
  { id: "m07", type: "morning", text: "He rejoices over you, {name}. Walk in that today.", ref: "Zephaniah 3:17" },

  // Check-in (general)
  { id: "c01", type: "checkin", text: "Well done. That's who you're becoming." },
  { id: "c02", type: "checkin", text: "One more step of faith. It counts.", ref: "Galatians 6:9" },
  { id: "c03", type: "checkin", text: "Faithful in little things. Keep going, {name}." },
  { id: "c04", type: "checkin", text: "You showed up. God sees it." },
  { id: "c05", type: "checkin", text: "Growth is quiet. You just grew.", ref: "Philippians 4:13" },
  { id: "c06", type: "checkin", text: "Strength renewed. On to the next one.", ref: "Isaiah 40:31" },

  // Check-in by category
  { id: "f01", type: "checkin", category: "faith", text: "Time in His word is never wasted.", ref: "Psalm 119:105" },
  { id: "f02", type: "checkin", category: "faith", text: "You made room for God today. That's everything." },
  { id: "ch1", type: "checkin", category: "church", text: "Together is better. Thank you for showing up." },
  { id: "o01", type: "checkin", category: "outreach", text: "Your light is shining, {name}." },
  { id: "h01", type: "checkin", category: "health", text: "Your body is a temple. You just honored it." },
  { id: "h02", type: "checkin", category: "health", text: "Small choices, real care. Well done." },
  { id: "x01", type: "checkin", category: "fitness", text: "Strong body, steady heart. Nice work." },
  { id: "x02", type: "checkin", category: "fitness", text: "You moved today. Run your race.", ref: "Hebrews 12:1" },
  { id: "r01", type: "checkin", category: "rest", text: "Rest is holy too. Well done.", ref: "Matthew 11:28" },
  { id: "fr1", type: "checkin", category: "freedom", text: "Still free today. His strength is in you.", ref: "Galatians 5:1" },
  { id: "fr2", type: "checkin", category: "freedom", text: "Another day of freedom. Stand firm, {name}." },
  { id: "mi1", type: "checkin", category: "mind", text: "A renewed mind is a growing mind.", ref: "Romans 12:2" },
  { id: "re1", type: "checkin", category: "relationships", text: "Love well. You just did." },
  { id: "st1", type: "checkin", category: "stewardship", text: "Faithful with little, trusted with much." },

  // Grace (missed a day)
  { id: "g01", type: "grace", text: "Yesterday doesn't define you. His mercies are new this morning.", ref: "Lamentations 3:22–23" },
  { id: "g02", type: "grace", text: "Grace covered yesterday, {name}. Keep walking." },
  { id: "g03", type: "grace", text: "You're not behind. You're still growing." },

  // Slip (refrain habit)
  { id: "s01", type: "slip", text: "One moment doesn't undo your progress. There is no condemnation in Christ.", ref: "Romans 8:1" },
  { id: "s02", type: "slip", text: "Get back up, {name}. He is still for you.", ref: "Psalm 46:1" },

  // Evening
  { id: "e01", type: "evening", text: "How did today go? Take a quiet minute with God." },
  { id: "e02", type: "evening", text: "Lay today down, {name}. He cares for you.", ref: "1 Peter 5:7" },

  // Milestones
  { id: "ms1", type: "milestone", text: "That's not luck, {name}. That's who you are now." },
  { id: "ms2", type: "milestone", text: "Look how far you've come. Keep going.", ref: "Galatians 6:9" },
];

export const MILESTONES = [3, 7, 21, 40, 100, 365];

/** Deterministic verse for a given date so everyone sees the same verse of the day. */
export function verseOfDay(date: string): Verse {
  let h = 0;
  for (const ch of date) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return VERSES[h % VERSES.length]!;
}

export function pickMessage(type: MessageType, opts: { category?: string; name?: string; seed?: number } = {}): Message {
  const byCategory = opts.category
    ? MESSAGES.filter((m) => m.type === type && m.category === opts.category)
    : [];
  const general = MESSAGES.filter((m) => m.type === type && !m.category);
  // Prefer a category message about half the time so general words still appear.
  const seed = opts.seed ?? Math.floor(Math.random() * 1e9);
  const pool = byCategory.length && seed % 2 === 0 ? byCategory : general.length ? general : byCategory;
  const m = pool[seed % pool.length]!;
  const name = opts.name?.trim() || "friend";
  return { ...m, text: m.text.replaceAll("{name}", name) };
}
