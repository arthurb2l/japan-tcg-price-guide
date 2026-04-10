// Shared Header Component
(function() {
  const path = window.location.pathname;
  const isPokemon = path.includes('/pokemon/');
  const isOnePiece = path.includes('/onepiece/');
  const isCollection = path.includes('collection');
  const base = '/japan-tcg-price-guide/';
  
  const savedGame = localStorage.getItem('tcg_game') || 'pokemon';
  
  const headerHTML = `
    <header class="site-header">
      <div class="site-header-inner">
        <button class="burger-btn" onclick="toggleMobileNav()" aria-label="Menu">☰</button>
        <a href="${base}" class="site-logo">🎴 <span class="logo-text">PokePiece</span></a>
        
        <nav class="nav-links">
          <div class="nav-dropdown">
            <a href="${base}pokemon/" class="nav-link ${isPokemon ? 'active' : ''}">Pokemon</a>
            <div class="nav-dropdown-content">
              <a href="${base}search.html?game=pokemon">🔍 Search</a>
              <a href="${base}pokemon/sets/">Sets</a>
            </div>
          </div>
          <div class="nav-dropdown">
            <a href="${base}onepiece/" class="nav-link ${isOnePiece ? 'active' : ''}">One Piece</a>
            <div class="nav-dropdown-content">
              <a href="${base}search.html?game=onepiece">🔍 Search</a>
              <a href="${base}onepiece/sets/">Sets</a>
              <a href="${base}deck-builder.html">🃏 Deck Builder</a>
            </div>
          </div>
          <a href="${base}collection.html" class="nav-link ${isCollection ? 'active' : ''}">📦 Collection</a>
        </nav>
        
        <form class="header-search" onsubmit="headerSearch(event)">
          <div class="game-picker" id="gamePicker">
            <button type="button" class="game-toggle" onclick="document.getElementById('gameDropdown').classList.toggle('show')" aria-label="Switch game">
              <img id="headerGameIcon" src="${savedGame === 'onepiece' ? base + 'onepiece/favicon.svg' : base + 'favicon.svg'}" alt="" width="18" height="18">
              <span class="game-arrow">▾</span>
            </button>
            <div class="game-dropdown" id="gameDropdown">
              <button type="button" onclick="selectHeaderGame('pokemon')" class="${savedGame === 'pokemon' ? 'active' : ''}"><img src="${base}favicon.svg" width="16" height="16" alt=""> Pokemon</button>
              <button type="button" onclick="selectHeaderGame('onepiece')" class="${savedGame === 'onepiece' ? 'active' : ''}"><img src="${base}onepiece/favicon.svg" width="16" height="16" alt=""> One Piece</button>
            </div>
          </div>
          <input type="text" id="headerSearchInput" placeholder="Search...">
          <button type="submit" aria-label="Search">🔍</button>
        </form>
        
        <div class="header-user" id="headerUser">
          <button class="login-btn" onclick="headerLogin()">Sign In</button>
        </div>
      </div>
    </header>
    
    <nav class="mobile-nav" id="mobileNav">
      <div class="mobile-nav-header">
        <span>Menu</span>
        <button onclick="toggleMobileNav()" aria-label="Close">✕</button>
      </div>
      <a href="${base}">🏠 Home</a>
      <div class="mobile-nav-section">Pokemon</div>
      <a href="${base}search.html?game=pokemon" class="sub">🔍 Search Cards</a>
      <a href="${base}pokemon/sets/" class="sub">📚 Browse Sets</a>
      <div class="mobile-nav-section">One Piece</div>
      <a href="${base}search.html?game=onepiece" class="sub">🔍 Search Cards</a>
      <a href="${base}onepiece/sets/" class="sub">📚 Browse Sets</a>
      <a href="${base}deck-builder.html" class="sub">🃏 Deck Builder</a>
      <div class="mobile-nav-divider"></div>
      <a href="${base}collection.html">📦 My Collection</a>
      <a href="${base}favorites.html">⭐ Favorites</a>
      <a href="${base}settings.html">⚙️ Settings</a>
      <div class="mobile-nav-login" id="mobileNavLogin">
        <button onclick="headerLogin()">Sign In</button>
      </div>
    </nav>
    <div class="mobile-nav-overlay" id="mobileNavOverlay" onclick="toggleMobileNav()"></div>
  `;
  
  document.body.insertAdjacentHTML('afterbegin', headerHTML);
  
  // Load CSS
  if (!document.getElementById('header-css')) {
    const link = document.createElement('link');
    link.id = 'header-css';
    link.rel = 'stylesheet';
    link.href = '/japan-tcg-price-guide/components/header.css';
    document.head.appendChild(link);
  }
  // Favicon
  if (!document.querySelector('link[rel="icon"]')) {
    const ico = document.createElement('link');
    ico.rel = 'icon';
    ico.href = '/japan-tcg-price-guide/favicon.svg';
    document.head.appendChild(ico);
  }
  
  window.toggleMobileNav = function() {
    document.getElementById('mobileNav').classList.toggle('open');
    document.getElementById('mobileNavOverlay').classList.toggle('open');
    document.body.classList.toggle('nav-open');
  };
  
  let _headerGame = savedGame;
  window.selectHeaderGame = function(game) {
    _headerGame = game;
    localStorage.setItem('tcg_game', game);
    document.getElementById('headerGameIcon').src = game === 'onepiece' ? base + 'onepiece/favicon.svg' : base + 'favicon.svg';
    document.getElementById('gameDropdown').classList.remove('show');
    document.querySelectorAll('.game-dropdown button').forEach(b => b.classList.remove('active'));
    document.querySelector(`.game-dropdown button[onclick*="${game}"]`)?.classList.add('active');
  };
  // Close game dropdown on outside click
  document.addEventListener('click', e => { if (!e.target.closest('.game-picker')) document.getElementById('gameDropdown')?.classList.remove('show'); });
  
  window.headerSearch = function(e) {
    e.preventDefault();
    const q = document.getElementById('headerSearchInput').value.trim();
    if (q) window.location.href = `${base}search.html?q=${encodeURIComponent(q)}&game=${_headerGame}`;
  };
  
  window.headerLogin = function() {
    if (typeof signInWithGoogle === 'function') signInWithGoogle();
    else if (typeof googleLogin === 'function') googleLogin();
    else window.location.href = `${base}collection.html`;
  };
  
  window.updateHeaderUser = function(user) {
    const container = document.getElementById('headerUser');
    const mobileLogin = document.getElementById('mobileNavLogin');
    if (user) {
      const isAdmin = ADMIN_UIDS.includes(user.uid || '');
      const adminLink = isAdmin ? `<a href="${base}admin/reports.html" id="admin-reports-link">⚠️ Reports</a>` : '';
      container.innerHTML = `
        <div class="user-dropdown">
          <img src="${user.picture || ''}" alt="" class="user-avatar" referrerpolicy="no-referrer"${isAdmin ? ' style="outline:2px solid #d32f2f;outline-offset:1px"' : ''}>
          <div class="user-dropdown-content">
            <a href="${base}collection.html">My Collection</a>
            <a href="${base}settings.html">Settings</a>
            ${adminLink}
            <button onclick="headerLogout()">Sign Out</button>
          </div>
        </div>
      `;
      if (isAdmin && typeof db !== 'undefined') {
        db.collection('card-reports').where('status','==','open').get().then(snap => {
          const el = document.getElementById('admin-reports-link');
          if (el && snap.size > 0) el.innerHTML = '⚠️ Reports <span style="background:#d32f2f;color:#fff;padding:1px 6px;border-radius:8px;font-size:.75em;margin-left:4px">' + snap.size + '</span>';
        }).catch(() => {});
      }
      if (mobileLogin) {
        const mobileAdmin = isAdmin ? `<a href="${base}admin/reports.html" style="display:block;padding:10px 0;color:#d32f2f;text-decoration:none">⚠️ Reports</a>` : '';
        mobileLogin.innerHTML = `
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
            <img src="${user.picture || ''}" style="width:32px;height:32px;border-radius:50%" referrerpolicy="no-referrer">
            <span style="font-size:.9em">${user.name || 'User'}</span>
          </div>
          ${mobileAdmin}
          <a href="${base}settings.html" style="display:block;padding:10px 0;color:#222;text-decoration:none">⚙️ Settings</a>
          <button onclick="headerLogout()" style="width:100%;padding:12px;background:#222;color:#fff;border:none;border-radius:8px;font-size:1em;cursor:pointer;margin-top:8px">Sign Out</button>`;
      }
    } else {
      container.innerHTML = `<button class="login-btn" onclick="headerLogin()">Sign In</button>`;
      if (mobileLogin) mobileLogin.innerHTML = `<button onclick="headerLogin()">Sign In</button>`;
    }
  };
  
  window.headerLogout = function() {
    if (typeof auth !== 'undefined' && auth.signOut) auth.signOut();
    else if (typeof googleLogout === 'function') googleLogout();
    updateHeaderUser(null);
  };
  
  // Check auth state + admin badge
  const ADMIN_UIDS = ['kkECBly8lgVnrw9flUBouBMzjEh2'];
  setTimeout(() => {
    if (typeof currentUser !== 'undefined' && currentUser) {
      updateHeaderUser(currentUser);
    } else if (typeof auth !== 'undefined' && auth.onAuthStateChanged) {
      auth.onAuthStateChanged(user => {
        if (user) updateHeaderUser({ picture: user.photoURL, name: user.displayName, uid: user.uid });
      });
    }
  }, 100);
  
  // Close mobile nav on link click
  document.getElementById('mobileNav').addEventListener('click', e => {
    if (e.target.tagName === 'A') {
      document.getElementById('mobileNav').classList.remove('open');
      document.getElementById('mobileNavOverlay').classList.remove('open');
      document.body.classList.remove('nav-open');
    }
  });
})();
