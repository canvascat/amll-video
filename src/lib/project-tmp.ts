import { mkdir } from "node:fs/promises";
import path from "node:path";

export const PROJECT_TMP_DIRNAME = "tmp";

export function projectTmpDir(cwd = process.cwd()): string {
  return path.resolve(cwd, PROJECT_TMP_DIRNAME);
}

export async function ensureProjectTmpDir(
  cwd = process.cwd(),
): Promise<string> {
  const dir = projectTmpDir(cwd);
  await mkdir(dir, { recursive: true });
  return dir;
}

export function withProjectTmpEnv(
  tmpDir: string,
  env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  return {
    ...env,
    TMPDIR: tmpDir,
    TMP: tmpDir,
    TEMP: tmpDir,
  };
}

export async function applyProjectTmp(cwd = process.cwd()): Promise<string> {
  const dir = await ensureProjectTmpDir(cwd);
  process.env.TMPDIR = dir;
  process.env.TMP = dir;
  process.env.TEMP = dir;
  return dir;
}
