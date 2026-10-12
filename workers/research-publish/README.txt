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

Animations / media:
  In the composer (Research page) click "Attach media", pick a GIF, APNG, PNG, WebP, MP4
  or WebM (max 10 MB). The worker commits it to media/ and the markdown is inserted at the
  cursor. Existing files are never overwritten (a suffix is added).
    ![caption](media/demo.gif)   image, animates as-is
    ![caption](media/demo.mp4)   looping muted <video>; shows controls when the visitor
                                 prefers reduced motion. Alt text is the aria-label.
  Media scales to the post width. The PUBLISH_SECRET auth and GITHUB_TOKEN are the same as
  for posts. See demo/animations.html for a rendered sample.
