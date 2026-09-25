import path from "node:path";
import { writeAlbumSrt, formatSuspectedOffsets } from "./album-srt";
import { parseExportArgs, UsageError } from "./parse-args";
import { exportVideo, previewStudio } from "./render";

async function main() {
  try {
    const args = parseExportArgs(process.argv.slice(2));
    if (args.srt) {
      if (!args.config || path.extname(args.config).toLowerCase() !== ".cue") {
        throw new UsageError("字幕只接受整轨 .cue");
      }
      const written = await writeAlbumSrt({
        cuePath: args.config,
        outPath: args.out,
      });
      console.log(`已写出 ${written.srtPath}（${written.cueCount} 条，未写入偏移）`);
      console.log(formatSuspectedOffsets(written.suspected));
      return;
    }
    if (args.preview) {
      await previewStudio(args);
      return;
    }
    const output = await exportVideo(args);
    console.log(`已导出 ${output}`);
  } catch (error) {
    if (error instanceof UsageError) {
      const stream = error.exitCode === 0 ? console.log : console.error;
      stream(error.message);
      process.exit(error.exitCode);
    }
    console.error(
      error instanceof Error ? (error.stack ?? error.message) : error,
    );
    process.exit(1);
  }
}

void main();
