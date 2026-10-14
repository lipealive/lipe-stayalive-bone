/**
 * Exporta o boné 5 panel procedural para public/media/bone/bone.glb.
 *
 *   npx tsx scripts/export-cap.ts
 *
 * Geometria em three.js (mesma lógica do antigo ProceduralCap), texturas geradas com sharp
 * (ripstop em normal map, bordado "Stay Alive." com relevo, aba com pesponto) gravadas em WebP,
 * e o arquivo quantizado + comprimido com meshopt (EXT_meshopt_compression).
 * Nada disso roda no cliente: o site só carrega o .glb.
 */
import path from "node:path";
import os from "node:os";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { DecalGeometry } from "three/examples/jsm/geometries/DecalGeometry.js";
import { Document, NodeIO, type Material, type Texture } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTTextureWebP, KHRTextureTransform } from "@gltf-transform/extensions";
import { dedup, meshopt, prune } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";

// Fonte do bordado (Inter Tight, em scripts/fonts) registrada no fontconfig do sharp. Precisa vir antes do import do sharp.
{
  const dir = path.join(os.tmpdir(), "lipe-cap-fontconfig");
  fsSync.mkdirSync(dir, { recursive: true });
  fsSync.writeFileSync(
    path.join(dir, "fonts.conf"),
    `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${path.resolve(__dirname, "fonts")}</dir><cachedir>${dir}/cache</cachedir></fontconfig>`,
  );
  process.env.FONTCONFIG_PATH = dir;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sharp: typeof import("sharp").default;

const OUT = path.resolve(__dirname, "../public/media/bone/bone.glb");

/* ------------------------------------------------------------------ */
/* Geometria                                                           */
/* ------------------------------------------------------------------ */

const CROWN_H = 0.58;
const SUPER_N = 2.7;
const CROWN_Z = 1.04;
const FLAT_Z = 0.6;
const FLAT_K = 0.45;

function deform(v: THREE.Vector3, scaleY: boolean) {
  if (scaleY) {
    const r = Math.hypot(v.x, v.z);
    const y = Math.max(0, v.y);
    const s = Math.pow(Math.pow(r, SUPER_N) + Math.pow(y, SUPER_N), -1 / SUPER_N);
    v.multiplyScalar(s);
    v.y *= CROWN_H;
  }
  v.z *= CROWN_Z;
  if (v.z > FLAT_Z) v.z = FLAT_Z + (v.z - FLAT_Z) * FLAT_K;
  return v;
}

function crownPoint(theta: number, phi: number, out = new THREE.Vector3()) {
  const r = Math.sin(phi);
  out.set(r * Math.sin(theta), Math.cos(phi), r * Math.cos(theta));
  return deform(out, true);
}

function deformGeometry(geo: THREE.BufferGeometry, scaleY: boolean) {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    deform(v, scaleY);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function buildSeams(): THREE.Vector3[][] {
  const seams: THREE.Vector3[][] = [];
  const N = 48;
  const front: THREE.Vector3[] = [];
  const TH = 0.8;
  for (let i = 0; i <= N; i++) {
    const theta = -TH + (2 * TH * i) / N;
    const phi = Math.PI / 2 - (Math.PI / 2 - 0.92) * Math.cos((theta / TH) * (Math.PI / 2));
    front.push(crownPoint(theta, phi));
  }
  seams.push(front);
  const strip = (x0: number, zStart: number) => {
    const pts: THREE.Vector3[] = [];
    const zEnd = -Math.sqrt(1 - x0 * x0) + 0.001;
    for (let i = 0; i <= N; i++) {
      const z0 = zStart + (zEnd - zStart) * (i / N);
      const y0 = Math.sqrt(Math.max(0, 1 - x0 * x0 - z0 * z0));
      pts.push(deform(new THREE.Vector3(x0, y0, z0), true));
    }
    return pts;
  };
  seams.push(strip(0.34, 0.76), strip(-0.34, 0.76), strip(0, 0.79));
  return seams;
}

function lift(p: THREE.Vector3, amount: number) {
  const n = new THREE.Vector3(p.x, p.y / CROWN_H + 0.15, p.z / CROWN_Z).normalize();
  return p.clone().addScaledVector(n, amount);
}

function scaleUV(geo: THREE.BufferGeometry, sx: number, sy: number) {
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy);
}

function buildGeometry() {
  // copa
  const crown = deformGeometry(new THREE.SphereGeometry(1, 96, 48, 0, Math.PI * 2, 0, Math.PI / 2), true);
  scaleUV(crown, 30, 15); // repeat do ripstop (era normal.repeat.set(30, 15))

  // faixa interna
  const band = new THREE.CylinderGeometry(0.975, 0.985, 0.16, 96, 1, true);
  band.translate(0, 0.08, 0);
  deformGeometry(band, false);

  // costuras
  const seams = buildSeams();
  const seamGeo = mergeGeometries(
    seams.map((pts) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => lift(p, 0.004))), 64, 0.0065, 8, false)),
  )!;

  // pesponto (caixinhas ao longo das costuras, mescladas numa geometria só)
  const stitchBox = new THREE.BoxGeometry(0.015, 0.0035, 0.004);
  const stitchParts: THREE.BufferGeometry[] = [];
  const up = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const side = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const m = new THREE.Matrix4();
  seams.forEach((pts) => {
    const curve = new THREE.CatmullRomCurve3(pts);
    const count = Math.floor(curve.getLength() / 0.032);
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const p = curve.getPointAt(t);
      curve.getTangentAt(t, tangent);
      up.set(p.x, p.y / CROWN_H + 0.15, p.z / CROWN_Z).normalize();
      side.crossVectors(tangent, up).normalize();
      basis.makeBasis(tangent, up, side);
      q.setFromRotationMatrix(basis);
      for (const s of [-0.016, 0.016]) {
        const pos = p.clone().addScaledVector(side, s).addScaledVector(up, 0.0075);
        m.compose(pos, q, new THREE.Vector3(1, 1, 1));
        stitchParts.push(stitchBox.clone().applyMatrix4(m));
      }
    }
  });
  const stitches = mergeGeometries(stitchParts)!;

  // aba
  const AMAX = 1.15;
  const rimR = (a: number) => {
    const p = deform(new THREE.Vector3(Math.sin(a) * 0.955, 0, Math.cos(a) * 0.955), true);
    return Math.hypot(p.x, p.z);
  };
  const ext = (a: number) => 0.84 * Math.pow(Math.max(0, Math.cos((a / AMAX) * (Math.PI / 2))), 1.5);
  const outer = (a: number) => rimR(a) + ext(a);
  const shape = new THREE.Shape();
  const S = 72;
  for (let i = 0; i <= S; i++) {
    const a = -AMAX + (2 * AMAX * i) / S;
    const r = outer(a);
    if (i === 0) shape.moveTo(Math.sin(a) * r, Math.cos(a) * r);
    else shape.lineTo(Math.sin(a) * r, Math.cos(a) * r);
  }
  for (let i = S; i >= 0; i--) {
    const a = -AMAX + (2 * AMAX * i) / S;
    const r = rimR(a);
    shape.lineTo(Math.sin(a) * r, Math.cos(a) * r);
  }
  shape.closePath();
  const brim = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 12 });
  brim.computeBoundingBox();
  const bb = brim.boundingBox!;
  const bbox = { minX: bb.min.x, maxX: bb.max.x, minY: bb.min.y, maxY: bb.max.y };
  const bw = bbox.maxX - bbox.minX;
  const bh = bbox.maxY - bbox.minY;
  // UV da aba normalizado para a textura (era repeat/offset no map)
  {
    const uv = brim.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) - bbox.minX) / bw, (uv.getY(i) - bbox.minY) / bh);
  }
  // transforms do mesh (rotation x = π/2) e do grupo (rotation 0.07, y 0.004) baked
  const brimMatrix = new THREE.Matrix4()
    .makeTranslation(0, 0.004, 0)
    .multiply(new THREE.Matrix4().makeRotationX(0.07))
    .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
  brim.applyMatrix4(brimMatrix);

  // botão
  const button = new THREE.SphereGeometry(0.078, 32, 16);
  button.applyMatrix4(new THREE.Matrix4().makeScale(1, 0.42, 1).premultiply(new THREE.Matrix4().makeTranslation(0, CROWN_H + 0.012, 0)));

  // ilhoses
  const eyeletParts: THREE.BufferGeometry[] = [];
  const holeParts: THREE.BufferGeometry[] = [];
  for (const theta of [1.35, -1.35]) {
    const at = crownPoint(theta, 1.12);
    const o = new THREE.Object3D();
    o.position.copy(at);
    o.lookAt(new THREE.Vector3(at.x * 3, at.y + 0.1, at.z * 3));
    o.updateMatrix();
    eyeletParts.push(new THREE.TorusGeometry(0.042, 0.013, 12, 32).applyMatrix4(o.matrix));
    holeParts.push(new THREE.CircleGeometry(0.034, 24).translate(0, 0, -0.004).applyMatrix4(o.matrix));
  }
  const eyelets = mergeGeometries(eyeletParts)!;
  const holes = mergeGeometries(holeParts)!;

  // strap + fivela
  const back = crownPoint(Math.PI, 1.48);
  const strap = new THREE.BoxGeometry(0.46, 0.075, 0.016).translate(0, 0.07, back.z - 0.02);
  const buckle = new THREE.BoxGeometry(0.1, 0.1, 0.012).translate(0.17, 0.07, back.z - 0.02 + 0.012);

  // decal do bordado projetado na copa
  const crownMesh = new THREE.Mesh(crown);
  crownMesh.updateMatrixWorld();
  const decal = new DecalGeometry(crownMesh, new THREE.Vector3(0, 0.2, 0.78), new THREE.Euler(0, 0, 0), new THREE.Vector3(0.72, 0.21, 0.5));

  return { crown, band, seamGeo, stitches, brim, bbox, outer, AMAX, button, eyelets, holes, strap, buckle, decal };
}

