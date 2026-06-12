let siteData = null;
let hasUnsavedChanges = false;

const homeFields = ["siteTitle", "subtitle", "heroTitle", "heroText", "heroImage", "footerNote"];

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function field(name) {
  return document.getElementById(`home-${name}`);
}

function setStatus(message, tone = "neutral") {
  const status = document.getElementById("save-status");
  status.textContent = message;
  status.dataset.tone = tone;
}

function markDirty() {
  hasUnsavedChanges = true;
  setStatus("有未保存的修改。", "warning");
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadImage(file) {
  const dataUrl = await readFileAsDataUrl(file);
  const response = await fetch("/api/upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      filename: file.name,
      dataUrl
    })
  });

  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || "图片上传失败");
  }

  const result = await response.json();
  return result.url;
}

function renderHomeForm() {
  const home = siteData.home || {};
  homeFields.forEach((name) => {
    const input = field(name);
    input.value = home[name] || "";
    input.addEventListener("input", markDirty);
  });
}

function imageCell(value, onChange) {
  const wrapper = document.createElement("div");
  wrapper.className = "image-cell";

  const preview = document.createElement("img");
  preview.className = "image-preview";
  preview.alt = "图片预览";
  preview.src = value || "/assets/hero.png";

  const input = document.createElement("input");
  input.type = "text";
  input.value = value || "";
  input.placeholder = "图片地址或上传后自动填入";
  input.addEventListener("input", () => {
    preview.src = input.value || "/assets/hero.png";
    onChange(input.value);
    markDirty();
  });

  const upload = document.createElement("input");
  upload.type = "file";
  upload.accept = "image/*";
  upload.addEventListener("change", async () => {
    if (!upload.files[0]) return;
    setStatus("正在上传图片...", "neutral");
    try {
      const url = await uploadImage(upload.files[0]);
      input.value = url;
      preview.src = url;
      onChange(url);
      markDirty();
    } catch (error) {
      setStatus(error.message || "图片上传失败", "error");
    }
  });

  wrapper.append(preview, input, upload);
  return wrapper;
}

function inputCell(value, onChange, multiline = false) {
  const input = document.createElement(multiline ? "textarea" : "input");
  if (!multiline) input.type = "text";
  input.value = value || "";
  input.addEventListener("input", () => {
    onChange(input.value);
    markDirty();
  });
  return input;
}

function renderWorksTable() {
  const tbody = document.getElementById("works-table");
  tbody.innerHTML = "";

  siteData.works.forEach((work, index) => {
    const row = document.createElement("tr");
    row.append(
      td(inputCell(work.title, (value) => work.title = value)),
      td(inputCell(work.category, (value) => work.category = value)),
      td(inputCell(work.year, (value) => work.year = value)),
      td(inputCell(work.summary, (value) => work.summary = value, true)),
      td(imageCell(work.cover, (value) => work.cover = value)),
      td(inputCell(work.watchUrl, (value) => work.watchUrl = value)),
      td(featuredCheckbox(work)),
      td(deleteButton("删除", () => {
        if (!confirm(`确定删除作品“${work.title || "未命名作品"}”吗？`)) return;
        siteData.works.splice(index, 1);
        markDirty();
        renderWorksTable();
      }))
    );
    tbody.appendChild(row);
  });
}

function renderArticlesTable() {
  const tbody = document.getElementById("articles-table");
  tbody.innerHTML = "";

  siteData.articles.forEach((article, index) => {
    const row = document.createElement("tr");
    row.append(
      td(inputCell(article.title, (value) => article.title = value)),
      td(inputCell(article.type, (value) => article.type = value)),
      td(inputCell(article.date, (value) => article.date = value)),
      td(inputCell(article.excerpt, (value) => article.excerpt = value, true)),
      td(imageCell(article.cover, (value) => article.cover = value)),
      td(inputCell(article.content, (value) => article.content = value, true)),
      td(deleteButton("删除", () => {
        if (!confirm(`确定删除文章“${article.title || "未命名文章"}”吗？`)) return;
        siteData.articles.splice(index, 1);
        markDirty();
        renderArticlesTable();
      }))
    );
    tbody.appendChild(row);
  });
}

function td(child) {
  const cell = document.createElement("td");
  cell.appendChild(child);
  return cell;
}

function featuredCheckbox(work) {
  const label = document.createElement("label");
  label.className = "checkbox-label";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = Boolean(work.featured);
  input.addEventListener("change", () => {
    work.featured = input.checked;
    markDirty();
  });
  label.append(input, document.createTextNode("精选"));
  return label;
}

function deleteButton(text, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "button delete-button";
  button.textContent = text;
  button.addEventListener("click", onClick);
  return button;
}

function readHomeForm() {
  siteData.home = siteData.home || {};
  homeFields.forEach((name) => {
    siteData.home[name] = field(name).value;
  });
}

function bindActions() {
  document.getElementById("home-image-upload").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setStatus("正在上传首页图片...", "neutral");
    try {
      field("heroImage").value = await uploadImage(file);
      markDirty();
    } catch (error) {
      setStatus(error.message || "图片上传失败", "error");
    }
  });

  document.getElementById("add-work").addEventListener("click", () => {
    siteData.works.unshift({
      id: uid("work"),
      title: "新的影像作品",
      category: "短片",
      year: new Date().getFullYear().toString(),
      summary: "在这里填写作品简介。",
      cover: "",
      watchUrl: "",
      featured: false
    });
    markDirty();
    renderWorksTable();
  });

  document.getElementById("add-article").addEventListener("click", () => {
    siteData.articles.unshift({
      id: uid("article"),
      title: "新的文章",
      type: "影像笔记",
      date: new Date().toISOString().slice(0, 10),
      excerpt: "在这里填写摘要。",
      cover: "",
      content: "在这里填写正文。"
    });
    markDirty();
    renderArticlesTable();
  });

  document.getElementById("save-button").addEventListener("click", saveData);

  window.addEventListener("beforeunload", (event) => {
    if (!hasUnsavedChanges) return;
    event.preventDefault();
    event.returnValue = "";
  });
}

async function saveData() {
  readHomeForm();
  const button = document.getElementById("save-button");
  button.disabled = true;
  setStatus("正在保存...", "neutral");

  try {
    const response = await fetch("/api/site", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(siteData)
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || "保存失败");
    }

    hasUnsavedChanges = false;
    setStatus("已保存。回到网站刷新即可看到更新。", "success");
  } catch (error) {
    setStatus(error.message || "保存失败", "error");
  } finally {
    button.disabled = false;
  }
}

async function loadAdmin() {
  const response = await fetch("/api/site");
  if (!response.ok) throw new Error("后台加载失败");
  siteData = await response.json();
  siteData.home = siteData.home || {};
  siteData.works = siteData.works || [];
  siteData.articles = siteData.articles || [];
  renderHomeForm();
  renderWorksTable();
  renderArticlesTable();
  bindActions();
  setStatus("内容已加载，可以开始编辑。", "success");
}

loadAdmin().catch(() => {
  setStatus("后台加载失败，请确认本地服务器已经启动。", "error");
});
