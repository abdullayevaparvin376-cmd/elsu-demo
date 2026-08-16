require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runSeed() {
  const client = await pool.connect();
  try {
    console.log('Seed prosesi başladı...');
    await client.query('BEGIN');

    const studentPass = process.env.SEED_STUDENT_PASSWORD;
    const adminPass = process.env.SEED_ADMIN_PASSWORD;

    if (!studentPass || !adminPass) {
      throw new Error('SEED_STUDENT_PASSWORD and SEED_ADMIN_PASSWORD environment variables are required.');
    }

    const hashedStudentPass = await bcrypt.hash(studentPass, 10);
    const hashedAdminPass = await bcrypt.hash(adminPass, 10);

    // 1. Tələbə və Admin əlavə et
    const studentRes = await client.query(
      `INSERT INTO users (student_id, full_name, role, specialty, course, semester, entrance_score, password_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (student_id) DO UPDATE 
       SET full_name = EXCLUDED.full_name, password_hash = EXCLUDED.password_hash
       RETURNING id;`,
      [
        'DEMO-2006',
        'Abdullayeva Pərvin',
        'STUDENT',
        'Kimya və biologiya müəllimliyi',
        'III',
        'VI',
        485.50,
        hashedStudentPass
      ]
    );
    const studentUserId = studentRes.rows[0].id;

    await client.query(
      `INSERT INTO users (student_id, full_name, role, specialty, course, semester, entrance_score, password_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (student_id) DO UPDATE 
       SET full_name = EXCLUDED.full_name, password_hash = EXCLUDED.password_hash;`,
      ['ADMIN-DEMO', 'Sistem Administratoru', 'ADMIN', 'Tədris İdarəetməsi', 'Heyət', '-', 0.00, hashedAdminPass]
    );

    // 2. Fənn əlavə et
    const subjectRes = await client.query(
      `INSERT INTO subjects (code, name, credits, semester)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
       RETURNING id;`,
      ['CHEM-302', 'ANALİTİK KİMYA', 6, 'VI']
    );
    const subjectId = subjectRes.rows[0].id;

    // 3. Qiymətləndirmə qeydi
    await client.query(
      `INSERT INTO student_grades (user_id, subject_id, attendance_score, seminar_score, lecture_score, qb_score, exam_score)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, subject_id) DO UPDATE
       SET attendance_score = EXCLUDED.attendance_score, seminar_score = EXCLUDED.seminar_score;`,
      [studentUserId, subjectId, 10.00, 18.50, 9.00, 10.00, null]
    );

    // 4. Davamiyyət və Jurnal qeydləri
    await client.query('DELETE FROM attendance_records WHERE user_id = $1;', [studentUserId]);
    const attendanceData = [
      [studentUserId, subjectId, '2026-03-02', 'Mühazirə', 'İ', 'Mövzu: Titrimetrik analiz'],
      [studentUserId, subjectId, '2026-03-09', 'Seminar', 'İ', 'Fəal iştirak (9 bal)'],
      [studentUserId, subjectId, '2026-03-16', 'Mühazirə', 'Q', 'Üzrlü səbəb qeyd edilməyib'],
      [studentUserId, subjectId, '2026-03-23', 'Seminar', 'İ', 'Laboratoriya işi (10 bal)'],
      [studentUserId, subjectId, '2026-03-30', 'Seminar', 'B', 'Xəstəlik arayışı təqdim olunub']
    ];

    for (const record of attendanceData) {
      await client.query(
        `INSERT INTO attendance_records (user_id, subject_id, lesson_date, lesson_type, status, note)
         VALUES ($1, $2, $3, $4, $5, $6);`,
        record
      );
    }

    // 5. İmtahan Slotları
    await client.query('DELETE FROM exam_slots WHERE subject_id = $1;', [subjectId]);
    await client.query(
      `INSERT INTO exam_slots (subject_id, exam_date, exam_time, room, capacity, is_active)
       VALUES 
       ($1, '2026-06-10', '09:00', 'Auditoriya 304', 25, true),
       ($1, '2026-06-10', '14:00', 'Auditoriya 304', 25, true),
       ($1, '2026-06-12', '11:00', 'Auditoriya 210', 20, false);`,
      [subjectId]
    );

    // 6. İlkin Bildiriş
    await client.query('DELETE FROM notifications WHERE user_id = $1;', [studentUserId]);
    await client.query(
      `INSERT INTO notifications (user_id, title, message)
       VALUES ($1, $2, $3);`,
      [
        studentUserId,
        'Yaz semestri imtahan qeydiyyatı',
        'Hörmətli tələbə, Analitik Kimya fənni üzrə imtahan vaxtınızı müvafiq bölmədən seçməyiniz xahiş olunur.'
      ]
    );

    await client.query('COMMIT');
    console.log('Seed prosesi uğurla tamamlandı.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed xətası:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

runSeed();
