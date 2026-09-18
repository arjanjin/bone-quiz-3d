// Build muscles / organs / vessels / neuro / skin / discs / nerves / lymph .glb
// from BodyParts3D 3.0 STL + 4.0 OBJ and Z-Anatomy (CC BY-SA 4.0) OBJ exported by zanatomy_src/export_layers.py
// Same pipeline as build_skeleton.mjs (mm/Z-up/front=-Y -> m/Y-up/front=+Z, meshopt simplify, quantize).
//
// Usage (from this folder):  node build_layers.mjs
//   BP3D=<dir>   folder with selection.json + stl/  and node_modules of the build tools
//                (default ../../bp3d_src — kept outside the web folder)
//   RATIO=0.05   simplification ratio, MAXTRI=4000 max triangles per source part
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { pathToFileURL, fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, process.env.BP3D || '../../bp3d_src');
const req = createRequire(path.join(SRC, 'package.json'));
const load = m => import(pathToFileURL(req.resolve(m)).href);
const { Document, NodeIO } = await load('@gltf-transform/core');
const { KHRMeshQuantization, EXTMeshoptCompression } = await load('@gltf-transform/extensions');
const { quantize, meshopt } = await load('@gltf-transform/functions');
const { MeshoptSimplifier, MeshoptEncoder } = await load('meshoptimizer');

const RATIO = Number(process.env.RATIO || 0.05);
const MAXTRI = Number(process.env.MAXTRI || 4000);
const Z_SHIFT = -0.11;   // same as build_skeleton.mjs

const MUSCLE_GROUP = [
  /^(acromial|clavicular|spinal|abdominal|sternocostal|deep|superficial|orbital|palpebral|inferior oblique|superior oblique|vertical intermediate|straight|oblique) part of /,
  /^(long|short|lateral|medial|deep|superficial|upper|lower|oblique|transverse|humeral|humeroulnar|radial|ulnar) head of /,
  /^(anterior|posterior) belly of /,
  /^set of /,
];
const ORGAN_MERGE = [
  [/corpus cavernosum of penis|corpus spongiosum of penis|glans penis/, 'penis'],
  [/lobe of thymus/, 'thymus'],
  [/^wall of heart$/, 'heart'],
  [/papillary muscle/, 'papillary muscles'],
  [/taenia$/, 'taeniae coli'],
  [/^gingiva/, 'gingiva'],
  [/labial part of mouth/, 'lips'],
  [/bronchial tree/, 'segmental bronchi'],
  [/biliary tree/, 'intrahepatic bile ducts'],
  [/cusp of aortic valve/, 'aortic valve'],
  [/tarsal plate/, 'tarsal plates'],
];
const COLORS = {
  muscle: 0xb4554b, tendon: 0xe2dac4, artery: 0xd23a3a, vein: 0x3d63c6,
  nerve: 0xf2d24b, skin: 0xe8b996, disc: 0x9cc6dc, pns: 0xf5d547, lymph: 0x7cc576, cord: 0xefe4d2,
};
// สมอง: เนื้อขาว/เนื้อเทา/ventricle
const NEURO_COLORS = [
  [/ventricle|aqueduct|central canal|foramen/, 0x5fb4e6], [/white matter|corpus callosum|capsule|fornix|commissure|stria|brachium|peduncle/, 0xefe4d2],
  [/nerve|chiasm|optic tract|ganglion/, 0xf2d24b], [/pituitary|pineal/, 0xd98fa0], [/./, 0xcfa597],
];
const ORGAN_COLORS = [
  [/lung/, 0xf0a3ab], [/heart/, 0xa8323a], [/valve/, 0xf0d9a0], [/liver/, 0x8a3b2e], [/gallbladder/, 0x4f8a3c],
  [/spleen/, 0x7a2f4a], [/pancrea/, 0xe8c07a], [/kidney/, 0x8d3b36], [/adrenal/, 0xd9a441],
  [/trachea|bronchus|thyroid cartilage/, 0xcfe0e6], [/bladder|ureter|urethra/, 0xe8d27a],
  [/testis|epididym|deferent|seminal|prostate|penis/, 0xd98fa0], [/thymus/, 0xe6b5a0],
  [/cornea|lens|vitreous|anterior chamber/, 0xbfe3f2], [/iris|choroid/, 0x6b4a3a], [/sclera|retina/, 0xf4efe6],
  [/bile duct|hepatic duct|cystic duct/, 0x5f9e45], [/gland/, 0xe0b36c], [/mesentery|mesoappendix|mesocolon/, 0xf2dc9a],
  [/dura mater/, 0xd9cbb5], [/cartilage|conus elasticus|ligament|plate|bronchi/, 0xcfe0e6],
  [/./, 0xe7a18c],   // ทางเดินอาหาร
];

