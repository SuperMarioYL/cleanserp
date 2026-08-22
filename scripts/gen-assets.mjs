// gen-assets.mjs — 一次性生成提交进仓库的二进制资产
//
// 产物：
//   icons/icon-128.png   128×128 RGBA（手写 PNG 编码，仅用 node 内置 zlib）
//   assets/demo.gif      160×90 动态 GIF（手写 GIF89a + LZW，自带解码回环自检）
//
// 这是一次性「创作」脚本，不在常规 build/test 链路里；资产已提交进仓库，
// build.mjs 只负责把它们拷进 dist/。CI 重新渲染真实 demo 见 .github/workflows/demo.yml。
//
// 用法：node scripts/gen-assets.mjs

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ─────────────────────────────────────────────────────────────────────
// 通用：CRC32（PNG chunk 校验）
// ─────────────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

// rgba: Uint8Array length w*h*4
function writePNG(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  // raw scanlines: each row prefixed with filter byte 0
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.subarray(y * w * 4, (y + 1) * w * 4).forEach((b, i) => {
      raw[y * (w * 4 + 1) + 1 + i] = b;
    });
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ─────────────────────────────────────────────────────────────────────
// 图标：净搜 logo（放大镜 + 绿勾），128×128
// ─────────────────────────────────────────────────────────────────────
function lerp(a, b, t) { return Math.round(a + (b - a) * t); }
function distSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx, cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function genIcon() {
  const W = 128, H = 128;
  const rgba = new Uint8Array(W * H * 4);
  const cx = 52, cy = 52, r = 30, R = 28; // glass center/radius, corner radius
  const top = [0x00, 0x71, 0xe3], bot = [0x00, 0x5b, 0xb5];
  const white = [0xff, 0xff, 0xff];
  const green = [0x10, 0xa3, 0x7f];

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4;

      // rounded-rect mask (corner radius R); outside → transparent
      let inside = true;
      if (x < R && y < R && Math.hypot(x - R, y - R) > R) inside = false;
      else if (x > W - 1 - R && y < R && Math.hypot(x - (W - 1 - R), y - R) > R) inside = false;
      else if (x < R && y > H - 1 - R && Math.hypot(x - R, y - (H - 1 - R)) > R) inside = false;
      else if (x > W - 1 - R && y > H - 1 - R && Math.hypot(x - (W - 1 - R), y - (H - 1 - R)) > R) inside = false;
      if (!inside) {
        rgba[o] = 0; rgba[o + 1] = 0; rgba[o + 2] = 0; rgba[o + 3] = 0;
        continue;
      }

      let col = [lerp(top[0], bot[0], y / H), lerp(top[1], bot[1], y / H), lerp(top[2], bot[2], y / H)];

      // magnifier ring (white)
      const dGlass = Math.hypot(x - cx, y - cy);
      if (Math.abs(dGlass - r) < 4.5) col = white;
      // handle (white)
      else if (distSeg(x, y, 73, 73, 96, 96) < 5.2) col = white;
      // check mark (green) inside glass
      else if (
        dGlass < r - 4 &&
        (distSeg(x, y, 40, 52, 49, 61) < 3.2 || distSeg(x, y, 49, 61, 66, 43) < 3.2)
      ) col = green;

      rgba[o] = col[0]; rgba[o + 1] = col[1]; rgba[o + 2] = col[2]; rgba[o + 3] = 255;
    }
  }
  return writePNG(W, H, rgba);
}

// ─────────────────────────────────────────────────────────────────────
// GIF89a：动态 demo（160×90，6 帧）+ LZW 编解码自检
// ─────────────────────────────────────────────────────────────────────
const PAL = [
  [0xf5, 0xf5, 0xf7], // 0 bg light
  [0x1d, 0x1d, 0x1f], // 1 dark text
  [0xe0, 0x39, 0x2b], // 2 red dead-end
  [0x10, 0xa3, 0x7f], // 3 green good
  [0x00, 0x71, 0xe3], // 4 brand blue
  [0x6e, 0x6e, 0x73], // 5 gray
  [0xc9, 0xc9, 0xd0], // 6 light gray (row bg)
  [0xff, 0xff, 0xff], // 7 white
  [0xf5, 0x9e, 0x0b], // 8 amber
  [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0],
];
const GW = 160, GH = 90;

