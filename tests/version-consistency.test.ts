// version-consistency.test.ts — 版本 lockstep（m8，随每个发布递增维护）
//
// 断言所有在役版本表面一致为 EXPECTED_VERSION：VERSION / package.json /
// manifest.json（Chrome 扩展页用户真正读到的那个）+ web/site.json
// content_version（数字修订号；站点内容与修订号随「site: refresh」提交递增）。
// 冻结产物（docs/demo-results.json、docs/demo.tape、assets/demo.gif 是早期
// 时期的录制）停留录制版本，在杂散版本扫描中 allow-list；package-lock.json
// 是生成文件（传递依赖版本号可合法包含旧版本子串），同样 allow-list。
// 测试经 npm 从仓库根目录运行（node --test dist/tests/）。
//
// 旧版本号通过 join 拼出而非字面量书写——本文件自身也在杂散扫描范围内。

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, extname } from "node:path";

const root = process.cwd();
const read = (p: string): string => readFileSync(join(root, p), "utf8");

const EXPECTED_VERSION = "0.3.0";
const OLD_VERSION = ["0", "2", "0"].join(".");

test("VERSION / package.json / manifest.json 三表面一致为当前发布版本", () => {
  assert.equal(read("VERSION").trim(), EXPECTED_VERSION);

  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.version, EXPECTED_VERSION);

  const manifest = JSON.parse(read("manifest.json"));
  assert.equal(manifest.version, EXPECTED_VERSION);
});

test("web/site.json meta.content_version 为数字 2（类型保持的 1→2 修订号）", () => {
  const site = JSON.parse(read("web/site.json"));
  assert.equal(site.meta.content_version, 2);
});

test("CHANGELOG.md 同时含上一版本与当前版本两个小节", () => {
  const changelog = read("CHANGELOG.md");
  assert.match(changelog, new RegExp(`\\[${OLD_VERSION}\\]`));
  assert.match(changelog, new RegExp(`\\[${EXPECTED_VERSION.replace(/\./g, "\\.")}\\]`));
});

test("manifest 已接入搜狗：content_scripts matches 与 host_permissions 均含 sogou host", () => {
  const manifest = JSON.parse(read("manifest.json"));
  const matchesSogou = manifest.content_scripts.some((cs: { matches: string[] }) =>
    cs.matches.some((m) => m.includes("sogou.com")),
  );
  assert.ok(matchesSogou, "content_scripts.matches 应含 www.sogou.com");
  assert.ok(
    manifest.host_permissions.some((m: string) => m.includes("sogou.com")),
    "host_permissions 应含 www.sogou.com",
  );
});

// 杂散旧版本扫描：tracked 文本文件不得再出现旧版本号（冻结产物/生成文件除外）。
const SKIP_DIRS = new Set([".git", "node_modules", "dist"]);
const BINARY_EXTS = new Set([".png", ".gif", ".ico", ".zip", ".woff", ".woff2"]);
const ALLOWLIST = new Set([
  "CHANGELOG.md", // 历史节记录旧版本号
  "docs/demo-results.json", // 冻结的早期录制产物
  "docs/demo.tape", // 冻结的早期 vhs 录制
  "package-lock.json", // 生成文件，传递依赖版本可含旧版本子串
  ".build_metadata.yaml", // gitignored 构建元数据缓存：published_version 合法保留最近已发布版本
]);

function collectFiles(dir: string, acc: string[] = []): string[] {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) {
      if (!SKIP_DIRS.has(ent.name)) collectFiles(join(dir, ent.name), acc);
      continue;
    }
    if (BINARY_EXTS.has(extname(ent.name))) continue;
    acc.push(join(dir, ent.name));
  }
  return acc;
}

test("杂散旧版本扫描：旧版本号仅出现在 allow-list 的冻结/生成文件中", () => {
  const offenders: string[] = [];
  for (const file of collectFiles(root)) {
    const rel = relative(root, file);
    if (ALLOWLIST.has(rel)) continue;
    const text = readFileSync(file, "utf8");
    if (text.includes(OLD_VERSION)) offenders.push(rel);
  }
  assert.deepEqual(offenders, [], "以下文件仍携带旧版本号");
});
