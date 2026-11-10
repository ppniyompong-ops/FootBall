INSERT INTO players (name, positions) VALUES
  ('รอม', 'RB/CB'),
  ('พอร์ช', 'LW/ST'),
  ('โช', 'ST/CDM'),
  ('อันดา', 'RB/CB'),
  ('แทน', 'CDM/CM'),
  ('เก้า', 'CAM/LW'),
  ('กาย', 'LB/CDM'),
  ('ปอง', 'RB/RW'),
  ('เนส', 'CB/CDM'),
  ('ที', 'LWF/ST'),
  ('ปกป้อง', 'GK/CM'),
  ('กังฟู', 'GK/CM'),
  ('เช่', 'AMF/ST'),
  ('แผน', 'CDM/CAM'),
  ('แมง', 'LW/RM'),
  ('แปง', 'CB/ST'),
  ('นิว', 'LB/RB'),
  ('กิต', 'CB/CDM')
ON CONFLICT (name) DO UPDATE SET positions = EXCLUDED.positions;

INSERT INTO assessment_rounds (title, is_active)
SELECT 'รอบที่ 1', TRUE
WHERE NOT EXISTS (SELECT 1 FROM assessment_rounds);
