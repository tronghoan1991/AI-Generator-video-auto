import { mkdirSync } from "node:fs";
import { resolve, join } from "node:path";

export const projectRoot = resolve(process.env.PROJECT_ROOT ?? process.cwd());
export const templatesRoot = join(projectRoot, "templates");
export const sfxRoot = join(projectRoot, "assets", "sfx");
export const dataRoot = resolve(process.env.APP_DATA_ROOT ?? join(projectRoot, "data"));
export const outputRoot = resolve(process.env.APP_OUTPUT_ROOT ?? join(projectRoot, "output", "telegram-jobs"));

export function ensureAppDirectories(): void {
  mkdirSync(dataRoot, { recursive: true });
  mkdirSync(outputRoot, { recursive: true });
}