function fillRect(buf, x0, y0, x1, y1, idx) {
  for (let y = Math.max(0, y0); y < Math.min(GH, y1); y++)
    for (let x = Math.max(0, x0); x < Math.min(GW, x1); x++)
      buf[y * GW + x] = idx;
}

// 画一帧：header 条 + N 条死链红行 + 1 条绿行（从顶向下堆叠）+ 可选绿徽章
function drawFrame(deadCount, showBadge) {
  const buf = new Uint8Array(GW * GH).fill(0); // bg light
  fillRect(buf, 0, 0, GW, 13, 4); // header bar (blue)
  if (showBadge) {
    // 绿色「已过滤」徽章 pill（右上）
    fillRect(buf, 118, 2, 158, 11, 3);
    fillRect(buf, 124, 4, 152, 9, 7); // 白色「文字」抽象
  }
  let y = 16;
  for (let i = 0; i < deadCount; i++) {
    fillRect(buf, 6, y, 154, y + 11, 6); // 行 bg 浅灰
    fillRect(buf, 6, y, 18, y + 11, 2); // 红色死链标签
    fillRect(buf, 24, y + 3, 150, y + 8, 1); // 深色标题条
    y += 14;
  }
  // 一条绿行（可读结果）
  fillRect(buf, 6, y, 154, y + 11, 6);
  fillRect(buf, 6, y, 18, y + 11, 3);
  fillRect(buf, 24, y + 3, 150, y + 8, 1);
  return buf;
}

// LZW 编码（GIF）—— 采用「每像素前发 clear」的零增长写法。
// 关键：每个数据码前先发 clear，使解码器字典永不增长、码宽恒为 minCodeSize+1，
// 规避 GIF LZW 码宽切换的 ±1 同步坑（任何标准解码器都能正确解码）。体积略大，
// 但作为提交进仓库的 demo 资产可接受；CI 的 demo.yml 会在打 tag 时用 vhs 重渲染。
function lzwEncode(indices, minCodeSize) {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  const codeWidth = minCodeSize + 1; // 恒定
  const out = [];
  let bitBuf = 0, bitCount = 0;
  const emit = (code) => {
    bitBuf |= code << bitCount;
    bitCount += codeWidth;
    while (bitCount >= 8) {
      out.push(bitBuf & 0xff);
      bitBuf >>>= 8;
      bitCount -= 8;
    }
  };
  for (let i = 0; i < indices.length; i++) {
    emit(clearCode); // 重置，使码宽恒定、字典不增长
    emit(indices[i]);
  }
  emit(eoiCode);
  if (bitCount > 0) out.push(bitBuf & 0xff);
  return Buffer.from(out);
}

// LZW 解码（与编码同一规则，用于回环自检）
function lzwDecode(data, minCodeSize, expectedLen) {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  let bitBuf = 0, bitCount = 0, pos = 0;
  let dict, nextCode, codeWidth;
  const reset = () => {
    dict = new Map();
    for (let i = 0; i < clearCode; i++) dict.set(i, [i]);
    nextCode = eoiCode + 1;
    codeWidth = minCodeSize + 1;
  };
  reset();
  const readCode = (width) => {
    while (bitCount < width) {
      if (pos >= data.length) return eoiCode;
      bitBuf |= data[pos++] << bitCount;
      bitCount += 8;
    }
    const code = bitBuf & ((1 << width) - 1);
    bitBuf >>>= width;
    bitCount -= width;
    return code;
  };
  const out = [];
  let prev = -1;
  while (pos < data.length || bitCount >= codeWidth) {
    const code = readCode(codeWidth);
    if (code === clearCode) { reset(); prev = -1; continue; }
    if (code === eoiCode) break;
    let entry;
    if (dict.has(code)) entry = dict.get(code);
    else if (code === nextCode && prev !== -1) entry = dict.get(prev).concat([dict.get(prev)[0]]);
    else throw new Error("lzw decode bad code " + code);
    for (const v of entry) out.push(v);
    if (prev !== -1 && nextCode < 4096) {
      dict.set(nextCode, dict.get(prev).concat([entry[0]]));
      nextCode++;
      if (nextCode === (1 << codeWidth) && codeWidth < 12) codeWidth++;
    }
    prev = code;
    if (expectedLen && out.length >= expectedLen) break;
  }
  return out;
}