/* ------------------------------------------------------------------ */
/* Texturas (sharp)                                                    */
/* glTF amostra v=0 na primeira linha da imagem (flipY=false no loader), */
/* por isso todas as imagens são gravadas invertidas verticalmente.      */
/* ------------------------------------------------------------------ */

function heightToNormal(h: Float32Array, size: number, strength: number) {
  const out = Buffer.alloc(size * size * 4);
  const n = new THREE.Vector3();
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const l = h[y * size + ((x - 1 + size) % size)];
      const r = h[y * size + ((x + 1) % size)];
      const u = h[((y - 1 + size) % size) * size + x];
      const d = h[((y + 1) % size) * size + x];
      n.set((l - r) * strength, (u - d) * strength, 1).normalize();
      const i = (y * size + x) * 4;
      out[i] = (n.x * 0.5 + 0.5) * 255;
      out[i + 1] = (n.y * 0.5 + 0.5) * 255;
      out[i + 2] = (n.z * 0.5 + 0.5) * 255;
      out[i + 3] = 255;
    }
  }
  return out;
}

async function ripstopNormal(size = 256) {
  const h = new Float32Array(size * size);
  const cell = 16;
  let seed = 1337;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0.5 + (rnd() - 0.5) * 0.08;
      v += ((x % 2) ^ (y % 2)) * 0.03;
      const gx = x % cell;
      const gy = y % cell;
      if (gx < 2 || gy < 2) v += 0.22;
      if (gx === 1 || gy === 1) v += 0.06;
      h[y * size + x] = v;
    }
  }
  return sharp(heightToNormal(h, size, 2.2), { raw: { width: size, height: size, channels: 4 } }).flip().webp({ lossless: true }).toBuffer();
}

