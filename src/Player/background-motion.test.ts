import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseBackgroundMotion,
  resolveBackgroundMotion,
} from "./background-motion";

test("默认把背景动效放慢到一半", () => {
  assert.deepEqual(resolveBackgroundMotion(undefined), {
    staticMode: false,
    flowSpeed: 0.5,
  });
});

test("static 停住背景流动", () => {
  assert.deepEqual(resolveBackgroundMotion("static"), {
    staticMode: true,
    flowSpeed: 0.5,
  });
});

test("normal 保持原来的流动速度", () => {
  assert.deepEqual(resolveBackgroundMotion("normal"), {
    staticMode: false,
    flowSpeed: 1,
  });
});

test("背景动效参数接受 static，不认识的值会报错", () => {
  assert.equal(parseBackgroundMotion("Static"), "static");
  assert.throws(() => parseBackgroundMotion("fast"), /不支持的背景动效/);
});
