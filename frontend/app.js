const API_BASE_URL = (window.ELSU_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');

function showToast(msg) {
  const toast = document.getElementById('toastNotification');
  toast.innerText = msg;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3500);
}

// CAPTCHA Generator
function generateCaptcha() {
  const num1 = Math.floor(Math.random() * 9) + 1;
  const num2 = Math.floor(Math.random() * 9) + 1;
  captchaAnswer = num1 + num2;
  const qEl = document.getElementById('captchaQuestion');
  if (qEl) qEl.innerText = `${num1} + ${num2} = ?`;
  const inputEl = document.getElementById('captchaInput');
  if (inputEl) inputEl.value = '';
}

document.getElementById('refreshCaptchaBtn').addEventListener('click', generateCaptcha);

// Login Tabs Switching
document.getElementById('tabStudent').addEventListener('click', () => {
  currentRole = 'STUDENT';
  document.getElementById('tabStudent').classList.add('active');
  document.getElementById('tabAdmin').classList.remove('active');
  document.getElementById('userIdLabel').innerText = 'Tələbə ID';
  document.getElementById('loginUserId').placeholder = 'Məs: DEMO-2006';
});

document.getElementById('tabAdmin').addEventListener('click', () => {
  currentRole = 'ADMIN';
  document.getElementById('tabAdmin').classList.add('active');
  document.getElementById('tabStudent').classList.remove('active');
  document.getElementById('userIdLabel').innerText = 'Admin ID';
  document.getElementById('loginUserId').placeholder = 'Məs: ADMIN-DEMO';
});

// Login Form Submit
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const inputCaptcha = parseInt(document.getElementById('captchaInput').value, 10);
  if (inputCaptcha !== captchaAnswer) {
    showToast('Təhlükəsizlik kodu (CAPTCHA) yanlışdır!');
    generateCaptcha();
    return;
  }

  const studentId = document.getElementById('loginUserId').value.trim();
  const password = document.getElementById('loginPassword').value;

  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, password, role: currentRole })
    });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Giriş uğursuz oldu.');
      generateCaptcha();
      return;
    }

    localStorage.setItem('elsu_token', data.token);
    localStorage.setItem('elsu_user', JSON.stringify(data.user));
    initApp();
  } catch (err) {
    showToast('Serverə qoşulma xətası. Backend API URL-i yoxlayın.');
  }
});

function logout() {
  localStorage.removeItem('elsu_token');
  localStorage.removeItem('elsu_user');
  document.getElementById('studentDashboard').classList.add('hidden');
  document.getElementById('adminDashboard').classList.add('hidden');
  document.getElementById('loginSection').classList.remove('hidden');
  generateCaptcha();
}

