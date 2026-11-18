/**
 * Encouragement library in English and Spanish.
 * English scripture: World English Bible (public domain).
 * Spanish scripture: Reina-Valera 1909 (public domain), with modern accents.
 * `{name}` is replaced with the user's first name. Items share ids across
 * languages so a blessing sent in one language is shown in the reader's own.
 */

export const LANGUAGES = ["en", "es"] as const;
export type Lang = (typeof LANGUAGES)[number];
export const asLang = (v: unknown): Lang => (v === "es" ? "es" : "en");

export interface Verse {
  id: string;
  ref: string;
  text: string;
}

export type MessageType = "morning" | "checkin" | "grace" | "milestone" | "evening" | "slip";

export interface Message {
  id: string;
  type: MessageType;
  category?: string;
  text: string;
  ref?: string;
}

export interface Blessing {
  id: string;
  text: string;
  ref?: string;
}

// ---------- verses (id = English reference) ----------
const VERSES_EN: Verse[] = [
  { id: "2 Corinthians 5:17", ref: "2 Corinthians 5:17", text: "If anyone is in Christ, he is a new creation. The old things have passed away. Behold, all things have become new." },
  { id: "Lamentations 3:22–23", ref: "Lamentations 3:22–23", text: "His mercies don't fail. They are new every morning. Great is your faithfulness." },
  { id: "Philippians 4:13", ref: "Philippians 4:13", text: "I can do all things through Christ, who strengthens me." },
  { id: "Isaiah 41:10", ref: "Isaiah 41:10", text: "Don't you be afraid, for I am with you. Don't be dismayed, for I am your God. I will strengthen you." },
  { id: "Joshua 1:9", ref: "Joshua 1:9", text: "Be strong and courageous. Don't be afraid. Don't be dismayed, for Yahweh your God is with you wherever you go." },
  { id: "Galatians 6:9", ref: "Galatians 6:9", text: "Let's not be weary in doing good, for we will reap in due season, if we don't give up." },
  { id: "Philippians 1:6", ref: "Philippians 1:6", text: "He who began a good work in you will complete it until the day of Jesus Christ." },
  { id: "Psalm 46:1", ref: "Psalm 46:1", text: "God is our refuge and strength, a very present help in trouble." },
  { id: "Matthew 11:28", ref: "Matthew 11:28", text: "Come to me, all you who labor and are heavily burdened, and I will give you rest." },
  { id: "Psalm 119:105", ref: "Psalm 119:105", text: "Your word is a lamp to my feet, and a light for my path." },
  { id: "Isaiah 40:31", ref: "Isaiah 40:31", text: "Those who wait for Yahweh will renew their strength. They will run, and not be weary. They will walk, and not faint." },
  { id: "Zephaniah 3:17", ref: "Zephaniah 3:17", text: "Yahweh, your God, is among you, a mighty one who will save. He will rejoice over you with joy." },
  { id: "Proverbs 16:3", ref: "Proverbs 16:3", text: "Commit your deeds to Yahweh, and your plans shall succeed." },
  { id: "1 Peter 5:7", ref: "1 Peter 5:7", text: "Casting all your worries on him, because he cares for you." },
  { id: "Romans 12:2", ref: "Romans 12:2", text: "Don't be conformed to this world, but be transformed by the renewing of your mind." },
  { id: "Romans 8:1", ref: "Romans 8:1", text: "There is therefore now no condemnation to those who are in Christ Jesus." },
  { id: "Galatians 5:1", ref: "Galatians 5:1", text: "Stand firm therefore in the liberty by which Christ has made us free." },
  { id: "Hebrews 12:1", ref: "Hebrews 12:1", text: "Let's run with perseverance the race that is set before us." },
];

