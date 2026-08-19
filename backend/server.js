require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('JWT_SECRET environment variable is required.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

app.use(cors({
  origin: 'https://glistening-vacherin-92749f.netlify.app',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());

// Auth Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Avtorizasiya tokeni tapılmadı.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token etibarsızdır və ya vaxtı bitib.' });
    }
    req.user = user;
    next();
  });
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: 'Bu əməliyyat üçün icazəniz yoxdur.' });
    }
    next();
  };
}

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});
// Captcha Endpoint
// Captcha Endpoint
const captchaStore = {};
app.get('/api/auth/captcha', (req, res) => {
  const n1 = Math.floor(Math.random() * 8) + 2;
  const n2 = Math.floor(Math.random() * 8) + 1;
  const id = 'captcha_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
  captchaStore[id] = n1 + n2;
  res.json({
    question: `${n1} + ${n2} = ?`,
    captchaId: id
  });
});
// Captcha Endpoint
const captchaStore = {};

app.get('/api/auth/captcha', (req, res) => {
  const n1 = Math.floor(Math.random() * 8) + 2;
  const n2 = Math.floor(Math.random() * 8) + 1;
  const id = 'captcha_' + Date.now() + '_' + Math.floor(Math.random() * 10000);

  captchaStore[id] = n1 + n2;

  // 5 dəqiqədən sonra köhnə captcha-ları təmizləyək (yaddaş sızmasının qarşısını almaq üçün)
  setTimeout(() => delete captchaStore[id], 5 * 60 * 1000);

  res.json({
    question: `${n1} + ${n2} = ?`,
    captchaId: id
  });
});

