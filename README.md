# CLASS FOOTBALL

เว็บประเมินนักฟุตบอล จัดอันดับ และจัดทีม 2 ฝั่งให้คะแนนรวมใกล้กัน ใช้ Node.js, Neon Postgres และ Render โดยไม่ใช้ Supabase

## ความสามารถ

- เข้าระบบด้วยชื่อเล่นจากรายชื่อ 18 คนและรหัสผ่านร่วม (`1234` โดยค่าเริ่มต้น)
- ประเมินเพื่อนคนอื่นด้วยคะแนน 1–10 ใน 5 ด้าน ห้ามประเมินตัวเอง
- แก้คะแนนเดิมได้ โดยเขียนทับชุดคะแนนเดิมของรอบนั้น
- คำนวณ Weighted Score ด้วยสูตร `(Fitness + Passing + First Touch + 1.5 × Shooting + 1.5 × Ball Control) ÷ 6`
- แสดงอันดับ คะแนนเฉลี่ยรายด้าน และจำนวนผู้ประเมิน โดยไม่เปิดเผยชื่อผู้ให้คะแนน
- จัดผู้เล่นเป็น 2 ทีมด้วยการค้นหาชุดแบ่งที่มีผลรวมคะแนนใกล้กันที่สุด ไม่ใช้ตำแหน่งเป็นเงื่อนไข
- เก็บข้อมูลเป็นรายรอบใน Neon; บันทึกคะแนนแล้วคำนวณอันดับทันที
- Render Cron Job ซิงก์ตารางอันดับจากคะแนนต้นทางทุกชั่วโมง

## Deploy ผ่าน GitHub และ Render

1. สร้างโปรเจกต์ Postgres ใน Neon แล้วคัดลอก **pooled connection string** จากหน้า Connect เก็บ `sslmode=require` ไว้ใน URL
2. สร้าง GitHub repository ชื่อ `FootBall` แล้วอัปโหลดไฟล์ในโฟลเดอร์นี้
3. ใน Render เลือก **New → Blueprint**, เชื่อม repository `FootBall` และให้ Render อ่าน `render.yaml`
4. เมื่อระบบถาม `DATABASE_URL` ให้ใส่ Neon connection string เดียวกันสำหรับทั้งเว็บและ Cron Job; `APP_SECRET` จะถูกสร้างให้อัตโนมัติ
5. Deploy Blueprint จะสร้าง Web Service และ Cron Job ที่รันทุกชั่วโมง (เวลา UTC)
6. เปิด URL ของ Web Service; health check อยู่ที่ `/health`

Render Blueprint อาจถามค่าตัวแปรลับของ environment group ระหว่างสร้างระบบ หากเปลี่ยน `SHARED_PASSWORD` ให้ใช้ค่าที่กำหนดไว้แทน `1234` และอย่าบันทึกรหัสผ่านจริงลง GitHub

## รันในเครื่อง

ต้องมี Node.js 22 ขึ้นไปและ npm

```sh
cp .env.example .env
# ใส่ Neon connection string ใน DATABASE_URL และตั้ง APP_SECRET ใน .env
npm install
npm run db:init
npm run dev
```

เปิด `http://localhost:3000`. `npm run build && npm start` ใช้รัน production build; `npm run cron` ใช้ทดสอบงานรีเฟรชอันดับด้วยตนเอง.

## ฐานข้อมูลและ Cron

ตารางหลักคือ `players`, `assessment_rounds`, `player_assessments`, และ `player_rankings`. การประเมินมี unique constraint ต่อรอบ/ผู้ประเมิน/ผู้เล่น และ constraint ป้องกัน self-rating กับคะแนนนอกช่วง

ไฟล์ `render.yaml` สร้าง cron `football-ranking-refresh` ที่รัน `npm run cron` ทุกชั่วโมงตาม UTC. งานนี้ rebuild ค่าเฉลี่ยและอันดับจากคะแนนประเมินทุกครั้ง ใช้ `DATABASE_URL` จาก environment group เดียวกับ Web Service. เพิ่มรอบใหม่ด้วยคำสั่ง `npm run round:new -- "รอบที่ 2"`; คะแนนรอบเดิมจะยังเก็บแยกไว้.

## ความปลอดภัย

- รหัสผ่านร่วมเป็นรหัสสำหรับการใช้งานในชั้นเรียน ไม่ใช่การยืนยันตัวตนแบบรายบุคคล
- ใช้ session cookie แบบ HttpOnly, SameSite=Strict และ Secure เมื่อรันบน Render
- ต้องกำหนด `APP_SECRET` ใน production; Render สร้าง secret แบบสุ่มให้ผ่าน Blueprint
- API สำหรับอันดับส่งเฉพาะค่าเฉลี่ยรวม ไม่ส่งรหัสผู้ประเมิน
- `DATABASE_URL` และความลับอื่นต้องตั้งเป็น environment variables ห้าม commit ลง repository
