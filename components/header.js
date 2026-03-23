// Shared Header Component
(function() {
  const path = window.location.pathname;
  const isPokemon = path.includes('/pokemon/');
  const isOnePiece = path.includes('/onepiece/');
  const isCollection = path.includes('collection');
  const isDonate = path.includes('donate');
  const base = '/japan-tcg-price-guide/';
  
  const savedGame = localStorage.getItem('tcg_game');
  let searchGame = savedGame || (isPokemon ? 'pokemon' : (isOnePiece ? 'onepiece' : 'pokemon'));
  
  const headerHTML = `
    <header class="site-header">
      <div class="site-header-inner">
        <button class="burger-btn" onclick="toggleMobileNav()" aria-label="Menu">☰</button>
        <a href="${base}" class="site-logo">🎴 TCG</a>
        
        <nav class="nav-links">
          <div class="nav-dropdown">
            <a href="${base}pokemon/" class="nav-link ${isPokemon ? 'active' : ''}">Pokémon</a>
            <div class="nav-dropdown-content">
              <a href="${base}search.html?game=pokemon">🔍 Search</a>
              <a href="${base}pokemon/sets/">Sets</a>
              <a href="${base}pokemon/cheat-sheet.html">Cheat Sheet</a>
            </div>
          </div>
          <div class="nav-dropdown">
            <a href="${base}onepiece/" class="nav-link ${isOnePiece ? 'active' : ''}">One Piece</a>
            <div class="nav-dropdown-content">
              <a href="${base}search.html?game=onepiece">🔍 Search</a>
              <a href="${base}onepiece/sets/">Sets</a>
              <a href="${base}deck-builder.html">🃏 Deck Builder</a>
              <a href="${base}onepiece/cheat-sheet.html">Cheat Sheet</a>
            </div>
          </div>
          <a href="${base}collection.html" class="nav-link ${isCollection ? 'active' : ''}">📦 Collection</a>
        </nav>
        
        <form class="header-search" onsubmit="headerSearch(event)">
          <select id="headerGameSelect" onchange="saveGamePref(this.value)">
            <option value="pokemon" ${searchGame === 'pokemon' ? 'selected' : ''}>Pokémon</option>
            <option value="onepiece" ${searchGame === 'onepiece' ? 'selected' : ''}>One Piece</option>
          </select>
          <input type="text" id="headerSearchInput" placeholder="Search...">
          <button type="submit">🔍</button>
        </form>
        
        <div class="header-user" id="headerUser">
          <button class="login-btn" onclick="headerLogin()">Sign In</button>
        </div>
      </div>
    </header>
    
    <nav class="mobile-nav" id="mobileNav">
      <a href="${base}pokemon/">🟡 Pokémon</a>
      <a href="${base}search.html?game=pokemon" class="sub">Search Cards</a>
      <a href="${base}pokemon/sets/" class="sub">Browse Sets</a>
      <a href="${base}onepiece/">🔴 One Piece</a>
      <a href="${base}search.html?game=onepiece" class="sub">Search Cards</a>
      <a href="${base}onepiece/sets/" class="sub">Browse Sets</a>
      <a href="${base}deck-builder.html" class="sub">Deck Builder</a>
      <a href="${base}collection.html">📦 My Collection</a>
      <a href="${base}donate.html">❤️ Support</a>
    </nav>
  `;
  
  document.body.insertAdjacentHTML('afterbegin', headerHTML);
  
  // Load CSS
  if (!document.getElementById('header-css')) {
    const link = document.createElement('link');
    link.id = 'header-css';
    link.rel = 'stylesheet';
    link.href = (path.includes('/pokemon/') || path.includes('/onepiece/')) 
      ? '../components/header.css' 
      : '/japan-tcg-price-guide/components/header.css';
    document.head.appendChild(link);
  }
  
  window.toggleMobileNav = function() {
    document.getElementById('mobileNav').classList.toggle('open');
  };
  
  window.saveGamePref = function(game) {
    localStorage.setItem('tcg_game', game);
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
    if (user) {
      container.innerHTML = `
        <div class="user-dropdown">
          <img src="${user.picture || ''}" alt="" class="user-avatar" referrerpolicy="no-referrer">
          <div class="user-dropdown-content">
            <a href="${base}collection.html">My Collection</a>
            <button onclick="headerLogout()">Sign Out</button>
          </div>
        </div>
      `;
    } else {
      container.innerHTML = `<button class="login-btn" onclick="headerLogin()">Sign In</button>`;
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
    if (e.target.tagName === 'A') document.getElementById('mobileNav').classList.remove('open');
  });
})();
