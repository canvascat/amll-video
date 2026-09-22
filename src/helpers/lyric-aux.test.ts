import assert from "node:assert/strict";
import { test } from "node:test";
import { parseLyricText } from "./lyrics";

const QRC = `[18644,3367]駄(18644,182)目(18826,188)
[22011,800]次(22011,800)
[rmv-translation]
[00:18.64]不行不行
[00:22.01]//
[rmv-roman]
[18644,3367]da (18644,182)me (18826,188)
`;

const KANA_QRC = `[kana:1かい1ぶつ1す1ば1せ1か(2964,296)い(3260,240)2きょう]
[0,666]怪(0,121)物(121,121)
[2128,2725]素(2128,14)晴(2142,50)ら(2192,360)し(2552,239)き(2791,94)世(2885,79)界(2964,536)に(3500,143)今日(3643,439)
`;

test("QRC 的中文挂到整行，罗马音挂到每个字", () => {
  const lines = parseLyricText(QRC, "qrc");
  assert.equal(lines.length, 2);
  assert.equal(lines[0]?.words.map((word) => word.word).join(""), "駄目");
  assert.equal(lines[0]?.translatedLyric, "不行不行");
  assert.equal(lines[0]?.romanLyric, "");
  assert.equal(lines[0]?.words[0]?.romanWord, "da");
  assert.equal(lines[0]?.words[1]?.romanWord, "me");
  assert.equal(lines[1]?.translatedLyric, "");
  assert.equal(lines[1]?.romanLyric, "");
  assert.equal(lines[1]?.words[0]?.romanWord, undefined);
});

test("QRC 的 kana 注音只挂到汉字上", () => {
  const lines = parseLyricText(KANA_QRC, "qrc");
  assert.equal(lines[0]?.words[0]?.ruby?.[0]?.word, "かい");
  assert.equal(lines[0]?.words[1]?.ruby?.[0]?.word, "ぶつ");
  assert.equal(lines[1]?.words[0]?.ruby?.[0]?.word, "す");
  assert.equal(lines[1]?.words[1]?.ruby?.[0]?.word, "ば");
  assert.equal(lines[1]?.words[2]?.ruby, undefined);
  assert.equal(lines[1]?.words[5]?.ruby?.[0]?.word, "せ");
  assert.deepEqual(
    lines[1]?.words[6]?.ruby?.map((ruby) => ruby.word),
    ["か", "い"],
  );
  assert.equal(lines[1]?.words[8]?.ruby?.[0]?.word, "きょう");
  assert.equal(lines[1]?.words[7]?.ruby, undefined);
});