function subBlocks(data) {
  // GIF image data：拆成 ≤255 字节的子块
  const out = [];
  for (let i = 0; i < data.length; i += 255) {
    const chunk = data.subarray(i, Math.min(i + 255, data.length));
    out.push(chunk.length, ...chunk);
  }
  out.push(0); // 块终止符
  return Buffer.from(out);
}

function genDemoGIF() {
  const minCodeSize = 4;
  const frames = [drawFrame(5, false), drawFrame(4, false), drawFrame(3, false), drawFrame(2, false), drawFrame(1, false), drawFrame(0, true)];

  for (let f = 0; f < frames.length; f++) {
    const enc = lzwEncode(frames[f], minCodeSize);
    const dec = lzwDecode(enc, minCodeSize, frames[f].length);
    if (dec.length !== frames[f].length) throw new Error(`self-test len f${f}`);
    for (let i = 0; i < dec.length; i++) if (dec[i] !== frames[f][i]) throw new Error(`self-test f${f}@${i}`);
  }

  const parts = [];
  parts.push(Buffer.from("GIF89a", "ascii"));
  const lsd = Buffer.alloc(7);
  lsd.writeUInt16LE(GW, 0);
  lsd.writeUInt16LE(GH, 2);
  lsd[4] = 0b10000011; // GCT present, 16 entries
  lsd[5] = 0; lsd[6] = 0;
  parts.push(lsd);
  const gct = [];
  for (const c of PAL) gct.push(c[0], c[1], c[2]);
  parts.push(Buffer.from(gct));
  // NETSCAPE loop
  parts.push(Buffer.from([0x21, 0xff, 0x0b, ...Buffer.from("NETSCAPE2.0", "ascii"), 0x03, 0x01, 0x00, 0x00, 0x00]));

  for (const frame of frames) {
    const enc = lzwEncode(frame, minCodeSize);
    // graphic control extension
    const gce = Buffer.from([0x21, 0xf9, 0x04, 0x00, 0x1e, 0x00, 0x00, 0x00]); // delay 0x001e = 30 (300ms)
    parts.push(gce);
    // image descriptor
    const id = Buffer.alloc(10);
    id[0] = 0x2c;
    id.writeUInt16LE(0, 1); // left
    id.writeUInt16LE(0, 3); // top
    id.writeUInt16LE(GW, 5);
    id.writeUInt16LE(GH, 7);
    id[9] = 0; // no local color table
    parts.push(id);
    parts.push(Buffer.from([minCodeSize]));
    parts.push(subBlocks(enc));
  }
  parts.push(Buffer.from([0x3b])); // trailer
  return Buffer.concat(parts);
}

// ─────────────────────────────────────────────────────────────────────
// 写文件
// ─────────────────────────────────────────────────────────────────────
mkdirSync(resolve(root, "icons"), { recursive: true });
mkdirSync(resolve(root, "assets"), { recursive: true });

writeFileSync(resolve(root, "icons/icon-128.png"), genIcon());
console.log("wrote icons/icon-128.png");

const gif = genDemoGIF();
writeFileSync(resolve(root, "assets/demo.gif"), gif);
console.log(`wrote assets/demo.gif (${gif.length} bytes)`);
