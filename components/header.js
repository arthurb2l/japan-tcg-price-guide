// Shared Header Component
(function() {
  // Detect current page context
  const path = window.location.pathname;
  const isHome = path.endsWith('/') || path.endsWith('/index.html') || path.endsWith('/japan-tcg-price-guide/');
  const isPokemon = path.includes('/pokemon/');
  const isOnePiece = path.includes('/onepiece/');
  const isCollection = path.includes('collection');
  const isSearch = path.includes('search.html');
  const isDonate = path.includes('donate');
  
  // Determine base path for links
  const depth = (path.match(/\/pokemon\/|\/onepiece\//)) ? '../' : '';
  const base = '/japan-tcg-price-guide/';
  
  // Default game for search
  let searchGame = isPokemon ? 'pokemon' : (isOnePiece ? 'onepiece' : 'pokemon');
  
  // Create header HTML
  const headerHTML = `
    <header class="site-header">
      <div class="site-header-inner">
        <a href="${base}" class="site-logo">🎴 JP TCG</a>
        
        <button class="burger-btn" onclick="toggleMobileNav()">☰</button>
        
        <nav class="nav-links" id="navLinks">
          <div class="nav-dropdown">
            <a href="${base}pokemon/" class="nav-link ${isPokemon ? 'active' : ''}">Pokémon ▾</a>
            <div class="nav-dropdown-content">
              <a href="${base}pokemon/">Browse Sets</a>
              <a href="${base}pokemon/cheat-sheet.html">Cheat Sheet</a>
              <a href="${base}pokemon/price-guide.html">Price Guide</a>
            </div>
          </div>
          
          <div class="nav-dropdown">
            <a href="${base}onepiece/" class="nav-link ${isOnePiece ? 'active' : ''}">One Piece ▾</a>
            <div class="nav-dropdown-content">
              <a href="${base}onepiece/">Browse Sets</a>
              <a href="${base}onepiece/cheat-sheet.html">Cheat Sheet</a>
              <a href="${base}onepiece/price-guide.html">Price Guide</a>
            </div>
          </div>
          
          <a href="${base}collection.html" class="nav-link ${isCollection ? 'active' : ''}">📦 Collection</a>
          <a href="${base}donate.html" class="nav-link ${isDonate ? 'active' : ''}">❤️ Donate</a>
        </nav>
        
        <form class="header-search" onsubmit="headerSearch(event)">
          <select id="headerGameSelect" onchange="searchGame=this.value">
            <option value="pokemon" ${searchGame === 'pokemon' ? 'selected' : ''}>Pokémon</option>
            <option value="onepiece" ${searchGame === 'onepiece' ? 'selected' : ''}>One Piece</option>
          </select>
          <input type="text" id="headerSearchInput" placeholder="Search cards...">
          <button type="submit">🔍</button>
        </form>
        
        <div class="header-user" id="headerUser">
          <button class="login-btn" onclick="headerLogin()">Sign In</button>
        </div>
      </div>
    </header>
  `;
  
  // Inject header at start of body
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
  
  // Mobile nav toggle
  window.toggleMobileNav = function() {
    document.getElementById('navLinks').classList.toggle('open');
  };
  
  // Search handler
  window.headerSearch = function(e) {
    e.preventDefault();
    const q = document.getElementById('headerSearchInput').value.trim();
    const game = document.getElementById('headerGameSelect').value;
    if (q) {
      window.location.href = `${base}search.html?q=${encodeURIComponent(q)}&game=${game}`;
    }
  };
  
  // Login handler
  window.headerLogin = function() {
    // Check if google auth is available on page
    if (typeof signInWithGoogle === 'function') {
      signInWithGoogle();
    } else if (typeof googleLogin === 'function') {
      googleLogin();
    } else {
      // Redirect to collection which has auth
      window.location.href = `${base}collection.html`;
    }
  };
  
  // Update user state
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
  
  // Logout handler
  window.headerLogout = function() {
    if (typeof auth !== 'undefined' && auth.signOut) {
      auth.signOut();
    } else if (typeof googleLogout === 'function') {
      googleLogout();
    }
    updateHeaderUser(null);
  };
  
  // Check for existing user session - integrate with Firebase auth
  setTimeout(() => {
    if (typeof currentUser !== 'undefined' && currentUser) {
      updateHeaderUser(currentUser);
    } else if (typeof auth !== 'undefined' && auth.onAuthStateChanged) {
      auth.onAuthStateChanged(user => {
        if (user) {
          updateHeaderUser({ picture: user.photoURL, name: user.displayName });
        }
      });
    }
  }, 100);
})();