// 1. LOGIN ENDPOINT
app.post('/api/auth/login', async (req, res) => {
  const { studentId, username, password, role, captchaId, captchaAnswer } = req.body;
  const loginId = studentId || username; // frontend "username" göndərsə də işləsin

  if (!loginId || !password) {
    return res.status(400).json({ error: 'İstifadəçi ID və şifrə daxil edilməlidir.' });
  }

  // --- CAPTCHA yoxlanışı ---
  if (!captchaId || !captchaStore.hasOwnProperty(captchaId)) {
    return res.status(400).json({ error: 'CAPTCHA vaxtı bitib və ya etibarsızdır, yenidən cəhd edin.' });
  }

  const expectedAnswer = captchaStore[captchaId];
  delete captchaStore[captchaId]; // bir dəfə istifadə olunsun, təkrar istifadə olunmasın

  if (parseInt(captchaAnswer, 10) !== expectedAnswer) {
    return res.status(400).json({ error: 'CAPTCHA cavabı yanlışdır.' });
  }
  // --- CAPTCHA yoxlanışı bitdi ---

  try {
    const userQuery = await pool.query(
      'SELECT * FROM users WHERE student_id = $1',
      [loginId.trim()]
    );

    if (userQuery.rows.length === 0) {
      return res.status(401).json({ error: 'İstifadəçi ID və ya şifrə yanlışdır.' });
    }

    const user = userQuery.rows[0];

    if (role && user.role !== role) {
      return res.status(403).json({ error: 'Seçilmiş rol üçün icazə verilmədi.' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'İstifadəçi ID və ya şifrə yanlışdır.' });
    }

    const token = jwt.sign(
      { id: user.id, studentId: user.student_id, role: user.role, fullName: user.full_name },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        studentId: user.student_id,
        fullName: user.full_name,
        role: user.role,
        specialty: user.specialty,
        course: user.course,
        semester: user.semester,
        entranceScore: user.entrance_score
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server daxili xətası baş verdi.' });
  }
});

// ==========================================
// TƏLƏBƏ ENDPOINT-LƏRİ
// ==========================================

// Tələbə Profili
app.get('/api/student/profile', authenticateToken, requireRole('STUDENT'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, student_id, full_name, role, specialty, course, semester, entrance_score FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Tələbə tapılmadı.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tələbənin Fənləri və Jurnal Göstəriciləri
app.get('/api/student/subjects', authenticateToken, requireRole('STUDENT'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        s.id AS subject_id,
        s.code,
        s.name,
        s.credits,
        s.semester,
        COALESCE(sg.attendance_score, 0) AS attendance_score,
        COALESCE(sg.seminar_score, 0) AS seminar_score,
        COALESCE(sg.lecture_score, 0) AS lecture_score,
        COALESCE(sg.qb_score, 0) AS qb_score
      FROM subjects s
      LEFT JOIN student_grades sg ON s.id = sg.subject_id AND sg.user_id = $1
      ORDER BY s.id ASC;
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fənn üzrə Davamiyyət Siyahısı
app.get('/api/student/attendance', authenticateToken, requireRole('STUDENT'), async (req, res) => {
  const { subjectId } = req.query;
  try {
    let query = `
      SELECT ar.*, s.name as subject_name 
      FROM attendance_records ar
      JOIN subjects s ON ar.subject_id = s.id
      WHERE ar.user_id = $1
    `;
    const params = [req.user.id];

    if (subjectId) {
      query += ` AND ar.subject_id = $2`;
      params.push(subjectId);
    }
    query += ` ORDER BY ar.lesson_date DESC;`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tələbə üçün YALNIZ Admin tərəfindən aktiv edilmiş İmtahan Slotları
app.get('/api/student/exam-slots', authenticateToken, requireRole('STUDENT'), async (req, res) => {
  try {
    const slots = await pool.query(`
      SELECT 
        es.id,
        es.subject_id,
        s.name AS subject_name,
        s.code AS subject_code,
        TO_CHAR(es.exam_date, 'YYYY-MM-DD') AS exam_date,
        es.exam_time,
        es.room,
        es.capacity,
        (SELECT COUNT(*) FROM exam_selections WHERE exam_slot_id = es.id) AS booked_count
      FROM exam_slots es
      JOIN subjects s ON es.subject_id = s.id
      WHERE es.is_active = true
      ORDER BY es.exam_date ASC, es.exam_time ASC;
    `);

    const mySelections = await pool.query(
      'SELECT * FROM exam_selections WHERE user_id = $1',
      [req.user.id]
    );

    res.json({
      availableSlots: slots.rows,
      mySelections: mySelections.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// İmtahan Vaxtı Seçimi
app.post('/api/student/exam-selection', authenticateToken, requireRole('STUDENT'), async (req, res) => {
  const { subjectId, examSlotId } = req.body;
  if (!subjectId || !examSlotId) {
    return res.status(400).json({ error: 'Fənn və slot mütləq seçilməlidir.' });
  }

  try {
    const slotCheck = await pool.query(
      'SELECT * FROM exam_slots WHERE id = $1 AND subject_id = $2 AND is_active = true',
      [examSlotId, subjectId]
    );

    if (slotCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Seçilmiş imtahan vaxtı mövcud deyil və ya aktivləşdirilməyib.' });
    }

    const countRes = await pool.query(
      'SELECT COUNT(*) FROM exam_selections WHERE exam_slot_id = $1',
      [examSlotId]
    );
    if (parseInt(countRes.rows[0].count, 10) >= slotCheck.rows[0].capacity) {
      return res.status(400).json({ error: 'Bu imtahan vaxtı üçün bütün yerlər dolmuşdur.' });
    }

    await pool.query(`
      INSERT INTO exam_selections (user_id, subject_id, exam_slot_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, subject_id)
      DO UPDATE SET exam_slot_id = EXCLUDED.exam_slot_id, selected_at = CURRENT_TIMESTAMP;
    `, [req.user.id, subjectId, examSlotId]);

    res.json({ message: 'İmtahan vaxtınız uğurla seçildi' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Düzəliş Tələbi Göndər
app.post('/api/student/correction-request', authenticateToken, requireRole('STUDENT'), async (req, res) => {
  const { subjectId, category, description } = req.body;
  if (!subjectId || !category || !description) {
    return res.status(400).json({ error: 'Məlumatlar tam doldurulmalıdır.' });
  }

  try {
    await pool.query(`
      INSERT INTO correction_requests (user_id, subject_id, category, description)
      VALUES ($1, $2, $3, $4);
    `, [req.user.id, subjectId, category, description]);

    res.json({ message: 'Düzəliş tələbiniz qeydə alındı və baxılmaq üçün adminə göndərildi.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bildirişlər
app.get('/api/student/notifications', authenticateToken, requireRole('STUDENT'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM notifications WHERE user_id = $1 OR user_id IS NULL ORDER BY created_at DESC;',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// ADMIN ENDPOINT-LƏRİ
// ==========================================

// Tələbələrin siyahısı və qiymətləri
app.get('/api/admin/students', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id as user_id,
        u.student_id,
        u.full_name,
        u.specialty,
        u.course,
        u.semester,
        u.entrance_score,
        s.id as subject_id,
        s.name as subject_name,
        sg.attendance_score,
        sg.seminar_score,
        sg.lecture_score,
        sg.qb_score,
        sg.exam_score,
        sg.id as grade_id
      FROM users u
      LEFT JOIN student_grades sg ON u.id = sg.user_id
      LEFT JOIN subjects s ON sg.subject_id = s.id
      WHERE u.role = 'STUDENT'
      ORDER BY u.id ASC;
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fənlər Siyahısı
app.get('/api/admin/subjects', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM subjects ORDER BY id ASC;');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bütün İmtahan Slotları
app.get('/api/admin/exam-slots', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        es.*,
        s.name as subject_name,
        TO_CHAR(es.exam_date, 'YYYY-MM-DD') AS formatted_date,
        (SELECT COUNT(*) FROM exam_selections WHERE exam_slot_id = es.id) AS booked_count
      FROM exam_slots es
      JOIN subjects s ON es.subject_id = s.id
      ORDER BY es.exam_date DESC, es.exam_time ASC;
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Yeni İmtahan Slotu Yaratmaq
app.post('/api/admin/exam-slots', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  const { subjectId, examDate, examTime, room, capacity, isActive } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO exam_slots (subject_id, exam_date, exam_time, room, capacity, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `, [subjectId, examDate, examTime, room, capacity || 30, isActive !== undefined ? isActive : true]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Slotu Yeniləmək
app.put('/api/admin/exam-slots/:id', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  const { id } = req.params;
  const { examDate, examTime, room, capacity, isActive } = req.body;
  try {
    const result = await pool.query(`
      UPDATE exam_slots
      SET 
        exam_date = COALESCE($1, exam_date),
        exam_time = COALESCE($2, exam_time),
        room = COALESCE($3, room),
        capacity = COALESCE($4, capacity),
        is_active = COALESCE($5, is_active)
      WHERE id = $6
      RETURNING *;
    `, [examDate, examTime, room, capacity, isActive, id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Slotu Silmək
app.delete('/api/admin/exam-slots/:id', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM exam_slots WHERE id = $1', [id]);
    res.json({ message: 'Slot uğurla silindi.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tələbə Qiymətlərini Dəyişmək
app.put('/api/admin/grades/:userId/:subjectId', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  const { userId, subjectId } = req.params;
  const { attendanceScore, seminarScore, lectureScore, qbScore, examScore } = req.body;

  try {
    const result = await pool.query(`
      INSERT INTO student_grades (user_id, subject_id, attendance_score, seminar_score, lecture_score, qb_score, exam_score, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, subject_id)
      DO UPDATE SET
        attendance_score = COALESCE($3, student_grades.attendance_score),
        seminar_score = COALESCE($4, student_grades.seminar_score),
        lecture_score = COALESCE($5, student_grades.lecture_score),
        qb_score = COALESCE($6, student_grades.qb_score),
        exam_score = $7,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `, [userId, subjectId, attendanceScore, seminarScore, lectureScore, qbScore, examScore]);

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Düzəliş Tələbləri
app.get('/api/admin/correction-requests', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        cr.*,
        u.full_name AS student_name,
        u.student_id AS student_code,
        s.name AS subject_name
      FROM correction_requests cr
      JOIN users u ON cr.user_id = u.id
      JOIN subjects s ON cr.subject_id = s.id
      ORDER BY cr.created_at DESC;
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/correction-requests/:id', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  const { id } = req.params;
  const { status, adminNote } = req.body;
  try {
    const result = await pool.query(`
      UPDATE correction_requests
      SET status = $1, admin_note = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *;
    `, [status, adminNote, id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bildiriş Göndərmək
app.post('/api/admin/notifications', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  const { userId, title, message } = req.body;
  if (!title || !message) {
    return res.status(400).json({ error: 'Başlıq və mətn mütləqdir.' });
  }
  try {
    const result = await pool.query(`
      INSERT INTO notifications (user_id, title, message)
      VALUES ($1, $2, $3)
      RETURNING *;
    `, [userId || null, title, message]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`ELSU Demo Backend server ${PORT} portunda aktivdir.`);
});
