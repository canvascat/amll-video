/** 把「作品: 乐章」形式的曲名拆开。流行歌名拆不开，调用方就按原来的单行标题画。 */

export type WorkProgram = {
  /** 冒号前的作品名，顺手收紧 `op. 120/ 1` 这种空格。 */
  work: string;
  /** 冒号后的乐章，保留罗马数字。 */
  movement: string;
  /** 乐章里的速度记号。没有就空着，界面继续显示 BPM 或破折号。 */
  tempo: string;
};

const ROMAN = /^(?:X|IX|IV|V?I{1,3})\.\s+/;
const TEMPO =
  /(?:Grave|Largo|Larghetto|Adagio|Andante|Andantino|Moderato|Allegretto|Allegro|Vivace|Presto|Prestissimo)/i;

export function splitWorkTitle(title: string): WorkProgram | null {
  const trimmed = title.trim();
  const colon = trimmed.search(/[:：]/);
  if (colon <= 0) return null;
  const work = tidyWork(trimmed.slice(0, colon));
  const movement = trimmed.slice(colon + 1).trim();
  if (!work || !movement) return null;
  if (!ROMAN.test(movement) && !TEMPO.test(movement)) return null;
  const body = movement.replace(ROMAN, "").trim();
  return {
    work,
    movement,
    tempo: TEMPO.test(body) ? body : "",
  };
}

function tidyWork(work: string): string {
  return work
    .replace(/\/\s+(\d)/g, "/$1")
    .replace(/\s+/g, " ")
    .trim();
}
