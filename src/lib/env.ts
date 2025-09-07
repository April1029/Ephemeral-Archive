export const ENV = {
  HF_TOKEN: process.env.HF_TOKEN,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  SQLITE_PATH: process.env.SQLITE_PATH,
};

export function assertEnv(keys: (keyof typeof ENV)[]) {
  const missing = keys.filter((k) => !ENV[k]);
  if (missing.length) throw new Error("Missing env: " + missing.join(", "));
}
