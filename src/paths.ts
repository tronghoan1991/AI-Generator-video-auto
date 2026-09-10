import { mkdirSync } from "node:fs";
import { resolve, join } from "node:path";

export const projectRoot = resolve(process.env.PROJECT_ROOT ?? process.cwd());
export const dataRoot = join(projectRoot, "data");
export const outputRoot = join(projectRoot, "output", "telegram-jobs");

export function ensureAppDirectories(): void {
  mkdirSync(dataRoot, { recursive: true });
  mkdirSync(outputRoot, { recursive: true });
}
