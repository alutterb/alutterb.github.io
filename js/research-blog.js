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

  function renderPostsInto(container, data) {
    var posts = (data && data.posts) || [];
    posts.sort(comparePosts);

    if (!posts.length) {
      container.innerHTML = '<p class="blog-empty">No posts yet.</p>';
      return;
    }

    container.innerHTML = "";
    posts.forEach(function (post) {
      var article = document.createElement("article");
      article.className = "blog-post";
      article.id = post.id ? "post-" + post.id : "";

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
      container.appendChild(article);

      renderMarkdown(body, post.body || "");
    });
  }

  function loadPosts(containerId, done) {
    var container = document.getElementById(containerId);
    if (!container) return;

    fetch("research-posts.json", { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("Could not load research-posts.json (" + res.status + ")");
        return res.json();
      })
      .then(function (data) {
        renderPostsInto(container, data);
        if (typeof done === "function") done(null, data);
      })
      .catch(function (err) {
        container.innerHTML =
          '<p class="blog-error">Could not load posts (' + String(err.message || err) + ").</p>";
        if (typeof done === "function") done(err);
      });
  }

  function mount(containerId) {
    loadPosts(containerId);
  }

  window.ResearchBlog.refresh = function (callback) {
    loadPosts("research-posts", callback);
  };

  document.addEventListener("DOMContentLoaded", function () {
    mount("research-posts");
  });
})();