const FONT = `font-family="Inter Tight" font-weight="700" font-size="150px"`;

async function embroideryTextures(text = "Stay Alive.") {
  const w = 1024;
  const hgt = 320;
  const map = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${hgt}">
    <defs>
      <mask id="t"><text x="${w / 2}" y="${hgt / 2 + 6}" ${FONT} text-anchor="middle" dominant-baseline="middle" fill="#fff">${text}</text></mask>
      <pattern id="h" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
        <line x1="0" y1="0" x2="0" y2="4" stroke="rgba(0,0,0,0.32)" stroke-width="1.2"/>
        <line x1="2" y1="0" x2="2" y2="4" stroke="rgba(255,255,255,0.35)" stroke-width="1.2"/>
      </pattern>
    </defs>
    <text x="${w / 2}" y="${hgt / 2 + 6}" ${FONT} text-anchor="middle" dominant-baseline="middle" fill="#f4f4f4">${text}</text>
    <rect width="100%" height="100%" fill="url(#h)" mask="url(#t)"/>
  </svg>`;
  const mapBuf = await sharp(Buffer.from(map)).flip().webp({ quality: 92, alphaQuality: 100 }).toBuffer();

  // relevo: letras borradas → mapa de altura → normal map
  const bump = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${hgt}">
    <filter id="b"><feGaussianBlur stdDeviation="1.5"/></filter>
    <rect width="100%" height="100%" fill="#000"/>
    <text x="${w / 2}" y="${hgt / 2 + 6}" ${FONT} text-anchor="middle" dominant-baseline="middle" fill="#fff" filter="url(#b)">${text}</text>
  </svg>`;
  const gray = await sharp(Buffer.from(bump)).greyscale().raw().toBuffer();
  const hf = new Float32Array(w * hgt);
  for (let i = 0; i < w * hgt; i++) hf[i] = gray[i] / 255;
  // normal map não-quadrado: reaproveita a função com largura/altura separadas
  const out = Buffer.alloc(w * hgt * 4);
  const n = new THREE.Vector3();
  for (let y = 0; y < hgt; y++) {
    for (let x = 0; x < w; x++) {
      const l = hf[y * w + Math.max(0, x - 1)];
      const r = hf[y * w + Math.min(w - 1, x + 1)];
      const u = hf[Math.max(0, y - 1) * w + x];
      const d = hf[Math.min(hgt - 1, y + 1) * w + x];
      n.set((l - r) * 3, (u - d) * 3, 1).normalize();
      const i = (y * w + x) * 4;
      out[i] = (n.x * 0.5 + 0.5) * 255;
      out[i + 1] = (n.y * 0.5 + 0.5) * 255;
      out[i + 2] = (n.z * 0.5 + 0.5) * 255;
      out[i + 3] = 255;
    }
  }
  const normalBuf = await sharp(out, { raw: { width: w, height: hgt, channels: 4 } }).flip().webp({ lossless: true }).toBuffer();
  return { map: mapBuf, normal: normalBuf };
}