function classify(rawName, layer) {
  let n = rawName.toLowerCase().replace(/, nsn$/, '');
  // หลอดเลือดที่ "ซ้าย/ขวา" เป็นส่วนของชื่อ (left coronary, left gastric ฯลฯ) ไม่ใช่ข้างของร่างกาย
  const keep = layer === 'vessel' && /coronary|\bgastric|gastro-?epiploic|colic|hepatic|portal|lingular|lobar|ventricle/.test(n);
  const side = keep ? 0 : /\bleft\b/.test(n) ? 1 : /\bright\b/.test(n) ? -1 : 0;
  if (!keep) n = n.replace(/\b(left|right) /g, '');
  n = n.replace(/\s+/g, ' ').trim();
  let kind;
  if (layer === 'muscle') {
    for (const r of MUSCLE_GROUP) n = n.replace(r, '');
    n = n.replace(/ muscle$/, '').replace(/ (breves|longi)$/, '');
    if (n === 'intermediate tendon') n = 'intermediate tendon of digastric';
    kind = /tendon|retinaculum|ligament|interosseous membrane|linea alba|tendinous arch/.test(n) ? 'tendon' : 'muscle';
  } else if (layer === 'vessel') {
    n = n.replace(/^(branch|branches) of /, '');
    kind = /vein|vena|venous|sinus|hepatovenous/.test(n) ? 'vein' : 'artery';
  } else if (layer === 'nerve') {
    kind = /nerve|chiasm|optic tract|ganglion/.test(n) ? 'nerve' : 'brain';
  } else if (layer === 'skin') {
    kind = 'skin';
  } else if (layer === 'disc') {
    kind = 'disc';
  } else if (layer === 'pns') {
    n = n.replace(/\.$/, '');
    kind = /spinal cord|spinal dura|cauda equina|conus/.test(n) ? 'cord' : 'pns';
  } else if (layer === 'lymph') {
    kind = 'lymph';
  } else {
    for (const [r, to] of ORGAN_MERGE) if (r.test(n)) n = to;
    kind = /valve/.test(n) ? 'valve' : 'organ';
  }
  const color = layer === 'organ' ? ORGAN_COLORS.find(([r]) => r.test(n))[1]
    : layer === 'nerve' ? NEURO_COLORS.find(([r]) => r.test(n))[1] : COLORS[kind];
  return { id: n.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''), name: n, side, kind, layer, color };
}

// BodyParts3D 4.0 (.obj) ใช้พิกัดเดียวกับ 3.0 (มม.)
function readOBJ(file) {
  const map = new Map(), pos = [], idx = [], verts = [];
  for (const line of fs.readFileSync(file, 'latin1').split(/\r?\n/)) {
    if (line.startsWith('v ')) { const [, x, y, z] = line.trim().split(/\s+/); verts.push([+x, +y, +z]); }
    else if (line.startsWith('f ')) {
      const f = line.trim().split(/\s+/).slice(1).map(t => parseInt(t, 10) - 1);
      for (let i = 1; i + 1 < f.length; i++) for (const k of [f[0], f[i], f[i + 1]]) {
        let j = map.get(k);
        if (j === undefined) { const [x, y, z] = verts[k]; j = pos.length / 3; map.set(k, j); pos.push(x * 1e-3, z * 1e-3, -y * 1e-3 + Z_SHIFT); }
        idx.push(j);
      }
    }
  }
  return { pos: new Float32Array(pos), idx: new Uint32Array(idx), tris: idx.length / 3 };
}

function readSTL(file) {
  const b = fs.readFileSync(file);
  const n = b.readUInt32LE(80);
  const map = new Map(), pos = [], idx = [];
  const add = (x, y, z) => {
    const key = `${Math.round(x * 1e3)},${Math.round(y * 1e3)},${Math.round(z * 1e3)}`;
    let k = map.get(key);
    if (k === undefined) { k = pos.length / 3; map.set(key, k); pos.push(x * 1e-3, z * 1e-3, -y * 1e-3 + Z_SHIFT); }
    idx.push(k);
  };
  if (84 + n * 50 === b.length) {
    for (let i = 0; i < n; i++) for (let v = 0; v < 3; v++) {
      const o = 84 + i * 50 + 12 + v * 12;
      add(b.readFloatLE(o), b.readFloatLE(o + 4), b.readFloatLE(o + 8));
    }
  } else {   // ASCII STL
    const re = /vertex\s+(\S+)\s+(\S+)\s+(\S+)/g;
    let m;
    const s = b.toString('latin1');
    while ((m = re.exec(s))) add(+m[1], +m[2], +m[3]);
  }
  return { pos: new Float32Array(pos), idx: new Uint32Array(idx), tris: idx.length / 3 };
}

