import { readdirSync } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import {
  isCuePath,
  parseCueSheet,
  resolveCueAudioPath,
  resolveCueCoverPath,
} from "./cue";
import { fileStem } from "./write-materials";

export const PREPARE_DIRNAME = "预处理";

const LYRIC_EXTS = [".lrc", ".ttml", ".yrc", ".qrc", ".lys"] as const;
const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".gif"] as const;
const COVER_NAMES = ["cover", "folder", "front", "Cover", "Folder", "Front"] as const;

export function prepareWorkDir(sourcePath: string, root = process.cwd()): string {
  const sourceDir = path.dirname(path.resolve(sourcePath));
  return path.join(path.resolve(root), PREPARE_DIRNAME, path.basename(sourceDir));
}

export function listRelatedFiles(inputPath: string): string[] {
  const source = path.resolve(inputPath);
  const dir = path.dirname(source);
  const stem = fileStem(source).toLowerCase();
  const wanted = new Set<string>();
  for (const ext of [...LYRIC_EXTS, ...IMAGE_EXTS]) {
    wanted.add(`${stem}${ext}`);
  }
  for (const name of COVER_NAMES) {
    for (const ext of IMAGE_EXTS) {
      wanted.add(`${name.toLowerCase()}${ext}`);
    }
  }

  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }

  return entries
    .filter((name) => {
      if (path.resolve(dir, name) === source) {
        return false;
      }
      return wanted.has(name.toLowerCase());
    })
    .map((name) => path.resolve(dir, name));
}

export async function stagePrepareInput(
  inputPath: string,
  root = process.cwd(),
): Promise<{ dir: string; inputPath: string }> {
  const source = path.resolve(inputPath);
  const dir = prepareWorkDir(source, root);
  await mkdir(dir, { recursive: true });

  const files = new Set<string>([source, ...listRelatedFiles(source)]);
  if (isCuePath(source)) {
    const sheet = await parseCueSheet(source);
    for (const track of sheet.tracks) {
      files.add(path.resolve(resolveCueAudioPath(sheet, track.file)));
    }
    const cover = resolveCueCoverPath(sheet);
    if (cover) {
      files.add(path.resolve(cover));
    }
  }

  let stagedInput = path.join(dir, path.basename(source));
  for (const file of files) {
    const dest = path.join(dir, path.basename(file));
    if (path.resolve(file) !== path.resolve(dest)) {
      await copyFile(file, dest);
    }
    if (path.resolve(file) === source) {
      stagedInput = dest;
    }
  }

  return { dir, inputPath: stagedInput };
}