function getAuthHeaders() {
  const token = localStorage.getItem('elsu_token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

// Student Tab Switcher
function switchStudentTab(tabId) {
  document.querySelectorAll('#studentDashboard .subtab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('#studentDashboard .subtab-content').forEach(c => c.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById(tabId).classList.add('active');
}

// Admin Tab Switcher
function switchAdminTab(tabId) {
  document.querySelectorAll('#adminDashboard .subtab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('#adminDashboard .subtab-content').forEach(c => c.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById(tabId).classList.add('active');
}

// ----------------------------------------------------
// TƏLƏBƏ MƏLUMATLARININ YÜKLƏNMƏSİ
// ----------------------------------------------------
async function loadStudentPortal() {
  try {
    const user = JSON.parse(localStorage.getItem('elsu_user'));
    document.getElementById('studentNavName').innerText = user.fullName;
    document.getElementById('stProfileName').innerText = user.fullName;
    document.getElementById('stProfileSpecialty').innerText = user.specialty || '-';
    document.getElementById('stProfileCourseSem').innerText = `${user.course || '-'} Kurs / ${user.semester || '-'} Semestr`;
    document.getElementById('stProfileEntranceScore').innerText = `${user.entranceScore || '0.00'} bal`;

    // 1. Fənlər və Jurnal
    const subRes = await fetch(`${API_BASE_URL}/api/student/subjects`, { headers: getAuthHeaders() });
    const subjects = await subRes.json();
    const tbody = document.getElementById('studentSubjectsTableBody');
    tbody.innerHTML = '';

    const corrSelect = document.getElementById('corrSubjectSelect');
    if (corrSelect) corrSelect.innerHTML = '';

    subjects.forEach(s => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${s.code}</strong></td>
        <td>${s.name}</td>
        <td>${s.credits}</td>
        <td>${s.attendance_score}</td>
        <td>${s.seminar_score}</td>
        <td>${s.lecture_score}</td>
        <td>${s.qb_score}</td>
      `;
      tbody.appendChild(tr);

      if (corrSelect) {
        const opt = document.createElement('option');
        opt.value = s.subject_id;
        opt.innerText = s.name;
        corrSelect.appendChild(opt);
      }
    });

    // 2. Davamiyyət
    const attRes = await fetch(`${API_BASE_URL}/api/student/attendance`, { headers: getAuthHeaders() });
    const attendance = await attRes.json();
    const attTbody = document.getElementById('studentAttendanceTableBody');
    attTbody.innerHTML = '';
    attendance.forEach(a => {
      const tr = document.createElement('tr');
      const badgeClass = a.status === 'İ' ? 'i' : (a.status === 'Q' ? 'q' : 'b');
      const label = a.status === 'İ' ? 'İştirak' : (a.status === 'Q' ? 'Qayıb' : 'Bəzrsiz');
      tr.innerHTML = `
        <td>${a.lesson_date.split('T')[0]}</td>
        <td>${a.lesson_type}</td>
        <td><span class="badge-att ${badgeClass}">${a.status} (${label})</span></td>
        <td>${a.note || '-'}</td>
      `;
      attTbody.appendChild(tr);
    });

    // 3. İmtahan Slotları
    loadStudentExamSlots();

    // 4. Bildirişlər
    const notifRes = await fetch(`${API_BASE_URL}/api/student/notifications`, { headers: getAuthHeaders() });
    const notifs = await notifRes.json();
    const notifContainer = document.getElementById('studentNotificationsList');
    notifContainer.innerHTML = '';
    notifs.forEach(n => {
      const card = document.createElement('div');
      card.className = 'notif-card';
      card.innerHTML = `
        <h4>${n.title}</h4>
        <p>${n.message}</p>
        <small style="color:#64748b;">${new Date(n.created_at).toLocaleString('az-AZ')}</small>
      `;
      notifContainer.appendChild(card);
    });
  } catch (err) {
    console.error(err);
  }
}

async function loadStudentExamSlots() {
  const res = await fetch(`${API_BASE_URL}/api/student/exam-slots`, { headers: getAuthHeaders() });
  const data = await res.json();
  const container = document.getElementById('examSlotsListContainer');
  const statusBox = document.getElementById('studentExamSelectionStatus');
  container.innerHTML = '';

  const selectedSlotIds = (data.mySelections || []).map(s => s.exam_slot_id);

  if (selectedSlotIds.length > 0) {
    statusBox.style.display = 'block';
    statusBox.innerText = '✅ Sizin imtahan vaxtınız artıq sistemdə qeydə alınıb.';
  } else {
    statusBox.style.display = 'none';
  }

  if (data.availableSlots.length === 0) {
    container.innerHTML = '<p>Hazırda aktiv imtahan slotu yoxdur.</p>';
    return;
  }

  data.availableSlots.forEach(slot => {
    const isSelected = selectedSlotIds.includes(slot.id);
    const isFull = parseInt(slot.booked_count, 10) >= slot.capacity;
    const card = document.createElement('div');
    card.className = `slot-card ${isSelected ? 'selected' : ''}`;
    card.innerHTML = `
      <div>
        <h4>${slot.subject_name} (${slot.subject_code})</h4>
        <p><strong>Tarix:</strong> ${slot.exam_date}</p>
        <p><strong>Saat:</strong> ${slot.exam_time}</p>
        <p><strong>Yer:</strong> ${slot.room}</p>
        <p><strong>Boş yer:</strong> ${slot.capacity - slot.booked_count} / ${slot.capacity}</p>
      </div>
      <button 
        class="btn-slot-select" 
        ${isSelected || isFull ? 'disabled' : ''} 
        onclick="selectExamSlot(${slot.subject_id}, ${slot.id})">
        ${isSelected ? 'Seçilib' : (isFull ? 'Yer Yoxdur' : 'Bu Vaxtı Seç')}
      </button>
    `;
    container.appendChild(card);
  });
}

async function selectExamSlot(subjectId, examSlotId) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/student/exam-selection`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ subjectId, examSlotId })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Xəta baş verdi.');
      return;
    }
    showToast(data.message || 'İmtahan vaxtınız uğurla seçildi');
    loadStudentExamSlots();
  } catch (err) {
    showToast('Xəta baş verdi.');
  }
}

// Düzəliş Tələbi Submit
document.getElementById('correctionForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const subjectId = document.getElementById('corrSubjectSelect').value;
  const category = document.getElementById('corrCategorySelect').value;
  const description = document.getElementById('corrDescription').value;

  try {
    const res = await fetch(`${API_BASE_URL}/api/student/correction-request`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ subjectId, category, description })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error);
      return;
    }
    showToast(data.message);
    document.getElementById('corrDescription').value = '';
  } catch (err) {
    showToast('Xəta baş verdi.');
  }
});

