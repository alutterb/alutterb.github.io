# Splitting the notes feed into a Blog Posts tab

- The feed JS (`js/research-blog.js`, `js/research-composer.js`) finds its markup by element id and fetches `research-posts.json` relatively, so moving the whole section to `blog.html` unchanged needs no JS edits. Keep the ids (`research-latest`, `research-history`, `research-posts`, `feed-*`).
- `styles.css` was already over the 500-line rule, so the tab bar and the phone-width fix live in `tabs.css`.
- `#wrapper` had a fixed `width: 760px`, which scrolled horizontally on phones; `tabs.css` makes it `max-width: 760px`.
- When verifying CSS changes in a browser, bypass the cache; a stale stylesheet looked like a failing fix.
- Locally (no Jekyll) the `---` front matter renders as text and triggers a quirks-mode console issue; GitHub Pages strips it.
- Headless Brave (`--remote-debugging-port`) plus `CHROME_DEVTOOLS_AXI_BROWSER_URL` works where `chrome-devtools-axi` finds no Chrome.
