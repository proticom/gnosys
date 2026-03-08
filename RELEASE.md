# Release: v0.2.0

**Tag:** `v0.2.0`

**Title:** v0.2.0 — Multi-client support & npm polish

**Release Notes:**

## What's New

### Multi-Client MCP Setup
- Added setup instructions for **Codex** (TOML config) and **OpenCode** (JSON config) alongside existing Claude Desktop, Cursor, and Claude Code
- Landing page now features a **tabbed config selector** with all 5 MCP clients, each with Add to Existing and Copy Full Config buttons with code highlighting

### npm Package Improvements
- Added `homepage` field linking to [gnosys.ai](https://gnosys.ai)
- Updated all MCP setup examples to use `npx gnosys-mcp` (no local path needed)
- Added npm version, CI status, docs, and license badges to README
- Removed compiled test files from npm tarball (`!dist/test`)

### SEO & Site
- Added `robots.txt` and `sitemap.xml`
- Added Open Graph image for social sharing previews
- Added canonical URL, Twitter card, and `og:site_name` meta tags
- Added favicon (inline SVG hexagon mark)

### CI/CD
- GitHub Actions workflow for running tests on push (Node 18, 20, 22)
- GitHub Actions workflow for auto-publishing to npm on release with provenance