// ----------------------------------------------------
// ADMIN PANEL MƏLUMATLARININ YÜKLƏNMƏSİ
// ----------------------------------------------------
async function loadAdminPortal() {
  try {
    // 1. Fənlər select-ə yüklə
    const subRes = await fetch(`${API_BASE_URL}/api/admin/subjects`, { headers: getAuthHeaders() });
    const subjects = await subRes.json();
    const newSlotSub = document.getElementById('newSlotSubject');
    if (newSlotSub) {
      newSlotSub.innerHTML = '';
      subjects.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.innerText = s.name;
        newSlotSub.appendChild(opt);
      });
    }

    // 2. Tələbələr və Qiymətlər
    const stRes = await fetch(`${API_BASE_URL}/api/admin/students`, { headers: getAuthHeaders() });
    const students = await stRes.json();
    const tbody = document.getElementById('adminGradesTableBody');
    tbody.innerHTML = '';
    students.forEach(st => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${st.student_id}</td>
        <td><strong>${st.full_name}</strong></td>
        <td>${st.subject_name || '-'}</td>
        <td><input type="number" step="0.5" id="att_${st.user_id}_${st.subject_id}" value="${st.attendance_score || 0}" style="width:60px"></td>
        <td><input type="number" step="0.5" id="sem_${st.user_id}_${st.subject_id}" value="${st.seminar_score || 0}" style="width:60px"></td>
        <td><input type="number" step="0.5" id="lec_${st.user_id}_${st.subject_id}" value="${st.lecture_score || 0}" style="width:60px"></td>
        <td><input type="number" step="0.5" id="qb_${st.user_id}_${st.subject_id}" value="${st.qb_score || 0}" style="width:60px"></td>
        <td><input type="number" step="0.5" id="exam_${st.user_id}_${st.subject_id}" value="${st.exam_score !== null ? st.exam_score : ''}" placeholder="Bal" style="width:60px"></td>
        <td><button class="btn-primary" style="padding:4px 8px; font-size:11px;" onclick="saveGrade(${st.user_id}, ${st.subject_id})">Yadda Saxla</button></td>
      `;
      tbody.appendChild(tr);
    });

    // 3. Slotlar
    loadAdminSlots();

    // 4. Düzəliş Tələbləri
    loadAdminRequests();
  } catch (err) {
    console.error(err);
  }
}

async function saveGrade(userId, subjectId) {
  const attendanceScore = parseFloat(document.getElementById(`att_${userId}_${subjectId}`).value) || 0;
  const seminarScore = parseFloat(document.getElementById(`sem_${userId}_${subjectId}`).value) || 0;
  const lectureScore = parseFloat(document.getElementById(`lec_${userId}_${subjectId}`).value) || 0;
  const qbScore = parseFloat(document.getElementById(`qb_${userId}_${subjectId}`).value) || 0;
  const examVal = document.getElementById(`exam_${userId}_${subjectId}`).value;
  const examScore = examVal !== '' ? parseFloat(examVal) : null;

  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/grades/${userId}/${subjectId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ attendanceScore, seminarScore, lectureScore, qbScore, examScore })
    });
    if (res.ok) {
      showToast('Qiymət uğurla yeniləndi.');
    } else {
      showToast('Xəta baş verdi.');
    }
  } catch (err) {
    showToast('Xəta baş verdi.');
  }
}

async function loadAdminSlots() {
  const res = await fetch(`${API_BASE_URL}/api/admin/exam-slots`, { headers: getAuthHeaders() });
  const slots = await res.json();
  const tbody = document.getElementById('adminSlotsTableBody');
  tbody.innerHTML = '';
  slots.forEach(s => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${s.subject_name}</td>
      <td>${s.formatted_date}</td>
      <td>${s.exam_time}</td>
      <td>${s.room}</td>
      <td><input type="number" id="cap_${s.id}" value="${s.capacity}" style="width:60px"></td>
      <td>${s.booked_count}</td>
      <td>
        <button style="padding:4px 8px; font-size:11px; cursor:pointer;" onclick="toggleSlotStatus(${s.id}, ${!s.is_active})">
          ${s.is_active ? '🟢 Aktiv' : '🔴 Deaktiv'}
        </button>
      </td>
      <td>
        <button style="padding:4px 8px; font-size:11px; background:#0284c7; color:#fff; border:none; border-radius:3px; cursor:pointer;" onclick="updateSlotCapacity(${s.id})">Yenilə</button>
        <button style="padding:4px 8px; font-size:11px; background:#dc2626; color:#fff; border:none; border-radius:3px; cursor:pointer;" onclick="deleteSlot(${s.id})">Sil</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function toggleSlotStatus(id, newStatus) {
  await fetch(`${API_BASE_URL}/api/admin/exam-slots/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ isActive: newStatus })
  });
  showToast('Slot statusu yeniləndi.');
  loadAdminSlots();
}

