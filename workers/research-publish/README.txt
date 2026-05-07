research-publish Worker
=======================

Holds the GitHub token; appends posts to research-posts.json.

Setup:
  cp wrangler.toml.sample wrangler.toml   # edit OWNER/REPO/ALLOW_ORIGIN
  npx wrangler login
  npx wrangler secret put GITHUB_TOKEN     # PAT, repo scope
  npx wrangler secret put PUBLISH_SECRET   # long random string
  npx wrangler deploy

In Research → Publishing setup, paste the worker URL and the same PUBLISH_SECRET.
