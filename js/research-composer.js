(function () {
  "use strict";

  var LS_URL = "research_publish_worker_url";
  var LS_SECRET = "research_publish_secret";

  function safeDecodeURIComponent(s) {
    try {
      return decodeURIComponent(String(s || ""));
    } catch (e) {
      return String(s || "");
    }
  }

  function getSetupFromQuery() {
    try {
      var u = new URL(window.location.href);
      var publishUrl = u.searchParams.get("publishUrl") || u.searchParams.get("publish_url");
      var secret = u.searchParams.get("secret");
      var autosave = u.searchParams.get("autosave") || u.searchParams.get("save");
      return {
        publishUrl: publishUrl ? safeDecodeURIComponent(publishUrl).trim().replace(/\/+$/, "") : "",
        secret: secret ? safeDecodeURIComponent(secret) : "",
        autosave: autosave === "1" || autosave === "true" || autosave === "yes",
      };
    } catch (e) {
      return { publishUrl: "", secret: "", autosave: false };
    }
  }

  function $(id) {
    return document.getElementById(id);
  }

  function todayIsoDate() {
    return new Date().toISOString().slice(0, 10);
  }

  function schedulePreview() {
    if (previewTimer) clearTimeout(previewTimer);
    previewTimer = setTimeout(runPreview, 120);
  }

  var previewTimer = null;

  function runPreview() {
    var prev = $("feed-preview");
    var body = $("feed-body");
    if (!prev || !body || !window.ResearchBlog) return;
    ResearchBlog.renderMarkdown(prev, body.value);
  }

  function setStatus(el, msg, isError) {
    if (!el) return;
    el.textContent = msg || "";
    el.classList.toggle("is-error", !!isError);
  }

  function loadSetupIntoInputs() {
    var urlEl = $("feed-publish-url");
    var secEl = $("feed-publish-secret");
    if (urlEl) urlEl.value = localStorage.getItem(LS_URL) || "";
    if (secEl) secEl.value = localStorage.getItem(LS_SECRET) || "";
  }

  function applySetup(publishUrl, secret, autosave) {
    var urlEl = $("feed-publish-url");
    var secEl = $("feed-publish-secret");
    var st = $("feed-setup-status");

    if (publishUrl && urlEl) urlEl.value = publishUrl;
    if (secret && secEl) secEl.value = secret;

    if (autosave && publishUrl && secret) {
      localStorage.setItem(LS_URL, publishUrl);
      localStorage.setItem(LS_SECRET, secret);
      setStatus(st, "Saved in this browser (from link).");
    } else if (publishUrl || secret) {
      setStatus(st, "Filled from link. Click Save to store in this browser.");
    }
  }

  function saveSetup() {
    var urlEl = $("feed-publish-url");
    var secEl = $("feed-publish-secret");
    var st = $("feed-setup-status");
    if (!urlEl || !secEl) return;
    var u = urlEl.value.trim().replace(/\/+$/, "");
    var s = secEl.value;
    if (!u || !s) {
      setStatus(st, "Enter both URL and secret.", true);
      return;
    }
    try {
      new URL(u);
    } catch (e) {
      setStatus(st, "Publish URL doesn’t look valid.", true);
      return;
    }
    localStorage.setItem(LS_URL, u);
    localStorage.setItem(LS_SECRET, s);
    setStatus(st, "Saved in this browser.");
  }

  document.addEventListener("DOMContentLoaded", function () {
    var titleEl = $("feed-title");
    var dateEl = $("feed-date");
    var bodyEl = $("feed-body");
    var postBtn = $("feed-post-btn");
    var statusEl = $("feed-post-status");
    var setupToggle = $("feed-setup-toggle");
    var setupPanel = $("feed-setup-panel");
    var saveSetupBtn = $("feed-save-setup");
    var previewDetails = document.querySelector(".feed-preview-details");

    if (!titleEl || !bodyEl || !postBtn) return;

    if (dateEl && !dateEl.value) dateEl.value = todayIsoDate();

    loadSetupIntoInputs();
    var q = getSetupFromQuery();
    if (q.publishUrl || q.secret) {
      applySetup(q.publishUrl, q.secret, q.autosave);
      if (setupPanel) setupPanel.hidden = false;
    }

    if (bodyEl) {
      bodyEl.addEventListener("input", schedulePreview);
      bodyEl.addEventListener("change", runPreview);
    }
    if (titleEl) titleEl.addEventListener("input", schedulePreview);

    if (setupToggle && setupPanel) {
      setupToggle.addEventListener("click", function () {
        setupPanel.hidden = !setupPanel.hidden;
      });
    }
    if (saveSetupBtn) saveSetupBtn.addEventListener("click", saveSetup);

    if (previewDetails) {
      previewDetails.addEventListener("toggle", function () {
        if (previewDetails.open) runPreview();
      });
    }

    postBtn.addEventListener("click", function () {
      var title = (titleEl.value || "").trim();
      var body = bodyEl.value || "";
      var date = (dateEl && dateEl.value) ? dateEl.value.trim() : todayIsoDate();

      if (!title) {
        setStatus(statusEl, "Add a title.", true);
        return;
      }
      if (!body.trim()) {
        setStatus(statusEl, "Write something in the box.", true);
        return;
      }

      var baseUrl = localStorage.getItem(LS_URL);
      var secret = localStorage.getItem(LS_SECRET);
      if (!baseUrl || !secret) {
        setStatus(statusEl, 'Use “Publishing setup” first (Worker URL + secret).', true);
        if (setupPanel) setupPanel.hidden = false;
        return;
      }

      var id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : "post-" + Date.now();

      setStatus(statusEl, "Posting…");
      postBtn.disabled = true;

      fetch(baseUrl.replace(/\/+$/, "") + "/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + secret,
        },
        body: JSON.stringify({
          id: id,
          title: title,
          body: body,
          date: date,
        }),
      })
        .then(function (res) {
          return res.text().then(function (text) {
            var data = {};
            try {
              data = text ? JSON.parse(text) : {};
            } catch (e) {
              data = { raw: text };
            }
            return { ok: res.ok, status: res.status, data: data };
          });
        })
        .then(function (r) {
          if (!r.ok) {
            var msg =
              (r.data && r.data.error) ||
              (r.data && r.data.detail) ||
              (r.data && r.data.raw) ||
              "Publish failed (" + r.status + ")";
            throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
          }
          titleEl.value = "";
          bodyEl.value = "";
          if (dateEl) dateEl.value = todayIsoDate();
          runPreview();
          setStatus(statusEl, "Posted to GitHub. Pages may take ~1 minute…");
          var n = 0;
          function bumpList() {
            n += 1;
            if (window.ResearchBlog && ResearchBlog.refresh) ResearchBlog.refresh();
            if (n < 6) setTimeout(bumpList, 4000);
          }
          setTimeout(bumpList, 2500);
        })
        .catch(function (e) {
          setStatus(statusEl, String(e.message || e), true);
        })
        .finally(function () {
          postBtn.disabled = false;
        });
    });
  });
})();
