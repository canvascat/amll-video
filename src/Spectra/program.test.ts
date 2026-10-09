import assert from "node:assert/strict";
import { test } from "node:test";
import { splitWorkTitle } from "./program";

test("勃拉姆斯奏鸣曲拆成作品、乐章和速度", () => {
  assert.deepEqual(
    splitWorkTitle("Sonata in F minor, op. 120/ 1: I. Allegro appassionato"),
    {
      work: "Sonata in F minor, op. 120/1",
      movement: "I. Allegro appassionato",
      tempo: "Allegro appassionato",
    },
  );
});

test("乐章没有速度词时，速度留空", () => {
  assert.equal(
    splitWorkTitle("Viola and piano sonata, op.11/4: I. Fantasie")?.tempo,
    "",
  );
});

test("没有乐章结构的曲名不拆", () => {
  assert.equal(splitWorkTitle("One Last Kiss"), null);
  assert.equal(splitWorkTitle("Adagio und Allegro, op. 70"), null);
  assert.equal(splitWorkTitle("Concertstück"), null);
});

test("全角冒号同样能拆", () => {
  assert.equal(
    splitWorkTitle("F小调奏鸣曲：II. Andante un poco Adagio")?.tempo,
    "Andante un poco Adagio",
  );
});
