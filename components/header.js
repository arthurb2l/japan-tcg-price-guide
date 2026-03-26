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
          <select id="headerGameSelect" class="game-select">
            <option value="pokemon" ${savedGame === 'pokemon' ? 'selected' : ''}>Pokemon</option>
            <option value="onepiece" ${savedGame === 'onepiece' ? 'selected' : ''}>One Piece</option>
          </select>
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
  
  window.headerSearch = function(e) {
    e.preventDefault();
    const q = document.getElementById('headerSearchInput').value.trim();
    const game = document.getElementById('headerGameSelect').value;
    localStorage.setItem('tcg_game', game);
    if (q) window.location.href = `${base}search.html?q=${encodeURIComponent(q)}&game=${game}`;
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
      container.innerHTML = `
        <div class="user-dropdown">
          <img src="${user.picture || ''}" alt="" class="user-avatar" referrerpolicy="no-referrer">
          <div class="user-dropdown-content">
            <a href="${base}collection.html">My Collection</a>
            <a href="${base}settings.html">Settings</a>
            <button onclick="headerLogout()">Sign Out</button>
          </div>
        </div>
      `;
      if (mobileLogin) mobileLogin.innerHTML = `<button onclick="headerLogout()">Sign Out</button>`;
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
  
  // Check auth state
  setTimeout(() => {
    if (typeof currentUser !== 'undefined' && currentUser) {
      updateHeaderUser(currentUser);
    } else if (typeof auth !== 'undefined' && auth.onAuthStateChanged) {
      auth.onAuthStateChanged(user => {
        if (user) updateHeaderUser({ picture: user.photoURL, name: user.displayName });
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