async function updateSlotCapacity(id) {
  const capacity = parseInt(document.getElementById(`cap_${id}`).value, 10);
  await fetch(`${API_BASE_URL}/api/admin/exam-slots/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ capacity })
  });
  showToast('Kapasitet yeniləndi.');
  loadAdminSlots();
}

async function deleteSlot(id) {
  if (!confirm('Bu slotu silmək istədiyinizdən əminsiniz?')) return;
  await fetch(`${API_BASE_URL}/api/admin/exam-slots/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  showToast('Slot silindi.');
  loadAdminSlots();
}

// Yeni Slot Yarat Submit
document.getElementById('createSlotForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const subjectId = document.getElementById('newSlotSubject').value;
  const examDate = document.getElementById('newSlotDate').value;
  const examTime = document.getElementById('newSlotTime').value;
  const room = document.getElementById('newSlotRoom').value;
  const capacity = parseInt(document.getElementById('newSlotCapacity').value, 10);
  const isActive = document.getElementById('newSlotActive').value === 'true';

  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/exam-slots`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ subjectId, examDate, examTime, room, capacity, isActive })
    });
    if (res.ok) {
      showToast('Yeni imtahan slotu yaradıldı.');
      loadAdminSlots();
    }
  } catch (err) {
    showToast('Xəta baş verdi.');
  }
});

async function loadAdminRequests() {
  const res = await fetch(`${API_BASE_URL}/api/admin/correction-requests`, { headers: getAuthHeaders() });
  const reqs = await res.json();
  const tbody = document.getElementById('adminRequestsTableBody');
  tbody.innerHTML = '';
  reqs.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.student_name} (${r.student_code})</td>
      <td>${r.subject_name}</td>
      <td><strong>${r.category}</strong></td>
      <td>${r.description}</td>
      <td>${new Date(r.created_at).toLocaleDateString('az-AZ')}</td>
      <td><strong>${r.status}</strong></td>
      <td>
        ${r.status === 'PENDING' ? `
          <button style="padding:4px 8px; font-size:11px; background:#16a34a; color:#fff; border:none; border-radius:3px; cursor:pointer;" onclick="decideRequest(${r.id}, 'APPROVED')">Qəbul Et</button>
          <button style="padding:4px 8px; font-size:11px; background:#dc2626; color:#fff; border:none; border-radius:3px; cursor:pointer;" onclick="decideRequest(${r.id}, 'REJECTED')">Rədd Et</button>
        ` : 'Qərar verilib'}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function decideRequest(id, status) {
  await fetch(`${API_BASE_URL}/api/admin/correction-requests/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ status, adminNote: `${status} statusu təyin edildi.` })
  });
  showToast(`Tələb ${status === 'APPROVED' ? 'təsdiqləndi' : 'rədd edildi'}.`);
  loadAdminRequests();
}

// Bildiriş Yarat Submit
document.getElementById('createNoticeForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('noticeTitle').value;
  const message = document.getElementById('noticeMessage').value;

  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/notifications`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ title, message })
    });
    if (res.ok) {
      showToast('Bildiriş bütün tələbələr üçün göndərildi.');
      document.getElementById('noticeTitle').value = '';
      document.getElementById('noticeMessage').value = '';
    }
  } catch (err) {
    showToast('Xəta baş verdi.');
  }
});

// App Initialization
function initApp() {
  const token = localStorage.getItem('elsu_token');
  const user = JSON.parse(localStorage.getItem('elsu_user') || '{}');

  if (!token || !user.role) {
    document.getElementById('loginSection').classList.remove('hidden');
    document.getElementById('studentDashboard').classList.add('hidden');
    document.getElementById('adminDashboard').classList.add('hidden');
    generateCaptcha();
    return;
  }

  document.getElementById('loginSection').classList.add('hidden');
  if (user.role === 'STUDENT') {
    document.getElementById('studentDashboard').classList.remove('hidden');
    document.getElementById('adminDashboard').classList.add('hidden');
    loadStudentPortal();
  } else if (user.role === 'ADMIN') {
    document.getElementById('adminDashboard').classList.remove('hidden');
    document.getElementById('studentDashboard').classList.add('hidden');
    loadAdminPortal();
  }
}

initApp();
