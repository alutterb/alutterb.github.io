// Appends a post to research-posts.json via the GitHub Contents API.
// Also accepts {action:"upload-media", name, content(base64)} and commits the file to media/.
// Secrets: GITHUB_TOKEN, PUBLISH_SECRET.
// Vars: GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH, TARGET_PATH, ALLOW_ORIGIN.

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

var MAX_MEDIA_BYTES = 10 * 1024 * 1024;
var MEDIA_EXT = /\.(gif|png|apng|webp|mp4|webm)$/i;

function safeMediaName(name) {
  var base = String(name || "")
    .split(/[\\/]/)
    .pop()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[-.]+/, "");
  return base.slice(-80);
}

function contentsUrl(owner, repo, path) {
  return (
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
      .join("/")
  );
}

async function uploadMedia(payload, ctx, env) {
  var name = safeMediaName(payload.name);
  if (!MEDIA_EXT.test(name)) {
    return json({ error: "Unsupported file type. Use GIF, APNG, PNG, WebP, MP4 or WebM." }, 400, env);
  }
  var b64 = String(payload.content || "").replace(/\s/g, "");
  if (!b64) {
    return json({ error: "content required" }, 400, env);
  }
  var bytes = Math.floor((b64.length * 3) / 4) - (b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0);
  if (bytes > MAX_MEDIA_BYTES) {
    return json(
      { error: "File is " + (bytes / 1048576).toFixed(1) + " MB. The limit is 10 MB." },
      413,
      env
    );
  }

  var path = "media/" + name;
  var apiUrl = contentsUrl(ctx.owner, ctx.repo, path);
  var exists = await fetch(apiUrl + "?ref=" + encodeURIComponent(ctx.branch), {
    headers: ctx.ghHeaders,
  });
  if (exists.status === 200) {
    // Never overwrite an existing file; keep both.
    var dot = name.lastIndexOf(".");
    name = name.slice(0, dot) + "-" + Date.now().toString(36) + name.slice(dot);
    path = "media/" + name;
    apiUrl = contentsUrl(ctx.owner, ctx.repo, path);
  } else if (exists.status !== 404) {
    return json({ error: "GitHub GET failed" }, 502, env);
  }

  var putRes = await fetch(apiUrl, {
    method: "PUT",
    headers: { ...ctx.ghHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Research media: " + name, content: b64, branch: ctx.branch }),
  });
  if (!putRes.ok) {
    var putErr = await putRes.text();
    return json({ error: "GitHub PUT failed", detail: putErr.slice(0, 400) }, 502, env);
  }
  return json({ ok: true, path: path }, 200, env);
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

    var ghHeaders = {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + token,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "research-publish-worker",
    };

    if (payload.action === "upload-media") {
      return uploadMedia(payload, { owner: owner, repo: repo, branch: branch, ghHeaders: ghHeaders }, env);
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
