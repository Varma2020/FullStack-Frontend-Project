/* Digital Certificate Generator - Pure frontend demo
   - stores users & certificates in localStorage
   - roles: owner / student
   - owner can mark completion and generate certificate (creates an image)
   - student can download certificate if generated
*/

(() => {
  // ---------- Data helpers ----------
  const STORAGE_KEY = 'dcg_data_v1';

  // default demo data
  const defaultState = {
    users: [
      { id: 'u1', name: 'App Owner', username: 'owner', password: 'owner123', role: 'owner' },
      { id: 'u2', name: 'Alice Student', username: 'alice', password: 'alice123', role: 'student', completed: false, certDataUrl: null },
      { id: 'u3', name: 'Bob Student', username: 'bob', password: 'bob123', role: 'student', completed: true, certDataUrl: null }
    ]
  };

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultState));
        return JSON.parse(JSON.stringify(defaultState));
      }
      return JSON.parse(raw);
    } catch (e) {
      console.error('loadState error', e);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultState));
      return JSON.parse(JSON.stringify(defaultState));
    }
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  // ---------- UI nodes ----------
  const loginSection = document.getElementById('loginSection');
  const registerSection = document.getElementById('registerSection');
  const ownerSection = document.getElementById('ownerSection');
  const studentSection = document.getElementById('studentSection');

  const loginForm = document.getElementById('loginForm');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const showRegisterBtn = document.getElementById('showRegister');

  const registerForm = document.getElementById('registerForm');
  const regFullname = document.getElementById('regFullname');
  const regUsername = document.getElementById('regUsername');
  const regPassword = document.getElementById('regPassword');
  const cancelRegister = document.getElementById('cancelRegister');

  const studentsTableBody = document.querySelector('#studentsTable tbody');
  const ownerLogout = document.getElementById('ownerLogout');
  const refreshStudents = document.getElementById('refreshStudents');

  const studentLogout = document.getElementById('studentLogout');
  const studentNameEl = document.getElementById('studentName');
  const studentUsernameEl = document.getElementById('studentUsername');
  const studentStatus = document.getElementById('studentStatus');
  const certContainer = document.getElementById('certContainer');
  const certCanvas = document.getElementById('certCanvas');
  const downloadCert = document.getElementById('downloadCert');
  const viewFull = document.getElementById('viewFull');

  // ---------- App state ----------
  let state = loadState();
  let currentUser = null;

  // ---------- Auth / navigation ----------
  function showSection(section) {
    [loginSection, registerSection, ownerSection, studentSection].forEach(s => s.classList.add('hidden'));
    section.classList.remove('hidden');
  }

  function login(username, password) {
    const user = state.users.find(u => u.username === username && u.password === password);
    if (!user) return null;
    currentUser = user;
    // store session in memory only (not persistent)
    updateHeader();
    if (user.role === 'owner') {
      renderOwner();
      showSection(ownerSection);
    } else {
      renderStudent();
      showSection(studentSection);
    }
    return user;
  }

  function logout() {
    currentUser = null;
    updateHeader();
    showSection(loginSection);
  }

  function updateHeader() {
    const cur = document.getElementById('currentUser');
    if (currentUser) {
      cur.classList.remove('hidden');
      cur.textContent = `${currentUser.name} (${currentUser.role})`;
    } else {
      cur.classList.add('hidden');
      cur.textContent = '';
    }
  }

  // ---------- Registration (student) ----------
  showRegisterBtn.addEventListener('click', () => {
    showSection(registerSection);
  });

  cancelRegister.addEventListener('click', () => {
    showSection(loginSection);
  });

  registerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = regFullname.value.trim();
    const username = regUsername.value.trim();
    const password = regPassword.value;
    if (!name || !username || !password) return alert('Please fill all fields.');

    // ensure unique username
    if (state.users.some(u => u.username === username)) {
      return alert('Username already exists. Choose another.');
    }

    const id = 'u' + Date.now();
    const newUser = { id, name, username, password, role: 'student', completed: false, certDataUrl: null };
    state.users.push(newUser);
    saveState(state);
    alert('Registered! You can login now.');
    regFullname.value = regUsername.value = regPassword.value = '';
    showSection(loginSection);
  });

  // ---------- Login form ----------
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const u = usernameInput.value.trim();
    const p = passwordInput.value;
    const user = login(u, p);
    if (!user) {
      alert('Invalid credentials.');
    } else {
      usernameInput.value = passwordInput.value = '';
    }
  });

  // ---------- Owner functions ----------
  function renderOwner() {
    // fill table
    studentsTableBody.innerHTML = '';
    const students = state.users.filter(u => u.role === 'student');
    students.forEach((s, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${escapeHtml(s.name)}</td>
        <td>${escapeHtml(s.username)}</td>
        <td>${s.completed ? 'Yes' : 'No'}</td>
        <td>
          <button data-action="toggleComplete" data-id="${s.id}" class="btn subtle small">${s.completed ? 'Mark Incomplete' : 'Mark Complete'}</button>
          <button data-action="genCert" data-id="${s.id}" class="btn small">Generate Cert</button>
          <button data-action="viewCert" data-id="${s.id}" class="btn subtle small">View</button>
        </td>
      `;
      studentsTableBody.appendChild(tr);
    });
  }

  function toggleComplete(studentId) {
    const s = state.users.find(u => u.id === studentId);
    if (!s) return;
    s.completed = !s.completed;
    // if marking incomplete, remove cert
    if (!s.completed) s.certDataUrl = null;
    saveState(state);
    renderOwner();
    alert(`Student ${s.name} marked ${s.completed ? 'completed' : 'incomplete'}.`);
  }

  function generateCertificateFor(studentId, showAlert = true) {
    const s = state.users.find(u => u.id === studentId);
    if (!s) return;
    if (!s.completed) {
      if (showAlert) alert('Cannot generate: student has not completed the course.');
      return;
    }
    // create certificate on a canvas
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 700;
    drawCertificate(canvas, s.name);
    const dataUrl = canvas.toDataURL('image/png');
    s.certDataUrl = dataUrl;
    saveState(state);
    if (showAlert) alert('Certificate generated and saved for student: ' + s.name);
    return dataUrl;
  }

  function viewCert(studentId) {
    const s = state.users.find(u => u.id === studentId);
    if (!s) return alert('Student not found.');
    if (!s.certDataUrl) return alert('Certificate not generated yet for this student.');
    // open in new tab
    const w = window.open();
    w.document.write(`<title>Certificate - ${escapeHtml(s.name)}</title>`);
    w.document.write(`<img src="${s.certDataUrl}" style="max-width:100%"/>`);
    w.document.close();
  }

  // event delegation for owner table actions
  studentsTableBody.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    if (action === 'toggleComplete') toggleComplete(id);
    if (action === 'genCert') generateCertificateFor(id);
    if (action === 'viewCert') viewCert(id);
  });

  ownerLogout.addEventListener('click', () => {
    logout();
  });

  refreshStudents.addEventListener('click', () => {
    state = loadState();
    renderOwner();
    alert('Student list refreshed.');
  });

  // ---------- Student functions ----------
  function renderStudent() {
    if (!currentUser) return;
    studentNameEl.textContent = currentUser.name;
    studentUsernameEl.textContent = currentUser.username;
    studentStatus.textContent = currentUser.completed ? 'Status: Completed the course.' : 'Status: Not completed yet.';
    if (currentUser.certDataUrl) {
      showCertificateForCurrentUser(currentUser.certDataUrl);
    } else {
      hideCertificateArea();
    }
  }

  function showCertificateForCurrentUser(dataUrl) {
    certContainer.classList.remove('hidden');
    const ctx = certCanvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      // scale to canvas
      ctx.clearRect(0,0,certCanvas.width, certCanvas.height);
      ctx.drawImage(img, 0, 0, certCanvas.width, certCanvas.height);
      // set download link
      downloadCert.href = certCanvas.toDataURL('image/png');
      downloadCert.download = `${currentUser.username}_certificate.png`;
    };
    img.src = dataUrl;
    viewFull.onclick = () => {
      const w = window.open();
      w.document.write(`<title>Certificate - ${escapeHtml(currentUser.name)}</title>`);
      w.document.write(`<img src="${dataUrl}" style="max-width:100%"/>`);
      w.document.close();
    };
  }

  function hideCertificateArea() {
    certContainer.classList.add('hidden');
  }

  studentLogout.addEventListener('click', () => {
    logout();
  });

  // ---------- Certificate drawing ----------
  function drawCertificate(canvas, fullName) {
    const ctx = canvas.getContext('2d');

    // background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0,0,canvas.width,canvas.height);

    // border
    ctx.strokeStyle = '#d1e7ff';
    ctx.lineWidth = 18;
    roundRect(ctx, 24, 24, canvas.width - 48, canvas.height - 48, 18);
    ctx.stroke();

    // header band
    ctx.fillStyle = '#0f1724';
    ctx.fillRect(40, 60, canvas.width - 80, 120);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Certificate of Completion', canvas.width / 2, 120);

    // decorative small text
    ctx.fillStyle = '#334155';
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('This certificate is proudly presented to', canvas.width / 2, 220);

    // name
    ctx.fillStyle = '#0b1220';
    ctx.font = 'bold 44px serif';
    ctx.fillText(fullName, canvas.width / 2, 300);

    // course name
    ctx.font = '20px sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText('for successfully completing the course', canvas.width / 2, 350);

    ctx.font = 'bold 26px sans-serif';
    ctx.fillStyle = '#0b1220';
    ctx.fillText('Full Stack Web Development', canvas.width / 2, 390);

    // date and signature area
    const date = new Date();
    const dateStr = date.toLocaleDateString();
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#334155';
    ctx.textAlign = 'left';
    ctx.fillText('Date: ' + dateStr, 80, canvas.height - 120);

    // signature
    ctx.textAlign = 'right';
    ctx.fillText('Authorized Signature', canvas.width - 80, canvas.height - 120);
    // signature line
    ctx.beginPath();
    ctx.moveTo(canvas.width - 320, canvas.height - 110);
    ctx.lineTo(canvas.width - 80, canvas.height - 110);
    ctx.strokeStyle = '#0b1220';
    ctx.lineWidth = 2;
    ctx.stroke();

    // small footer
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#6b7280';
    ctx.fillText('Certificate ID: ' + generateCertId(fullName), canvas.width / 2, canvas.height - 40);
  }

  function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
  }

  function generateCertId(name) {
    const hash = btoa(name + Date.now()).slice(0, 10).replace(/=/g, '');
    return 'DCG-' + hash;
  }

  // ---------- Utility ----------
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  // ---------- On page load: attach handlers & initialize ----------
  document.addEventListener('DOMContentLoaded', () => {
    // attempt to keep user logged in within this session variable only (not persisted)
    updateHeader();
    showSection(loginSection);

    // if Bob is already completed but no cert, auto-generate for demo
    // (keeps sample consistent when first run)
    const bob = state.users.find(u => u.username === 'bob');
    if (bob && bob.completed && !bob.certDataUrl) {
      generateCertificateFor(bob.id, false);
      saveState(state);
    }
  });

  // small UI improvement: keyboard Enter on login works naturally

  // Expose a couple functions (for owner actions via console, helpful for testing)
  window._dcg = {
    state,
    save: () => { state = loadState(); },
    genFor: (username) => {
      const u = state.users.find(x => x.username === username);
      if (!u) return console.warn('not found');
      generateCertificateFor(u.id, true);
    }
  };

  // When a student logs in, ensure we read the latest state
  // so that owner-generated certificates are visible immediately.
  // We'll update currentUser reference to link to state entry.
  (function patchLoginToRefreshUser() {
    const origLogin = login;
    login = function(username, password) {
      state = loadState();
      const user = state.users.find(u => u.username === username && u.password === password);
      if (!user) return null;
      currentUser = user;
      updateHeader();
      if (user.role === 'owner') {
        renderOwner();
        showSection(ownerSection);
      } else {
        renderStudent();
        showSection(studentSection);
      }
      return user;
    };
    // rebind to new function
    window.login = login;
  })();

  // make sure student view reflects latest state when reopened
  // by handling visibility events (simple)
  document.addEventListener('visibilitychange', () => {
    if (!currentUser) return;
    // refresh state and re-render
    state = loadState();
    currentUser = state.users.find(u => u.username === currentUser.username) || currentUser;
    if (currentUser.role === 'student') {
      renderStudent();
      if (currentUser.certDataUrl) {
        showCertificateForCurrentUser(currentUser.certDataUrl);
      } else {
        hideCertificateArea();
      }
    } else {
      renderOwner();
    }
  });

})();
