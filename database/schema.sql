-- Mövcud cədvəlləri təmizlə
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS correction_requests CASCADE;
DROP TABLE IF EXISTS exam_selections CASCADE;
DROP TABLE IF EXISTS exam_slots CASCADE;
DROP TABLE IF EXISTS attendance_records CASCADE;
DROP TABLE IF EXISTS student_grades CASCADE;
DROP TABLE IF EXISTS subjects CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- İstifadəçilər cədvəli
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    student_id VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('STUDENT', 'ADMIN')),
    specialty VARCHAR(150),
    course VARCHAR(20),
    semester VARCHAR(20),
    entrance_score NUMERIC(5, 2) DEFAULT 0.00,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Fənlər cədvəli
CREATE TABLE subjects (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    credits INT DEFAULT 6,
    semester VARCHAR(20) NOT NULL
);

-- Tələbə qiymətləndirmə cədvəli
CREATE TABLE student_grades (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    subject_id INT REFERENCES subjects(id) ON DELETE CASCADE,
    attendance_score NUMERIC(5, 2) DEFAULT 0.00,
    seminar_score NUMERIC(5, 2) DEFAULT 0.00,
    lecture_score NUMERIC(5, 2) DEFAULT 0.00,
    qb_score NUMERIC(5, 2) DEFAULT 0.00,
    exam_score NUMERIC(5, 2) DEFAULT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_subject_grade UNIQUE (user_id, subject_id)
);

-- Davamiyyət və Elektron Jurnal qeydləri
CREATE TABLE attendance_records (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    subject_id INT REFERENCES subjects(id) ON DELETE CASCADE,
    lesson_date DATE NOT NULL,
    lesson_type VARCHAR(50) NOT NULL,
    status VARCHAR(10) NOT NULL CHECK (status IN ('İ', 'Q', 'B')),
    note VARCHAR(255)
);

-- İmtahan slotları
CREATE TABLE exam_slots (
    id SERIAL PRIMARY KEY,
    subject_id INT REFERENCES subjects(id) ON DELETE CASCADE,
    exam_date DATE NOT NULL,
    exam_time VARCHAR(20) NOT NULL,
    room VARCHAR(50) NOT NULL,
    capacity INT NOT NULL DEFAULT 30,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tələbələrin seçdiyi imtahan vaxtları
CREATE TABLE exam_selections (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    subject_id INT REFERENCES subjects(id) ON DELETE CASCADE,
    exam_slot_id INT REFERENCES exam_slots(id) ON DELETE CASCADE,
    selected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_subject_slot UNIQUE (user_id, subject_id)
);

-- Düzəliş tələbləri cədvəli
CREATE TABLE correction_requests (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    subject_id INT REFERENCES subjects(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    admin_note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bildirişlər cədvəli
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
