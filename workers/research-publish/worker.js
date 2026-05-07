/**
 * Cloudflare Worker: append a post to research-posts.json via GitHub Contents API.
 * Your site’s “Post” button calls this (CORS). GitHub token stays on the Worker only.
 *
 * Secrets (wrangler secret put …):
 *   GITHUB_TOKEN       — classic PAT or fine-grained with Contents read/write on this repo
 *   PUBLISH_SECRET     — long random string; same value stored in browser “Publishing setup”
 *
 * Vars (wrangler.toml [vars] or dashboard):
 *   GITHUB_OWNER       — e.g. alutterb
 *   GITHUB_REPO        — e.g. alutterb.github.io
 *   GITHUB_BRANCH      — main
 *   TARGET_PATH        — research-posts.json
 *   ALLOW_ORIGIN       — https://alutterb.github.io (must match your Pages origin exactly)
 */

function corsHeaders(env) {
  var origin = env.ALLOW_ORIGIN || "https://alutterb.github.io";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    Vary: "Origin",
  };
}

function json(resBody, status, env) {
  return new Response(JSON.stringify(resBody), {
    status: status || 200,
    headers: {
      ...corsHeaders(env),
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function decodeBase64Utf8(b64) {
  var bin = atob(String(b64).replace(/\s/g, ""));
  var bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function encodeBase64Utf8(str) {
  var bytes = new TextEncoder().encode(str);
  var bin = "";
  for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export default {
  async fetch(request, env) {
    var ch = corsHeaders(env);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: ch });
    }

    if (request.method !== "POST") {
      return json({ error: "Use POST" }, 405, env);
    }

    var pub = env.PUBLISH_SECRET || "";
    var auth = request.headers.get("Authorization") || "";
    if (!pub || auth !== "Bearer " + pub) {
      return json({ error: "Unauthorized" }, 401, env);
    }

    var owner = env.GITHUB_OWNER || "";
    var repo = env.GITHUB_REPO || "";
    var branch = env.GITHUB_BRANCH || "main";
    var path = env.TARGET_PATH || "research-posts.json";
    var token = env.GITHUB_TOKEN || "";

    if (!owner || !repo || !token) {
      return json({ error: "Worker missing GITHUB_OWNER / GITHUB_REPO / GITHUB_TOKEN" }, 500, env);
    }

    var payload;
    try {
      payload = await request.json();
    } catch (e) {
      return json({ error: "Invalid JSON body" }, 400, env);
    }

    var title = String(payload.title || "").trim();
    var body = String(payload.body || "");
    var date = String(payload.date || "").trim();
    var id = String(payload.id || "").trim();

    if (!title || !body.trim()) {
      return json({ error: "title and body required" }, 400, env);
    }
    if (!id) {
      id = crypto.randomUUID();
    }

    var apiUrl =
      "https://api.github.com/repos/" +
      encodeURIComponent(owner) +
      "/" +
      encodeURIComponent(repo) +
      "/contents/" +
      path
        .split("/")
        .map(function (p) {
          return encodeURIComponent(p);
        })
        .join("/");

    var ghHeaders = {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + token,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "research-publish-worker",
    };

    var getRes = await fetch(apiUrl + "?ref=" + encodeURIComponent(branch), {
      headers: ghHeaders,
    });

    var sha;
    var posts;

    if (getRes.status === 404) {
      posts = [];
    } else if (!getRes.ok) {
      var errText = await getRes.text();
      return json({ error: "GitHub GET failed", detail: errText.slice(0, 400) }, 502, env);
    } else {
      var fileMeta = await getRes.json();
      sha = fileMeta.sha;
      var parsed = JSON.parse(decodeBase64Utf8(fileMeta.content));
      posts = Array.isArray(parsed.posts) ? parsed.posts : [];
    }

    posts.push({ id: id, title: title, date: date, body: body });

    var out = JSON.stringify({ posts: posts }, null, 2);
    var contentB64 = encodeBase64Utf8(out);

    var putBody = {
      message: "Research post: " + title.replace(/\s+/g, " ").slice(0, 72),
      content: contentB64,
      branch: branch,
    };
    if (sha) putBody.sha = sha;

    var putRes = await fetch(apiUrl, {
      method: "PUT",
      headers: {
        ...ghHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(putBody),
    });

    if (!putRes.ok) {
      var putErr = await putRes.text();
      return json({ error: "GitHub PUT failed", detail: putErr.slice(0, 400) }, 502, env);
    }

    return json({ ok: true, id: id }, 200, env);
  },
};
