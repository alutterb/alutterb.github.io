research-publish Worker — “Post” button on research.html
==========================================================

Why: Browsers cannot call the GitHub API directly (CORS). This Worker holds your
GitHub token and appends new posts to research-posts.json.

1. Copy wrangler.toml.sample → wrangler.toml and edit OWNER/REPO/ALLOW_ORIGIN if needed.

2. Create secrets:
     npx wrangler login
     npx wrangler secret put GITHUB_TOKEN
     npx wrangler secret put PUBLISH_SECRET

   GITHUB_TOKEN: GitHub → Settings → Developer settings → PAT (classic: repo scope),
   or fine-grained token with Contents read/write on alutterb/alutterb.github.io only.

   PUBLISH_SECRET: any long random string (password manager). You will paste the SAME
   string into your website “Publishing setup” so only you can call this Worker.

3. Deploy:
     npx wrangler deploy

4. Note the Worker URL, e.g. https://research-publish.alutterb.workers.dev

5. On your live site → Research page → “Publishing setup”:
   - Publish URL = that Worker URL (https://…workers.dev with no trailing slash)
   - Secret = same PUBLISH_SECRET

6. Click Post. GitHub receives a commit; GitHub Pages may take ~1–2 minutes to show the new post.

Optional: deploy under a routes.custom_domain in wrangler if you prefer a path on your own domain.

Automation helpers
------------------
If you want “one command” setup from this folder:

WSL/Linux/macOS:
  bash deploy.sh --secrets    (first time / secret rotation)
  bash deploy.sh              (deploy only)

Windows PowerShell:
  .\\deploy.ps1

They will prompt you for the two secrets and then deploy.
