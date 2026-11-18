/**
 * Lightweight filter for custom messages between friends. It is a first line
 * of defense only; block and report handle the rest.
 */
const BLOCKED = [
  "fuck", "shit", "bitch", "bastard", "asshole", "dick", "pussy", "cunt", "slut", "whore",
  "nigger", "nigga", "faggot", "retard", "kill yourself", "kys",
];

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[0@]/g, "o")
    .replace(/[1!|]/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/[$5]/g, "s")
    .replace(/[^a-z\s]/g, "");

// Whole words plus common endings, so "Dickens" or "Scunthorpe" pass.
const PATTERNS = BLOCKED.map((w) => ({ w, re: new RegExp(`\\b${w}(s|es|ed|er|ers|ing|y)?\\b`) }));

export function isAllowedMessage(text: string): boolean {
  // Join spaced-out single letters ("f u c k" -> "fuck") before matching.
  const n = normalize(text).replace(/\b([a-z])\s+(?=[a-z]\b)/g, "$1");
  const squashed = n.replace(/\s+/g, "");
  return !PATTERNS.some(({ w, re }) => (w.includes(" ") ? n.includes(w) : re.test(n) || (w.length >= 5 && squashed.includes(w))));
}
