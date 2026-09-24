(function () {
  "use strict";

  function renderMath(root) {
    if (!window.renderMathInElement || !window.katex) return;
    renderMathInElement(root, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false },
        { left: "\\(", right: "\\)", display: false },
        { left: "\\[", right: "\\]", display: true },
      ],
      throwOnError: false,
      trust: false,
    });
  }

  function parseMarkdown(markdown) {
    if (!window.marked || !markdown) return "";
    var md = marked;
    if (typeof md.setOptions === "function") {
      md.setOptions({ gfm: true, breaks: true, mangle: false, headerIds: false });
    }
    if (typeof md.parse === "function") return md.parse(markdown);
    if (typeof md === "function") return md(markdown);
    return String(markdown);
  }

  function renderMarkdown(htmlContainer, markdown) {
    if (!markdown || !String(markdown).trim()) {
      htmlContainer.innerHTML = "<p><em>(Empty)</em></p>";
      return;
    }
    htmlContainer.innerHTML = parseMarkdown(markdown);
    renderMath(htmlContainer);
  }

  function formatDisplayDate(iso) {
    if (!iso) return "";
    var d = new Date(iso + "T12:00:00");
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function comparePosts(a, b) {
    var da = (a.date || "").localeCompare(b.date || "");
    if (da !== 0) return -da;
    return (b.title || "").localeCompare(a.title || "");
  }

  window.ResearchBlog = {
    renderMarkdown: renderMarkdown,
    renderMath: renderMath,
    formatDisplayDate: formatDisplayDate,
    comparePosts: comparePosts,
  };

  function buildPost(post) {
    var article = document.createElement("article");
    article.className = "blog-post";
    if (post.id) article.id = "post-" + post.id;

    var titleEl = document.createElement("h3");
    titleEl.className = "blog-post-title";
    titleEl.textContent = post.title || "Untitled";

    var meta = document.createElement("p");
    meta.className = "blog-post-meta";
    meta.textContent = formatDisplayDate(post.date);

    var body = document.createElement("div");
    body.className = "blog-post-body prose";

    article.appendChild(titleEl);
    article.appendChild(meta);
    article.appendChild(body);
    renderMarkdown(body, post.body || "");
    return article;
  }

  // Latest post stays visible; older posts go in the collapsible thread history.
  function renderFeed(latestEl, historyEl, data) {
    var posts = ((data && data.posts) || []).slice();
    posts.sort(comparePosts);

    var details = document.getElementById("research-history");
    var count = document.getElementById("research-history-count");

    historyEl.innerHTML = "";
    if (!posts.length) {
      latestEl.innerHTML = '<p class="blog-empty">No posts yet.</p>';
      if (details) details.hidden = true;
      return;
    }

    latestEl.innerHTML = "";
    latestEl.appendChild(buildPost(posts[0]));

    var older = posts.slice(1);
    older.forEach(function (post) {
      historyEl.appendChild(buildPost(post));
    });
    if (count) count.textContent = "(" + older.length + " older post" + (older.length === 1 ? "" : "s") + ")";
    if (details) details.hidden = !older.length;
    openForHash();
  }

  // Deep links like #post-<id> to an older post should expand the history.
  function openForHash() {
    var details = document.getElementById("research-history");
    if (!details || !location.hash) return;
    var target = document.getElementById(location.hash.slice(1));
    if (target && details.contains(target)) {
      details.open = true;
      target.scrollIntoView();
    }
  }

  function loadPosts(done) {
    var latest = document.getElementById("research-latest");
    var history = document.getElementById("research-posts");
    if (!latest || !history) return;

    fetch("research-posts.json", { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("Could not load research-posts.json (" + res.status + ")");
        return res.json();
      })
      .then(function (data) {
        renderFeed(latest, history, data);
        if (typeof done === "function") done(null, data);
      })
      .catch(function (err) {
        latest.innerHTML =
          '<p class="blog-error">Could not load posts (' + String(err.message || err) + ").</p>";
        if (typeof done === "function") done(err);
      });
  }

  window.ResearchBlog.refresh = function (callback) {
    loadPosts(callback);
  };

  document.addEventListener("DOMContentLoaded", function () {
    loadPosts();
  });
  window.addEventListener("hashchange", openForHash);
})();
