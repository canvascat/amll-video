import assert from "node:assert/strict";
import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  ensureProjectTmpDir,
  projectTmpDir,
  withProjectTmpEnv,
} from "./project-tmp";

test("项目临时目录在仓库根下的 tmp", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "rmv-tmp-test-"));
  try {
    const dir = await ensureProjectTmpDir(root);
    assert.equal(dir, path.join(root, "tmp"));
    assert.equal(projectTmpDir(root), dir);
    const info = await stat(dir);
    assert.ok(info.isDirectory());
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("子进程环境把临时目录指到项目 tmp", () => {
  const env = withProjectTmpEnv("/proj/tmp", { PATH: "/bin", TMPDIR: "/old" });
  assert.equal(env.TMPDIR, "/proj/tmp");
  assert.equal(env.TMP, "/proj/tmp");
  assert.equal(env.TEMP, "/proj/tmp");
  assert.equal(env.PATH, "/bin");
});
