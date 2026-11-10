# CLASS FOOTBALL

เว็บประเมินนักฟุตบอล จัดอันดับ และจัดทีม 2 ฝั่งให้คะแนนรวมใกล้กัน ใช้ Node.js, Neon Postgres และ Render โดยไม่ใช้ Supabase

## ความสามารถ

- เข้าระบบด้วยชื่อเล่นและรหัสผ่านสำหรับผู้เล่น
- ประเมินเพื่อนคนอื่นด้วยคะแนน 1–10 ใน 5 ด้าน; ผู้รักษาประตูมีเกณฑ์เฉพาะ: โยนบอลและเตะเปิดเกม, ออกมาตัดบอล, รับลูกสามเหลี่ยม, รับลูกเลียด และปฏิกิริยาเซฟลูกยิง
- แก้คะแนนเดิมได้ โดยเขียนทับชุดคะแนนเดิมของรอบนั้น
- แสดงอันดับ คะแนนเฉลี่ยรายด้าน และจำนวนผู้ประเมิน; ผู้เล่นทั่วไปไม่เห็นชื่อผู้ให้คะแนน
- ผู้เล่นทุกคนปรับและบันทึกทีม A/B ได้; ผู้ดูแลมีสิทธิ์ปรับทีมและดูว่าใครประเมินใครด้วยคะแนนเท่าไร
- จัดผู้เล่นเป็น 2 ทีมด้วยการค้นหาชุดแบ่งที่มีผลรวมคะแนนใกล้กันที่สุด ไม่ใช้ตำแหน่งเป็นเงื่อนไข
- เก็บข้อมูลเป็นรายรอบใน Neon; บันทึกคะแนนแล้วคำนวณอันดับทันที
- GitHub Actions ซิงก์ตารางอันดับจากคะแนนต้นทางทุกชั่วโมง

## Deploy ผ่าน GitHub และ Render

1. สร้างโปรเจกต์ Postgres ใน Neon แล้วคัดลอก **pooled connection string** จากหน้า Connect เก็บ `sslmode=require` ไว้ใน URL
2. ใช้ GitHub repository ส่วนตัว `ppniyompong-ops/FootBall` ที่มีโค้ดโปรเจกต์นี้อยู่แล้ว
3. ใน Render เลือก **New → Blueprint**, เชื่อม repository `FootBall` และให้ Render อ่าน `render.yaml`
4. เมื่อระบบถาม `DATABASE_URL` ให้ใส่ Neon connection string, กำหนด `ADMIN_PASSWORD` แยกจากรหัสผู้เล่น และให้ `APP_SECRET` สร้างอัตโนมัติ
5. Deploy Blueprint จะสร้าง Web Service บน Render
6. ใน GitHub ไปที่ **Settings → Secrets and variables → Actions** แล้วเพิ่ม repository secret ชื่อ `DATABASE_URL` โดยใช้ Neon connection string เดียวกัน
7. GitHub Actions จะ rebuild อันดับทุกชั่วโมงที่นาที 17 UTC; กด **Actions → Refresh cached rankings → Run workflow** เพื่อสั่งรันเองได้
8. เปิด URL ของ Web Service; health check อยู่ที่ `/health`

Render Blueprint จะถาม `DATABASE_URL` และ `ADMIN_PASSWORD` ระหว่างสร้างระบบ หากเปลี่ยน `SHARED_PASSWORD` ให้ใช้ค่าที่กำหนดไว้แทน `1234` และอย่าบันทึกรหัสผ่านจริงลง GitHub

## รันในเครื่อง

ต้องมี Node.js 22 ขึ้นไปและ npm

```sh
cp .env.example .env
# ใส่ Neon connection string ใน DATABASE_URL และตั้ง APP_SECRET กับ ADMIN_PASSWORD ใน .env
npm install
npm run db:init
npm run dev
```

เปิด `http://localhost:3000`. `npm run build && npm start` ใช้รัน production build; `npm run cron` ใช้ทดสอบงานรีเฟรชอันดับด้วยตนเอง.

## ฐานข้อมูลและการอัปเดตอันดับ

ตารางหลักคือ `players`, `assessment_rounds`, `player_assessments`, และ `player_rankings`. การประเมินมี unique constraint ต่อรอบ/ผู้ประเมิน/ผู้เล่น และ constraint ป้องกัน self-rating กับคะแนนนอกช่วง

การส่งหรือแก้คะแนนจะคำนวณอันดับทันที; GitHub Actions ใน `.github/workflows/refresh-rankings.yml` จะ rebuild ตารางอันดับจากคะแนนดิบทุกชั่วโมงเป็นงานตรวจทานเสริม และสั่งรันเองได้จากหน้า Actions. ตั้ง secret `DATABASE_URL` ใน GitHub repository ด้วย pooled Neon connection string. เพิ่มรอบใหม่ด้วยคำสั่ง `npm run round:new -- "รอบที่ 2"`; คะแนนรอบเดิมจะยังเก็บแยกไว้.

## ความปลอดภัย

- รหัสผู้เล่นใช้สำหรับการใช้งานในชั้นเรียน; รหัสผู้ดูแลต้องแยกเป็น `ADMIN_PASSWORD`
- ใช้ session cookie แบบ HttpOnly, SameSite=Strict และ Secure เมื่อรันบน Render
- ต้องกำหนด `APP_SECRET` ใน production; Render สร้าง secret แบบสุ่มให้ผ่าน Blueprint
- API สำหรับผู้เล่นไม่ส่งชื่อผู้ประเมิน; มีเพียง API ผู้ดูแลที่ล็อกอินแล้วซึ่งส่งข้อมูลผู้ประเมิน
- `DATABASE_URL` และความลับอื่นต้องตั้งเป็น environment variables ห้าม commit ลง repository
