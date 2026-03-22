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

function renderAuthUI(container) {
  auth.onAuthStateChanged(user => {
    if (user) {
      container.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;font-size:.85em">
          <img src="${user.photoURL || ''}" alt="" style="width:28px;height:28px;border-radius:50%" referrerpolicy="no-referrer">
          <span style="max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${user.displayName || user.email}</span>
          <button onclick="signOut()" style="background:none;border:none;color:#666;cursor:pointer;font-size:.75em">Sign out</button>
        </div>`;
    } else {
      container.innerHTML = `
        <button onclick="signInWithGoogle()" style="background:#fff;border:1px solid #ddd;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:.8em;display:flex;align-items:center;gap:6px">
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="G" style="width:16px;height:16px">
          Sign in
        </button>`;
    }
  });
}

// Auto-init if auth-container exists
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('auth-container');
  if (container) renderAuthUI(container);
});