const VERSES_ES: Verse[] = [
  { id: "2 Corinthians 5:17", ref: "2 Corintios 5:17", text: "De modo que si alguno está en Cristo, nueva criatura es: las cosas viejas pasaron; he aquí todas son hechas nuevas." },
  { id: "Lamentations 3:22–23", ref: "Lamentaciones 3:22–23", text: "Nunca decayeron sus misericordias. Nuevas son cada mañana; grande es tu fidelidad." },
  { id: "Philippians 4:13", ref: "Filipenses 4:13", text: "Todo lo puedo en Cristo que me fortalece." },
  { id: "Isaiah 41:10", ref: "Isaías 41:10", text: "No temas, que yo soy contigo; no desmayes, que yo soy tu Dios que te esfuerzo: siempre te ayudaré." },
  { id: "Joshua 1:9", ref: "Josué 1:9", text: "Mira que te mando que te esfuerces y seas valiente: no temas ni desmayes, porque Jehová tu Dios será contigo en dondequiera que fueres." },
  { id: "Galatians 6:9", ref: "Gálatas 6:9", text: "No nos cansemos, pues, de hacer bien; que a su tiempo segaremos, si no hubiéremos desmayado." },
  { id: "Philippians 1:6", ref: "Filipenses 1:6", text: "El que comenzó en vosotros la buena obra, la perfeccionará hasta el día de Jesucristo." },
  { id: "Psalm 46:1", ref: "Salmos 46:1", text: "Dios es nuestro amparo y fortaleza, nuestro pronto auxilio en las tribulaciones." },
  { id: "Matthew 11:28", ref: "Mateo 11:28", text: "Venid a mí todos los que estáis trabajados y cargados, que yo os haré descansar." },
  { id: "Psalm 119:105", ref: "Salmos 119:105", text: "Lámpara es a mis pies tu palabra, y lumbrera a mi camino." },
  { id: "Isaiah 40:31", ref: "Isaías 40:31", text: "Mas los que esperan a Jehová tendrán nuevas fuerzas; correrán, y no se cansarán; caminarán, y no se fatigarán." },
  { id: "Zephaniah 3:17", ref: "Sofonías 3:17", text: "Jehová en medio de ti, poderoso, él salvará; se gozará sobre ti con alegría." },
  { id: "Proverbs 16:3", ref: "Proverbios 16:3", text: "Encomienda a Jehová tus obras, y tus pensamientos serán afirmados." },
  { id: "1 Peter 5:7", ref: "1 Pedro 5:7", text: "Echando toda vuestra solicitud en él, porque él tiene cuidado de vosotros." },
  { id: "Romans 12:2", ref: "Romanos 12:2", text: "No os conforméis a este siglo; mas reformaos por la renovación de vuestro entendimiento." },
  { id: "Romans 8:1", ref: "Romanos 8:1", text: "Ahora pues, ninguna condenación hay para los que están en Cristo Jesús." },
  { id: "Galatians 5:1", ref: "Gálatas 5:1", text: "Estad, pues, firmes en la libertad con que Cristo nos hizo libres." },
  { id: "Hebrews 12:1", ref: "Hebreos 12:1", text: "Corramos con paciencia la carrera que nos es propuesta." },
];

// ---------- messages ----------
const MESSAGES_EN: Message[] = [
  { id: "m01", type: "morning", text: "Good morning, {name}. You are a new creation today.", ref: "2 Corinthians 5:17" },
  { id: "m02", type: "morning", text: "His mercies are new this morning, {name}. So is your chance to grow.", ref: "Lamentations 3:22–23" },
  { id: "m03", type: "morning", text: "God goes with you into this day. One faithful step at a time.", ref: "Joshua 1:9" },
  { id: "m04", type: "morning", text: "You are still growing, {name}. And He is not finished with you.", ref: "Philippians 1:6" },
  { id: "m05", type: "morning", text: "Whatever today holds, you don't hold it alone.", ref: "Isaiah 41:10" },
  { id: "m06", type: "morning", text: "Start small today. Small and faithful is how roots grow." },
  { id: "m07", type: "morning", text: "He rejoices over you, {name}. Walk in that today.", ref: "Zephaniah 3:17" },

  { id: "c01", type: "checkin", text: "Well done. That's who you're becoming." },
  { id: "c02", type: "checkin", text: "One more step of faith. It counts.", ref: "Galatians 6:9" },
  { id: "c03", type: "checkin", text: "Faithful in little things. Keep going, {name}." },
  { id: "c04", type: "checkin", text: "You showed up. God sees it." },
  { id: "c05", type: "checkin", text: "Growth is quiet. You just grew.", ref: "Philippians 4:13" },
  { id: "c06", type: "checkin", text: "Strength renewed. On to the next one.", ref: "Isaiah 40:31" },

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

  { id: "g01", type: "grace", text: "Yesterday doesn't define you. His mercies are new this morning.", ref: "Lamentations 3:22–23" },
  { id: "g02", type: "grace", text: "Grace covered yesterday, {name}. Keep walking." },
  { id: "g03", type: "grace", text: "You're not behind. You're still growing." },

  { id: "s01", type: "slip", text: "One moment doesn't undo your progress. There is no condemnation in Christ.", ref: "Romans 8:1" },
  { id: "s02", type: "slip", text: "Get back up, {name}. He is still for you.", ref: "Psalm 46:1" },

  { id: "e01", type: "evening", text: "How did today go? Take a quiet minute with God." },
  { id: "e02", type: "evening", text: "Lay today down, {name}. He cares for you.", ref: "1 Peter 5:7" },

  { id: "ms1", type: "milestone", text: "That's not luck, {name}. That's who you are now." },
  { id: "ms2", type: "milestone", text: "Look how far you've come. Keep going.", ref: "Galatians 6:9" },
];

