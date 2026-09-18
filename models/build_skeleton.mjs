// Build skeleton.glb from BodyParts3D STL files.
// - maps each FMA part to an app bone id + side
// - welds, simplifies (meshoptimizer), merges per (bone, side, kind)
// - converts mm/Z-up/front=-Y  ->  m/Y-up/front=+Z
// - writes quantized + meshopt-compressed GLB
import fs from 'fs';
import { Document, NodeIO } from '@gltf-transform/core';
import { KHRMeshQuantization, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { quantize, meshopt } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';

const DIR = '../bp3d/assets/BodyParts3D_data/stl/';
const RATIO = Number(process.env.RATIO || 0.1);
const OUT = process.argv[2] || 'skeleton.glb';

function classify(name) {
  const n = name.toLowerCase();
  const side = /\bleft\b/.test(n) ? 1 : /\bright\b/.test(n) ? -1 : 0;
  let id, kind = 'bone';
  if (/tooth/.test(n)) { id = /lower/.test(n) ? 'mandible' : 'skull'; kind = 'tooth'; }
  else if (/mandible/.test(n)) id = 'mandible';
  else if (/frontal|occipital|sphenoid|temporal|ethmoid|parietal|zygomatic|lacrimal|nasal bone|maxilla|palatine|concha|vomer/.test(n)) id = 'skull';
  else if (/vertebra|atlas|axis/.test(n)) id = 'vertebral';
  else if (/sacrum/.test(n)) id = 'sacrum';
  else if (/manubrium|sternum|xiphoid/.test(n)) id = 'sternum';
  else if (/costal cartilage/.test(n)) { id = 'ribs'; kind = 'cart'; }
  else if (/\brib\b/.test(n)) id = 'ribs';
  else if (/clavicle/.test(n)) id = 'clavicle';
  else if (/scapula/.test(n)) id = 'scapula';
  else if (/humerus/.test(n)) id = 'humerus';
  else if (/radius/.test(n)) id = 'radius';
  else if (/ulna/.test(n)) id = 'ulna';
  else if (/scaphoid|lunate|triquetr|pisiform|trapezium|trapezoid|capitate|hamate/.test(n)) id = 'carpals';
  else if (/metacarpal/.test(n)) id = 'metacarpals';
  else if (/phalanx/.test(n) && /finger|thumb/.test(n)) id = 'phalanges_hand';
  else if (/phalanx/.test(n) && /toe/.test(n)) id = 'phalanges_foot';
  else if (/hip bone/.test(n)) id = 'coxa';
  else if (/femur/.test(n)) id = 'femur';
  else if (/patella/.test(n)) id = 'patella';
  else if (/tibia/.test(n)) id = 'tibia';
  else if (/fibula/.test(n)) id = 'fibula';
  else if (/talus|calcaneus|navicular|cuneiform|cuboid/.test(n)) id = 'tarsals';
  else if (/metatarsal/.test(n)) id = 'metatarsals';
  return id ? { id, side, kind } : null;
}

// Z-shift so the spine sits near z≈-0.04 (matches old procedural model)
const Z_SHIFT = -0.11;
function readSTL(file) {
  const b = fs.readFileSync(file);
  const n = b.readUInt32LE(80);
  if (84 + n * 50 !== b.length) throw new Error('not binary STL: ' + file);
  const map = new Map(), pos = [], idx = new Uint32Array(n * 3);
  for (let i = 0; i < n; i++) for (let v = 0; v < 3; v++) {
    const o = 84 + i * 50 + 12 + v * 12;
    const x = b.readFloatLE(o), y = b.readFloatLE(o + 4), z = b.readFloatLE(o + 8);
    const key = `${Math.round(x * 1e3)},${Math.round(y * 1e3)},${Math.round(z * 1e3)}`;
    let k = map.get(key);
    if (k === undefined) { k = pos.length / 3; map.set(key, k); pos.push(x * 1e-3, z * 1e-3, -y * 1e-3 + Z_SHIFT); }
    idx[i * 3 + v] = k;
  }
  return { pos: new Float32Array(pos), idx, tris: n };
}

function simplify(m, ratio) {
  const target = Math.max(240 * 3, Math.floor(m.idx.length * ratio / 3) * 3);
  if (target >= m.idx.length) return m;
  const [out] = MeshoptSimplifier.simplify(m.idx, m.pos, 3, target, 0.02, ['LockBorder']);
  // compact vertices
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

const parts = fs.readFileSync('../bone_ids.txt', 'utf8').trim().split('\n').map(l => l.split('\t'));
const groups = new Map();
let inTris = 0, outTris = 0;
const skipped = [];
for (const [fid, name] of parts) {
  const c = classify(name);
  if (!c) { skipped.push(name); continue; }
  const raw = readSTL(DIR + fid + '.stl');
  inTris += raw.tris;
  const s = simplify(raw, c.kind === 'tooth' ? RATIO * 0.4 : RATIO);
  outTris += s.idx.length / 3;
  const key = `${c.id}|${c.side}|${c.kind}`;
  if (!groups.has(key)) groups.set(key, { ...c, list: [] });
  groups.get(key).list.push(s);
}

const doc = new Document();
const buffer = doc.createBuffer();
const scene = doc.createScene('skeleton');
const mats = {
  bone: doc.createMaterial('bone').setBaseColorFactor([0.83, 0.74, 0.58, 1]).setRoughnessFactor(0.6).setMetallicFactor(0),
  cart: doc.createMaterial('cart').setBaseColorFactor([0.72, 0.82, 0.88, 1]).setRoughnessFactor(0.45).setMetallicFactor(0),
  tooth: doc.createMaterial('tooth').setBaseColorFactor([0.95, 0.93, 0.86, 1]).setRoughnessFactor(0.35).setMetallicFactor(0),
};
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
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buffer))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(normals(pos, idx)).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(idx).setBuffer(buffer))
    .setMaterial(mats[g.kind]);
  const mesh = doc.createMesh(key).addPrimitive(prim);
  scene.addChild(doc.createNode(key).setMesh(mesh).setExtras({ bone: g.id, side: g.side, kind: g.kind }));
}

await doc.transform(quantize({ quantizePosition: 14, quantizeNormal: 10 }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
const io = new NodeIO().registerExtensions([KHRMeshQuantization, EXTMeshoptCompression]).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
await io.write(OUT, doc);
console.log(`parts=${parts.length} groups=${groups.size} tris ${inTris} -> ${outTris}  size=${(fs.statSync(OUT).size / 1024 / 1024).toFixed(2)} MB`);
if (skipped.length) console.log('skipped:', skipped);
console.log([...new Set([...groups.values()].map(g => g.id))].sort().join(' '));
