// build.mjs — esbuild 打包 + 拷贝可加载资源到 dist/
//
// 产物结构（load-unpacked 指向 dist/）：
//   dist/manifest.json
//   dist/icons/icon-128.png
//   dist/src/content/serp-filter.js      (IIFE, content script)
//   dist/src/background/service-worker.js (ESM, MV3 module SW)
//   dist/src/popup/popup.{html,js,css}
//   dist/tests/*.test.cjs                (CJS, node --test dist/tests/)
//
// 纯确定性构建：不重新生成二进制资产（icon/gif 已提交在仓库 assets/、icons/），
// 仅做打包与拷贝。

import { build } from "esbuild";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const common = {
  bundle: true,
  sourcemap: false,
  logLevel: "info",
  target: "chrome120",
};

await build({
  ...common,
  entryPoints: [resolve(root, "src/content/serp-filter.ts")],
  outfile: resolve(dist, "src/content/serp-filter.js"),
  format: "iife",
});

await build({
  ...common,
  entryPoints: [resolve(root, "src/background/service-worker.ts")],
  outfile: resolve(dist, "src/background/service-worker.js"),
  format: "esm",
});

await build({
  ...common,
  entryPoints: [resolve(root, "src/popup/popup.ts")],
  outfile: resolve(dist, "src/popup/popup.js"),
  format: "iife",
});

// 测试单独打成 CJS（node --test 需要），platform=node 以解析 node: 内置模块。
// 用 .cjs 扩展名，绕开 package.json 的 "type":"module" 把 .js 当 ESM 的解析。
// happy-dom 标记为 external：体积大且只在 node 运行时需要，从仓库
// node_modules 解析即可，不重复打进每个测试 bundle。
const testDir = resolve(root, "tests");
const testFiles = readdirSync(testDir).filter((f) => f.endsWith(".test.ts"));
for (const f of testFiles) {
  await build({
    ...common,
    entryPoints: [resolve(testDir, f)],
    outfile: resolve(dist, "tests", f.replace(/\.ts$/, ".cjs")),
    format: "cjs",
    platform: "node",
    target: "node22",
    external: ["happy-dom"],
  });
}

// ── 拷贝可加载静态资源 ──────────────────────────────────────────────
const copyFile = (src, destRel) => {
  const dest = resolve(dist, destRel);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(resolve(root, src), dest);
};

copyFile("manifest.json", "manifest.json");
copyFile("src/popup/popup.html", "src/popup/popup.html");
copyFile("src/popup/popup.css", "src/popup/popup.css");

if (existsSync(resolve(root, "icons"))) {
  cpSync(resolve(root, "icons"), resolve(dist, "icons"), { recursive: true });
}

console.log("build: dist/ ready for load-unpacked");
