(function () {
  "use strict";

  var posts = [];
  var editingId = null;

  var els = {};

  function $(id) {
    return document.getElementById(id);
  }

  function sortPosts() {
    posts.sort(window.ResearchBlog.comparePosts);
  }

  function saveToLocalStorage() {
    try {
      localStorage.setItem("research-posts-draft", JSON.stringify({ posts: posts }));
    } catch (e) {}
  }

  function loadFromLocalStorage() {
    try {
      var raw = localStorage.getItem("research-posts-draft");
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function renderPostList() {
    var ul = els.postList;
    if (!ul) return;
    ul.innerHTML = "";
    sortPosts();
    posts.forEach(function (p) {
      var li = document.createElement("li");
      li.className = "admin-post-row";

      var title = document.createElement("span");
      title.className = "admin-post-title";
      title.textContent = p.title || "(no title)";

      var date = document.createElement("span");
      date.className = "admin-post-date";
      date.textContent = p.date || "";

      var btnEdit = document.createElement("button");
      btnEdit.type = "button";
      btnEdit.textContent = "Edit";
      btnEdit.addEventListener("click", function () {
        startEdit(p.id);
      });

      var btnDel = document.createElement("button");
      btnDel.type = "button";
      btnDel.textContent = "Delete";
      btnDel.addEventListener("click", function () {
        if (confirm('Remove “' + (p.title || "post") + '”?')) {
          posts = posts.filter(function (x) {
            return x.id !== p.id;
          });
          if (editingId === p.id) clearForm();
          renderPostList();
          saveToLocalStorage();
          setStatus("Deleted. Remember to download JSON to update the live site.");
        }
      });

      li.appendChild(title);
      li.appendChild(date);
      li.appendChild(btnEdit);
      li.appendChild(btnDel);
      ul.appendChild(li);
    });

    if (!posts.length) {
      var empty = document.createElement("li");
      empty.className = "admin-empty";
      empty.textContent = "No posts in working copy.";
      ul.appendChild(empty);
    }
  }

  function clearForm() {
    editingId = null;
    els.titleInput.value = "";
    els.dateInput.value = new Date().toISOString().slice(0, 10);
    els.bodyInput.value = "";
    els.preview.innerHTML = "";
    els.saveBtn.textContent = "Add post";
    els.cancelEdit.hidden = true;
  }

  function startEdit(id) {
    var p = posts.filter(function (x) {
      return x.id === id;
    })[0];
    if (!p) return;
    editingId = id;
    els.titleInput.value = p.title || "";
    els.dateInput.value = p.date || "";
    els.bodyInput.value = p.body || "";
    els.saveBtn.textContent = "Update post";
    els.cancelEdit.hidden = false;
    updatePreview();
    setStatus("Editing “" + (p.title || "") + "”.");
  }

  function updatePreview() {
    window.ResearchBlog.renderMarkdown(els.preview, els.bodyInput.value);
  }

  function setStatus(msg) {
    if (els.status) els.status.textContent = msg;
  }

  function downloadJson() {
    sortPosts();
    var payload = JSON.stringify({ posts: posts }, null, 2);
    var blob = new Blob([payload], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "research-posts.json";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    setStatus("Download started. Replace research-posts.json in your repo and push.");
  }

  function mergeRemoteIntoWorking(remote) {
    var remotePosts = (remote && remote.posts) || [];
    var seen = {};
    posts.forEach(function (p) {
      seen[p.id] = true;
    });
    remotePosts.forEach(function (p) {
      if (!seen[p.id]) {
        posts.push(p);
        seen[p.id] = true;
      }
    });
    sortPosts();
  }

  document.addEventListener("DOMContentLoaded", function () {
    els.postList = $("admin-post-list");
    els.titleInput = $("post-title");
    els.dateInput = $("post-date");
    els.bodyInput = $("post-body");
    els.preview = $("post-preview");
    els.saveBtn = $("btn-save-post");
    els.cancelEdit = $("btn-cancel-edit");
    els.downloadBtn = $("btn-download-json");
    els.reloadBtn = $("btn-reload-remote");
    els.importInput = $("import-json-file");
    els.status = $("admin-status");

    if (!els.dateInput.value) els.dateInput.value = new Date().toISOString().slice(0, 10);

    var draft = loadFromLocalStorage();
    if (draft && draft.posts && draft.posts.length) {
      posts = draft.posts.slice();
      renderPostList();
      setStatus("Restored draft from this browser. Reload from file/server for fresh remote.");
    }

    fetch("research-posts.json", { cache: "no-store" })
      .then(function (res) {
        return res.ok ? res.json() : { posts: [] };
      })
      .then(function (data) {
        if (!posts.length) {
          posts = (data.posts || []).slice();
          renderPostList();
          saveToLocalStorage();
          setStatus("Loaded research-posts.json from site.");
        }
      })
      .catch(function () {
        if (!posts.length) setStatus("Could not fetch research-posts.json (offline?). Use Import or add posts.");
      });

    els.bodyInput.addEventListener("input", updatePreview);
    els.saveBtn.addEventListener("click", function () {
      var title = els.titleInput.value.trim();
      var date = els.dateInput.value.trim();
      var body = els.bodyInput.value;
      if (!title) {
        alert("Please enter a title.");
        return;
      }
      if (!body.trim()) {
        alert("Please enter body text (Markdown / LaTeX).");
        return;
      }

      if (editingId) {
        posts = posts.map(function (p) {
          if (p.id !== editingId) return p;
          return { id: p.id, title: title, date: date, body: body };
        });
        clearForm();
        setStatus("Post updated. Download JSON and push to publish.");
      } else {
        var id =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : "post-" + Date.now();
        posts.push({ id: id, title: title, date: date, body: body });
        clearForm();
        setStatus("Post added. Download JSON and push to publish.");
      }
      renderPostList();
      saveToLocalStorage();
    });

    els.cancelEdit.addEventListener("click", function () {
      clearForm();
      setStatus("Cancelled edit.");
    });

    els.downloadBtn.addEventListener("click", downloadJson);

    els.reloadBtn.addEventListener("click", function () {
      fetch("research-posts.json", { cache: "no-store" })
        .then(function (res) {
          return res.json();
        })
        .then(function (data) {
          mergeRemoteIntoWorking(data);
          renderPostList();
          saveToLocalStorage();
          setStatus("Merged remote posts into working copy (by id).");
        })
        .catch(function () {
          alert("Could not reload research-posts.json.");
        });
    });

    els.importInput.addEventListener("change", function () {
      var file = els.importInput.files && els.importInput.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var data = JSON.parse(reader.result);
          posts = (data.posts || []).slice();
          sortPosts();
          renderPostList();
          clearForm();
          saveToLocalStorage();
          setStatus("Imported " + posts.length + " post(s) from file.");
        } catch (e) {
          alert("Invalid JSON: " + e.message);
        }
        els.importInput.value = "";
      };
      reader.readAsText(file);
    });
  });
})();
