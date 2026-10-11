const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function randomSeedLabel(): string {
  let out = "";
  for (let i = 0; i < 8; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}
