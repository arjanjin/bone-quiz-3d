# Bone Quiz 3D — Gross Anatomy K–S–A

แอปเว็บ 3 มิติสำหรับเรียนกายวิภาคศาสตร์ (Gross Anatomy) ตามแผนการเรียน 7 Block แบบ K–S–A
เปิดใช้ได้บนมือถือและคอมพิวเตอร์: **https://arjanjin.github.io/bone-quiz-3d/**

- สำรวจโครงกระดูก ระดับกระดูกสันหลัง C1–L5 ซี่โครง และ landmark 42 จุด
- ชั้นกล้ามเนื้อ อวัยวะ หลอดเลือด สมอง หมอนรองกระดูก เส้นประสาทส่วนปลาย ต่อมน้ำเหลือง และผิวหนัง
- จำลองเส้นประสาทบาดเจ็บ 29 เส้น (แสดงเส้นประสาทและกล้ามเนื้อที่อ่อนแรง)
- ข้อสอบทายชื่อ/หาตำแหน่ง, OSPE จับเวลา, เคส clinical vignette, แผนการเรียนและทบทวนแบบ spaced repetition (วันที่ 1, 3, 7, 21)

ความคืบหน้าและ reflection เก็บไว้ในเบราว์เซอร์ของผู้ใช้แต่ละเครื่องเท่านั้น

> เนื้อหาทางคลินิกในแอปเขียนตามหลักใน Moore’s Clinically Oriented Anatomy และ Gray’s Anatomy for Students ใช้ประกอบการเรียน ไม่ใช่แหล่งอ้างอิงทางการแพทย์

## ที่มาของโมเดล 3 มิติและสัญญาอนุญาต

| ไฟล์ | ที่มา | สัญญาอนุญาต |
|---|---|---|
| `models/skeleton.glb`, `muscles.glb`, `organs.glb`, `vessels.glb`, `neuro.glb`, `discs.glb`, `skin.glb` | BodyParts3D, © The Database Center for Life Science (DBCLS) — release 3.0 และ 4.0 ([LSDB Archive](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html)) | [CC BY-SA 2.1 JP](https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en) |
| `models/nerves.glb`, `models/lymph.glb` และหลอดเลือดศีรษะ-คอบางส่วนใน `vessels.glb` | [Z-Anatomy](https://github.com/Z-Anatomy/Models-of-human-anatomy) — The libre 3D atlas of anatomy (Gauthier Kervyn และคณะ, พัฒนาต่อจาก BodyParts3D) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |

โมเดลถูกดัดแปลง (ลดจำนวนโพลิกอน รวมชิ้นส่วน แปลงพิกัด และจัดตำแหน่ง) และเผยแพร่ภายใต้สัญญาอนุญาตเดิม
ไม่ได้ใช้ส่วนของ Z-Anatomy ที่มีสัญญาอนุญาตห้ามใช้เชิงพาณิชย์ (หูชั้นใน — Univ. of Dundee, CC BY-NC-SA; ไต — Lissie Cowley, CC BY-NC)

สคริปต์สร้างไฟล์โมเดล: `models/build_skeleton.mjs`, `models/build_layers.mjs`
