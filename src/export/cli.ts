import { exportVideo, previewStudio } from "./render";
import { parseExportArgs, UsageError } from "./parse-args";

async function main() {
  try {
    const args = parseExportArgs(process.argv.slice(2));
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