const MESSAGES_ES: Message[] = [
  { id: "m01", type: "morning", text: "Buenos días, {name}. Hoy eres una nueva criatura.", ref: "2 Corintios 5:17" },
  { id: "m02", type: "morning", text: "Sus misericordias son nuevas esta mañana, {name}. También tu oportunidad de crecer.", ref: "Lamentaciones 3:22–23" },
  { id: "m03", type: "morning", text: "Dios va contigo en este día. Un paso fiel a la vez.", ref: "Josué 1:9" },
  { id: "m04", type: "morning", text: "Sigues creciendo, {name}. Y Él no ha terminado contigo.", ref: "Filipenses 1:6" },
  { id: "m05", type: "morning", text: "Lo que traiga el día de hoy, no lo cargas solo.", ref: "Isaías 41:10" },
  { id: "m06", type: "morning", text: "Empieza con algo pequeño. Así crecen las raíces: poco a poco y con fidelidad." },
  { id: "m07", type: "morning", text: "Él se goza sobre ti, {name}. Camina en eso hoy.", ref: "Sofonías 3:17" },

  { id: "c01", type: "checkin", text: "¡Bien hecho! En eso te estás convirtiendo." },
  { id: "c02", type: "checkin", text: "Un paso más de fe. Cuenta.", ref: "Gálatas 6:9" },
  { id: "c03", type: "checkin", text: "Fiel en lo poco. Sigue adelante, {name}." },
  { id: "c04", type: "checkin", text: "Te presentaste. Dios lo ve." },
  { id: "c05", type: "checkin", text: "El crecimiento es silencioso. Acabas de crecer.", ref: "Filipenses 4:13" },
  { id: "c06", type: "checkin", text: "Fuerzas renovadas. Vamos por el siguiente.", ref: "Isaías 40:31" },

  { id: "f01", type: "checkin", category: "faith", text: "El tiempo en Su palabra nunca es tiempo perdido.", ref: "Salmos 119:105" },
  { id: "f02", type: "checkin", category: "faith", text: "Hoy le hiciste espacio a Dios. Eso lo es todo." },
  { id: "ch1", type: "checkin", category: "church", text: "Juntos es mejor. Gracias por estar presente." },
  { id: "o01", type: "checkin", category: "outreach", text: "Tu luz está brillando, {name}." },
  { id: "h01", type: "checkin", category: "health", text: "Tu cuerpo es templo. Acabas de honrarlo." },
  { id: "h02", type: "checkin", category: "health", text: "Pequeñas decisiones, cuidado real. ¡Bien hecho!" },
  { id: "x01", type: "checkin", category: "fitness", text: "Cuerpo fuerte, corazón firme. ¡Buen trabajo!" },
  { id: "x02", type: "checkin", category: "fitness", text: "Hoy te moviste. Corre tu carrera.", ref: "Hebreos 12:1" },
  { id: "r01", type: "checkin", category: "rest", text: "Descansar también es santo. ¡Bien hecho!", ref: "Mateo 11:28" },
  { id: "fr1", type: "checkin", category: "freedom", text: "Hoy sigues libre. Su fuerza está en ti.", ref: "Gálatas 5:1" },
  { id: "fr2", type: "checkin", category: "freedom", text: "Otro día de libertad. Mantente firme, {name}." },
  { id: "mi1", type: "checkin", category: "mind", text: "Una mente renovada es una mente que crece.", ref: "Romanos 12:2" },
  { id: "re1", type: "checkin", category: "relationships", text: "Ama bien. Acabas de hacerlo." },
  { id: "st1", type: "checkin", category: "stewardship", text: "Fiel en lo poco, de confianza en lo mucho." },

  { id: "g01", type: "grace", text: "El día de ayer no te define. Sus misericordias son nuevas esta mañana.", ref: "Lamentaciones 3:22–23" },
  { id: "g02", type: "grace", text: "La gracia cubrió el día de ayer, {name}. Sigue caminando." },
  { id: "g03", type: "grace", text: "No estás atrasado. Sigues creciendo." },

  { id: "s01", type: "slip", text: "Un momento no deshace tu progreso. No hay condenación en Cristo.", ref: "Romanos 8:1" },
  { id: "s02", type: "slip", text: "Levántate, {name}. Él sigue de tu lado.", ref: "Salmos 46:1" },

  { id: "e01", type: "evening", text: "¿Cómo te fue hoy? Toma un minuto tranquilo con Dios." },
  { id: "e02", type: "evening", text: "Entrégale el día de hoy, {name}. Él tiene cuidado de ti.", ref: "1 Pedro 5:7" },

  { id: "ms1", type: "milestone", text: "Eso no es suerte, {name}. Eso es quien eres ahora." },
  { id: "ms2", type: "milestone", text: "Mira cuánto has avanzado. Sigue adelante.", ref: "Gálatas 6:9" },
];

