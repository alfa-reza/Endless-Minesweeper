const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function randomSeedLabel(): string {
  let out = "";
  for (let i = 0; i < 8; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

export function dailySeedLabel(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `DAILY-${y}-${m}-${d}`;
}
