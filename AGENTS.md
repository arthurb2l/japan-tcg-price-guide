# Visual identity

Before writing or editing any UI, read `DESIGN.md` for the visual identity — colors, typography, spacing, radius, and component conventions. Use its tokens and the shared CSS classes (`.hero`, `.stat`, `.tag-*`, `.set-h2`, `.price`, `.card-title`); don't invent styles or hardcode new hex values.

This is a plain-HTML, no-build site: edit the shared stylesheets (`base.css`, `components/header.css`) so changes propagate across all pages — don't fork styles per page.