// ---------- blessings friends can send ----------
const BLESSINGS_EN: Blessing[] = [
  { id: "b01", text: "Keep going. God is with you." },
  { id: "b02", text: "Proud of you. You're growing." },
  { id: "b03", text: "His mercies are new this morning.", ref: "Lamentations 3:22–23" },
  { id: "b04", text: "Don't give up. You'll reap in due season.", ref: "Galatians 6:9" },
  { id: "b05", text: "You're not alone in this." },
  { id: "b06", text: "I'm thankful for you." },
  { id: "b07", text: "Be strong and courageous.", ref: "Joshua 1:9" },
  { id: "b08", text: "He who began a good work in you will finish it.", ref: "Philippians 1:6" },
  { id: "b09", text: "One step at a time. You've got this." },
  { id: "b10", text: "Rest in Him today.", ref: "Matthew 11:28" },
];

const BLESSINGS_ES: Blessing[] = [
  { id: "b01", text: "Sigue adelante. Dios está contigo." },
  { id: "b02", text: "Estoy orgulloso de ti. Estás creciendo." },
  { id: "b03", text: "Sus misericordias son nuevas esta mañana.", ref: "Lamentaciones 3:22–23" },
  { id: "b04", text: "No te rindas. A su tiempo segarás.", ref: "Gálatas 6:9" },
  { id: "b05", text: "No estás solo en esto." },
  { id: "b06", text: "Doy gracias a Dios por ti." },
  { id: "b07", text: "Esfuérzate y sé valiente.", ref: "Josué 1:9" },
  { id: "b08", text: "El que comenzó la buena obra en ti la terminará.", ref: "Filipenses 1:6" },
  { id: "b09", text: "Un paso a la vez. Tú puedes." },
  { id: "b10", text: "Descansa en Él hoy.", ref: "Mateo 11:28" },
];

const CONTENT = {
  en: { verses: VERSES_EN, messages: MESSAGES_EN, blessings: BLESSINGS_EN, friend: "friend" },
  es: { verses: VERSES_ES, messages: MESSAGES_ES, blessings: BLESSINGS_ES, friend: "amigo" },
} as const;

export const content = (lang: Lang) => CONTENT[lang];

// Backwards-compatible English exports.
export const VERSES = VERSES_EN;
export const MESSAGES = MESSAGES_EN;
export const BLESSINGS = BLESSINGS_EN;

export const MILESTONES = [3, 7, 21, 40, 100, 365];

/** Deterministic verse for a date so everyone sees the same verse of the day. */
export function verseOfDay(date: string, lang: Lang = "en"): Verse {
  let h = 0;
  for (const ch of date) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const list = CONTENT[lang].verses;
  return list[h % list.length]!;
}

export function pickMessage(
  type: MessageType,
  opts: { category?: string; name?: string; seed?: number; lang?: Lang } = {},
): Message {
  const lang = opts.lang ?? "en";
  const all = CONTENT[lang].messages;
  const byCategory = opts.category ? all.filter((m) => m.type === type && m.category === opts.category) : [];
  const general = all.filter((m) => m.type === type && !m.category);
  // Prefer a category message about half the time so general words still appear.
  const seed = opts.seed ?? Math.floor(Math.random() * 1e9);
  const pool = byCategory.length && seed % 2 === 0 ? byCategory : general.length ? general : byCategory;
  const m = pool[seed % pool.length]!;
  const name = opts.name?.trim() || CONTENT[lang].friend;
  return { ...m, text: m.text.replaceAll("{name}", name) };
}

/** Re-render a stored blessing/verse in the reader's language. */
export function localizeTemplate(type: string, templateId: string | null, lang: Lang): { text: string; ref: string | null } | null {
  if (!templateId) return null;
  if (type === "verse") {
    const v = CONTENT[lang].verses.find((x) => x.id === templateId);
    return v ? { text: v.text, ref: v.ref } : null;
  }
  if (type === "message") {
    const b = CONTENT[lang].blessings.find((x) => x.id === templateId);
    return b ? { text: b.text, ref: b.ref ?? null } : null;
  }
  return null;
}
