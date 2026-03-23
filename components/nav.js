// Shared navigation component
(function() {
  const currentPath = window.location.pathname;
  const isPage = (path) => currentPath.includes(path);
  
  const navItems = [
    { href: '/japan-tcg-price-guide/', label: '🏠 Home', match: p => p.endsWith('/') || p.endsWith('/index.html') },
    { href: '/japan-tcg-price-guide/search.html', label: '🔍 Search', match: p => p.includes('search.html') },
    { href: '/japan-tcg-price-guide/advanced.html', label: '⚙️ Advanced', match: p => p.includes('advanced.html') },
    { href: '/japan-tcg-price-guide/collection.html', label: '📦 Collection', match: p => p.includes('collection.html') }
  ];
  
  // Find or create nav container
  let nav = document.querySelector('.site-nav');
  if (!nav) {
    nav = document.createElement('div');
    nav.className = 'site-nav';
    document.body.insertBefore(nav, document.body.firstChild);
  }
  
  // Build nav HTML
  nav.innerHTML = navItems.map(item => {
    const isActive = item.match(currentPath);
    return `<a href="${item.href}" class="${isActive ? 'active' : ''}">${item.label}</a>`;
  }).join('');
  
  // Add styles if not already present
  if (!document.getElementById('site-nav-styles')) {
    const style = document.createElement('style');
    style.id = 'site-nav-styles';
    style.textContent = `
      .site-nav {
        background: #fff;
        border-bottom: 1px solid #eee;
        padding: 10px 15px;
        display: flex;
        gap: 15px;
        flex-wrap: wrap;
        align-items: center;
      }
      .site-nav a {
        color: #666;
        text-decoration: none;
        font-size: 0.9em;
        padding: 5px 10px;
        border-radius: 6px;
        transition: all 0.15s;
      }
      .site-nav a:hover {
        background: #f5f5f5;
        color: #222;
      }
      .site-nav a.active {
        background: #222;
        color: #fff;
      }
    `;
    document.head.appendChild(style);
  }
})();
