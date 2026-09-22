import assert from "node:assert/strict";
import { test } from "node:test";
import { parseYrc } from "@applemusic-like-lyrics/lyric";
import { decryptKrc, krcToYrc, prefersKugouKrc } from "./krc";

const CIPHERTEXT =
  "a3JjMTjb6kFqAkSXYAMBpXvjvlhCdWybQAVCntFu932Q2TndUQ/wfhqjfRPpuxr31lkebldH4ctL2w==";

test("decryptKrc 还原逐字文本", () => {
  const text = decryptKrc(CIPHERTEXT);
  assert.match(text, /\[1000,500\]<0,200,0>あ<200,300,0>い/);
});

test("krcToYrc 把行内偏移换成绝对时间", () => {
  const yrc = krcToYrc(
    "[1000,500]<0,200,0>あ<200,300,0>い\n[2000,400]<0,400,0>う\n",
  );
  const lines = parseYrc(yrc);
  assert.equal(lines[0]?.words[0]?.word, "あ");
  assert.equal(lines[0]?.words[0]?.startTime, 1000);
  assert.equal(lines[0]?.words[0]?.endTime, 1200);
  assert.equal(lines[0]?.words[1]?.word, "い");
  assert.equal(lines[0]?.words[1]?.startTime, 1200);
  assert.equal(lines[0]?.words[1]?.endTime, 1500);
  assert.equal(lines[1]?.words[0]?.startTime, 2000);
});

test("prefersKugouKrc 只在逐字候选上为真", () => {
  assert.equal(prefersKugouKrc({ krctype: 1, contenttype: 0 }), true);
  assert.equal(prefersKugouKrc({ krctype: 1 }), true);
  assert.equal(prefersKugouKrc({ krctype: 1, contenttype: 1 }), false);
  assert.equal(prefersKugouKrc({ krctype: 0, contenttype: 0 }), false);
});
