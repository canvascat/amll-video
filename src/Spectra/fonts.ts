import { loadFont as loadNotoSerif } from "@remotion/google-fonts/NotoSerifSC";
import { loadFont as loadSourceSerif } from "@remotion/google-fonts/SourceSerif4";

const LATIN = ["latin", "latin-ext"] as ["latin", "latin-ext"];

loadSourceSerif("normal", { weights: ["500"], subsets: LATIN });
loadSourceSerif("italic", { weights: ["400"], subsets: LATIN });

/** 作品名和乐章用的衬线。中文落到 Noto Serif SC，刻度和流行歌标题不使用它。 */
export const FONT_SERIF =
  '"Source Serif Four", "Noto Serif SC", "Songti SC", serif';

/** 曲名里有汉字时再加载简体子集，避免拉丁曲名也去下一百多个字重文件。 */
export function ensureCjkSerif(text: string) {
  if (/[\u3400-\u9fff]/.test(text)) {
    loadNotoSerif("normal", {
      weights: ["500"],
      subsets: ["chinese-simplified"],
    });
  }
}