function simplify(m, maxTri = MAXTRI) {
  const target = Math.max(120 * 3, Math.min(maxTri * 3, Math.floor(m.idx.length * RATIO / 3) * 3));
  if (target >= m.idx.length) return m;
  const [out] = MeshoptSimplifier.simplify(m.idx, m.pos, 3, target, 0.02, ['LockBorder']);
  const remap = new Map(), pos = [];
  const idx = new Uint32Array(out.length);
  for (let i = 0; i < out.length; i++) {
    let k = remap.get(out[i]);
    if (k === undefined) { k = pos.length / 3; remap.set(out[i], k); pos.push(m.pos[out[i] * 3], m.pos[out[i] * 3 + 1], m.pos[out[i] * 3 + 2]); }
    idx[i] = k;
  }
  return { pos: new Float32Array(pos), idx };
}

function normals(pos, idx) {
  const nrm = new Float32Array(pos.length);
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const p of [a, b, c]) { nrm[p] += nx; nrm[p + 1] += ny; nrm[p + 2] += nz; }
  }
  for (let i = 0; i < nrm.length; i += 3) {
    const l = Math.hypot(nrm[i], nrm[i + 1], nrm[i + 2]) || 1;
    nrm[i] /= l; nrm[i + 1] /= l; nrm[i + 2] /= l;
  }
  return nrm;
}

await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;

// selection.json: [[fmaId | path, name, bytes, layer], ...]  (layer = muscle | organ | vessel | nerve | skin)
const selection = JSON.parse(fs.readFileSync(path.join(SRC, 'selection.json'), 'utf8'));
const OUT = { muscle: 'muscles.glb', organ: 'organs.glb', vessel: 'vessels.glb', nerve: 'neuro.glb', skin: 'skin.glb', disc: 'discs.glb', pns: 'nerves.glb', lymph: 'lymph.glb' };
// จำนวนสามเหลี่ยมสูงสุดต่อชิ้นส่วน แยกตามชั้น (skin เป็นผิวชิ้นใหญ่ชิ้นเดียว)
const LAYER_MAXTRI = { skin: 40000 };
const io = new NodeIO().registerExtensions([KHRMeshQuantization, EXTMeshoptCompression]).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

for (const layer of Object.keys(OUT)) {
  const groups = new Map();
  let inTris = 0, outTris = 0;
  const missing = [];
  for (const [fid, name, , l] of selection) {
    if (l !== layer) continue;
    // fid แบบ FMA… = STL ของ 3.0, แบบ path (v4/…/FJ….obj) = OBJ ของ 4.0
    const file = fid.includes('/') ? path.join(SRC, fid) : path.join(SRC, 'stl', fid + '.stl');
    if (!fs.existsSync(file)) { missing.push(fid); continue; }
    const c = classify(name, layer);
    const raw = file.endsWith('.obj') ? readOBJ(file) : readSTL(file);
    inTris += raw.tris;
    const s = simplify(raw, LAYER_MAXTRI[layer]);
    outTris += s.idx.length / 3;
    const key = `${c.id}|${c.side}|${c.kind}`;
    if (!groups.has(key)) groups.set(key, { ...c, list: [] });
    groups.get(key).list.push(s);
  }
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene(layer);
  const mats = {};
  for (const [key, g] of groups) {
    let nv = 0, ni = 0;
    for (const m of g.list) { nv += m.pos.length; ni += m.idx.length; }
    const pos = new Float32Array(nv), idx = new Uint32Array(ni);
    let ov = 0, oi = 0;
    for (const m of g.list) {
      pos.set(m.pos, ov);
      for (let i = 0; i < m.idx.length; i++) idx[oi + i] = m.idx[i] + ov / 3;
      ov += m.pos.length; oi += m.idx.length;
    }
    const mk = g.color.toString(16);
    mats[mk] ||= doc.createMaterial(mk).setBaseColorFactor([(g.color >> 16 & 255) / 255, (g.color >> 8 & 255) / 255, (g.color & 255) / 255, 1]).setRoughnessFactor(0.6).setMetallicFactor(0);
    const prim = doc.createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buffer))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(normals(pos, idx)).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(idx).setBuffer(buffer))
      .setMaterial(mats[mk]);
    scene.addChild(doc.createNode(key).setMesh(doc.createMesh(key).addPrimitive(prim))
      .setExtras({ soft: g.id, name: g.name, side: g.side, kind: g.kind, layer, color: g.color }));
  }
  await doc.transform(quantize({ quantizePosition: 14, quantizeNormal: 10 }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const out = path.join(HERE, OUT[layer]);
  await io.write(out, doc);
  const ids = [...new Set([...groups.values()].map(g => g.id))].sort();
  console.log(`${layer}: groups=${groups.size} structures=${ids.length} tris ${inTris} -> ${outTris} size=${(fs.statSync(out).size / 1024 / 1024).toFixed(2)} MB`);
  if (missing.length) console.log('  missing STL:', missing.length, missing.slice(0, 10).join(' '));
  fs.writeFileSync(path.join(SRC, `ids_${layer}.txt`), ids.join('\n'));
}
