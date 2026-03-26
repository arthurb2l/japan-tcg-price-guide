// Footer component - single source of truth
const footerLinks = {
  cards: [
    { text: "Search", href: "/japan-tcg-price-guide/search.html" },
    { text: "Pokemon Sets", href: "/japan-tcg-price-guide/pokemon/" },
    { text: "One Piece Sets", href: "/japan-tcg-price-guide/onepiece/" },
    { text: "Random Card", href: "/japan-tcg-price-guide/search.html?random=1" }
  ],
  site: [
    { text: "Guides", href: "/japan-tcg-price-guide/guides/" },
    { text: "Legal", href: "/japan-tcg-price-guide/legal.html" },
    { text: "Changelog", href: "/japan-tcg-price-guide/changelog.html" }
  ],
  more: [
    { text: "API Docs", href: "/japan-tcg-price-guide/api.html" },
    { text: "Donate", href: "/japan-tcg-price-guide/donate.html" },
    { text: "GitHub", href: "https://github.com/arthurb2l/japan-tcg-price-guide", external: true }
  ]
};

function renderFooter() {
  const cols = Object.entries(footerLinks).map(([title, links]) => `
    <div class="footer-col">
      <h4>${title.charAt(0).toUpperCase() + title.slice(1)}</h4>
      ${links.map(l => `<a href="${l.href}"${l.external ? ' target="_blank" rel="noopener"' : ''}>${l.text}</a>`).join('')}
    </div>
  `).join('');

  return `
    <div class="footer-grid">${cols}</div>
    <div class="footer-legal">
      <p>Card images © The Pokémon Company, Bandai. Not produced by or endorsed by these companies.</p>
      <p>Price data via TCGdex/Cardmarket. No guarantee of accuracy.</p>
      <p>© 2026 PokePiece. Code: <a href="https://github.com/arthurb2l/japan-tcg-price-guide/blob/main/LICENSE">MIT License</a></p>
    </div>
  `;
}

// Auto-inject if element exists
const el = document.getElementById('site-footer');
if (el) el.innerHTML = renderFooter();
