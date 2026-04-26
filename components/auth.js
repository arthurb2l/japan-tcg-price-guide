// Firebase Auth Component
const firebaseConfig = {
  apiKey: "AIzaSyCLzia4937bSBbjsT0JUY-PAgnzygTYj1s",
  authDomain: "japan-tcg-price-guide.firebaseapp.com",
  projectId: "japan-tcg-price-guide",
  storageBucket: "japan-tcg-price-guide.firebasestorage.app",
  messagingSenderId: "1034858029314",
  appId: "1:1034858029314:web:b162b211614d6fb3f5e21b"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(err => console.error('Sign in error:', err));
}

function signOut() { auth.signOut(); }

function _userMenuHtml(name, photo, uid) {
  // Inject dropdown CSS if not already present
  if (!document.getElementById('user-menu-css')) {
    const s = document.createElement('style');
    s.id = 'user-menu-css';
    s.textContent = '.user-menu.open .user-dropdown{display:block!important}.user-dropdown a:hover,.user-dropdown button:hover{background:#f5f5f5}';
    document.head.appendChild(s);
  }
  const isAdmin = uid === 'kkECBly8lgVnrw9flUBouBMzjEh2';
  return `<div style="position:relative" class="user-menu">
    <div style="display:flex;align-items:center;gap:8px;font-size:.85em;cursor:pointer" onclick="this.parentElement.classList.toggle('open')">
      <img src="${photo}" alt="" style="width:28px;height:28px;border-radius:50%" referrerpolicy="no-referrer">
      <span style="max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${name}</span>
      <svg width="12" height="12" viewBox="0 0 12 12" style="opacity:.5"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>
    </div>
    <div style="display:none;position:absolute;right:0;top:100%;margin-top:6px;background:#fff;border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.12);min-width:180px;z-index:100;overflow:hidden" class="user-dropdown">
      <a href="/japan-tcg-price-guide/collection.html" style="display:block;padding:10px 16px;text-decoration:none;color:#333;font-size:.85em">📦 My Collection</a>
      <a href="/japan-tcg-price-guide/settings.html" style="display:block;padding:10px 16px;text-decoration:none;color:#333;font-size:.85em">⚙️ Settings</a>
      ${isAdmin ? '<a href="/japan-tcg-price-guide/admin/quality.html" style="display:block;padding:10px 16px;text-decoration:none;color:#333;font-size:.85em">🔒 Admin</a>' : ''}
      <button onclick="signOut()" style="display:block;width:100%;padding:10px 16px;border:none;background:none;text-align:left;cursor:pointer;color:#666;font-size:.85em;border-top:1px solid #f0f0f0">Sign out</button>
    </div>
  </div>`;
}

function renderAuthUI(container) {
  const cached = JSON.parse(localStorage.getItem('tcg_auth_cache') || 'null');
  if (cached) {
    container.innerHTML = _userMenuHtml(cached.name || '', cached.photo || '', cached.uid || '');
    container.style.opacity = '1';
  }
  auth.onAuthStateChanged(user => {
    if (user) {
      localStorage.setItem('tcg_auth_cache', JSON.stringify({ name: user.displayName || user.email, photo: user.photoURL || '', uid: user.uid }));
      container.innerHTML = _userMenuHtml(user.displayName || user.email, user.photoURL || '', user.uid);
    } else {
      localStorage.removeItem('tcg_auth_cache');
      container.innerHTML = `
        <button onclick="signInWithGoogle()" style="background:#fff;border:1px solid #ddd;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:.8em;display:flex;align-items:center;gap:6px">
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="G" style="width:16px;height:16px">
          Sign in
        </button>`;
    }
    container.style.opacity = '1';
  });
}

// Auto-init if auth-container exists
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('auth-container');
  if (container) renderAuthUI(container);
});

// Close user dropdown on outside click
document.addEventListener('click', e => {
  document.querySelectorAll('.user-menu.open').forEach(m => {
    if (!m.contains(e.target)) m.classList.remove('open');
  });
});
