import { mkdirSync } from "node:fs";
import { resolve, join } from "node:path";

export const projectRoot = resolve(process.env.PROJECT_ROOT ?? process.cwd());
export const dataRoot = resolve(process.env.DATA_ROOT ?? join(projectRoot, "data"));
export const outputRoot = resolve(process.env.OUTPUT_ROOT ?? join(projectRoot, "output", "telegram-jobs"));
export const assetsRoot = resolve(process.env.ASSETS_ROOT ?? join(projectRoot, "assets"));
export const templatesRoot = resolve(process.env.TEMPLATES_ROOT ?? join(projectRoot, "templates"));

export function ensureAppDirectories(): void {
  mkdirSync(dataRoot, { recursive: true });
  mkdirSync(outputRoot, { recursive: true });
}