async function brimTexture(outline: (a: number) => number, amax: number, bbox: { minX: number; maxX: number; minY: number; maxY: number }) {
  const size = 1024;
  const sx = size / (bbox.maxX - bbox.minX);
  const sy = size / (bbox.maxY - bbox.minY);
  const toPx = (x: number, y: number) => [(x - bbox.minX) * sx, size - (y - bbox.minY) * sy] as const;
  const paths = [0.05, 0.13, 0.21, 0.29, 0.37]
    .map((inset, idx) => {
      let d = "";
      const steps = 120;
      for (let i = 0; i <= steps; i++) {
        const a = -amax + (2 * amax * i) / steps;
        const r = outline(a) - inset;
        const [px, py] = toPx(Math.sin(a) * r, Math.cos(a) * r);
        d += `${i === 0 ? "M" : "L"}${px.toFixed(1)} ${py.toFixed(1)} `;
      }
      const col = idx % 2 === 0 ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.14)";
      return `<path d="${d}" fill="none" stroke="${col}" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="7 5"/>`;
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <defs><pattern id="g" width="5" height="5" patternUnits="userSpaceOnUse">
      <path d="M0 0H5M0 0V5" stroke="rgba(255,255,255,0.035)" stroke-width="1" fill="none"/>
    </pattern></defs>
    <rect width="100%" height="100%" fill="#0b0b0b"/>
    <rect width="100%" height="100%" fill="url(#g)"/>
    ${paths}
  </svg>`;
  return sharp(Buffer.from(svg)).flip().webp({ quality: 82 }).toBuffer();
}

/* ------------------------------------------------------------------ */
/* glTF                                                                */
/* ------------------------------------------------------------------ */

async function main() {
  sharp = (await import("sharp")).default;
  const g = buildGeometry();
  const [ripstop, emb, brimTex] = await Promise.all([ripstopNormal(), embroideryTextures(), brimTexture(g.outer, g.AMAX, g.bbox)]);

  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene("cap");
  doc.createExtension(EXTTextureWebP).setRequired(true);
  const tt = doc.createExtension(KHRTextureTransform);

  const tex = (name: string, buf: Buffer): Texture => doc.createTexture(name).setImage(new Uint8Array(buf)).setMimeType("image/webp");
  const texRipstop = tex("ripstop-normal", ripstop);
  const texRipstopBrim = tex("ripstop-normal-brim", ripstop);
  const texEmb = tex("embroidery", emb.map);
  const texEmbNormal = tex("embroidery-normal", emb.normal);
  const texBrim = tex("brim", brimTex);

  const lin = (hex: string) => {
    const c = new THREE.Color(hex);
    return [c.r, c.g, c.b, 1] as [number, number, number, number];
  };

  const fabric = doc.createMaterial("fabric").setBaseColorFactor(lin("#0a0a0a")).setRoughnessFactor(0.9).setMetallicFactor(0).setDoubleSided(true).setNormalTexture(texRipstop).setNormalScale(0.4);
  const band = doc.createMaterial("band").setBaseColorFactor(lin("#1b1b1b")).setRoughnessFactor(1).setMetallicFactor(0).setDoubleSided(true);
  const seam = doc.createMaterial("seam").setBaseColorFactor(lin("#151515")).setRoughnessFactor(0.95).setMetallicFactor(0);
  const stitch = doc.createMaterial("stitch").setBaseColorFactor(lin("#3a3a3a")).setRoughnessFactor(0.6).setMetallicFactor(0);
  const brimMat = doc.createMaterial("brim").setBaseColorTexture(texBrim).setRoughnessFactor(0.9).setMetallicFactor(0).setNormalTexture(texRipstopBrim).setNormalScale(0.3);
  {
    // normal da aba: repeat (14,14) sobre as coordenadas originais da forma
    const bw = g.bbox.maxX - g.bbox.minX;
    const bh = g.bbox.maxY - g.bbox.minY;
    brimMat.getNormalTextureInfo()!.setExtension("KHR_texture_transform", tt.createTransform().setScale([14 * bw, 14 * bh]).setOffset([14 * g.bbox.minX, 14 * g.bbox.minY]));
  }
  const metal = doc.createMaterial("metal").setBaseColorFactor(lin("#232323")).setRoughnessFactor(0.35).setMetallicFactor(0.85);
  const dark = doc.createMaterial("dark").setBaseColorFactor(lin("#050505")).setRoughnessFactor(1).setMetallicFactor(0);
  const decalMat = doc
    .createMaterial("decal")
    .setBaseColorTexture(texEmb)
    .setAlphaMode("BLEND")
    .setRoughnessFactor(0.5)
    .setMetallicFactor(0)
    .setEmissiveFactor([0.28, 0.28, 0.28])
    .setNormalTexture(texEmbNormal)
    .setNormalScale(0.5);

  const addMesh = (name: string, geo: THREE.BufferGeometry, mat: Material) => {
    const prim = doc.createPrimitive().setMaterial(mat);
    const pos = geo.attributes.position.array as Float32Array;
    prim.setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(new Float32Array(pos)).setBuffer(buffer));
    if (geo.attributes.normal) prim.setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(new Float32Array(geo.attributes.normal.array as Float32Array)).setBuffer(buffer));
    if (geo.attributes.uv) prim.setAttribute("TEXCOORD_0", doc.createAccessor().setType("VEC2").setArray(new Float32Array(geo.attributes.uv.array as Float32Array)).setBuffer(buffer));
    if (geo.index) prim.setIndices(doc.createAccessor().setType("SCALAR").setArray(new Uint32Array(geo.index.array)).setBuffer(buffer));
    scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim)));
  };

  addMesh("crown", g.crown, fabric);
  addMesh("button", g.button, fabric);
  addMesh("band", g.band, band);
  addMesh("seams", g.seamGeo, seam);
  addMesh("stitches", g.stitches, stitch);
  addMesh("brim", g.brim, brimMat);
  addMesh("eyelets", g.eyelets, metal);
  addMesh("eyeletHoles", g.holes, dark);
  addMesh("strap", g.strap, dark);
  addMesh("buckle", g.buckle, metal);
  addMesh("decal", g.decal, decalMat);

  await MeshoptEncoder.ready;
  await doc.transform(dedup(), prune(), meshopt({ encoder: MeshoptEncoder, level: "medium" }));

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder });
  const glb = await io.writeBinary(doc);
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, glb);

  const tris = [g.crown, g.button, g.band, g.seamGeo, g.stitches, g.brim, g.eyelets, g.holes, g.strap, g.buckle, g.decal].reduce((n, geo) => n + (geo.index ? geo.index.count : geo.attributes.position.count) / 3, 0);
  console.log(`bone.glb: ${(glb.byteLength / 1024).toFixed(0)} kB · ${Math.round(tris)} triângulos · texturas: ripstop ${(ripstop.length / 1024).toFixed(0)} kB, bordado ${(emb.map.length / 1024).toFixed(0)}+${(emb.normal.length / 1024).toFixed(0)} kB, aba ${(brimTex.length / 1024).toFixed(0)} kB`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
