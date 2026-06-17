let siteData = null;
let hasUnsavedChanges = false;

const homeFields = ["siteTitle", "subtitle", "heroTitle", "heroText", "heroImage", "footerNote"];

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function field(name) {
  return document.getElementById(`home-${name}`);
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text || "";
  return element;
}

function setStatus(message, tone = "neutral") {
  const status = document.getElementById("save-status");
  status.textContent = message;
  status.dataset.tone = tone;
}

function setImportPreview(message, tone = "neutral") {
  const preview = document.getElementById("import-preview");
  if (!preview) return;
  preview.textContent = message || "";
  preview.dataset.tone = tone;
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

async function importExcel(file) {
  const dataUrl = await readFileAsDataUrl(file);
  const response = await fetch("/api/import-excel", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      filename: file.name,
      dataUrl
    })
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || "Excel 导入失败");
  }

  return result;
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

function formField(labelText, control) {
  const label = document.createElement("label");
  label.append(labelText, control);
  return label;
}

function createField(value, onChange, multiline = false) {
  return inputCell(value, onChange, multiline);
}

function createSectionHeader(title, buttonText, onClick) {
  const header = document.createElement("div");
  header.className = "mini-heading";
  header.appendChild(createElement("h4", "", title));
  if (buttonText && onClick) {
    header.appendChild(deleteButton(buttonText, onClick, "button ghost"));
  }
  return header;
}

function imageListEditor(items, onChange) {
  const wrapper = document.createElement("div");
  wrapper.className = "nested-list image-list-editor";

  function render() {
    wrapper.innerHTML = "";
    items.forEach((src, index) => {
      const item = document.createElement("div");
      item.className = "nested-item image-row";
      item.append(
        imageCell(src, (value) => {
          items[index] = value;
          onChange(items);
        }),
        deleteButton("删除", () => {
          items.splice(index, 1);
          onChange(items);
          markDirty();
          render();
        })
      );
      wrapper.appendChild(item);
    });
  }

  render();
  return wrapper;
}

function lifeCardsEditor(month) {
  month.lifeCards = month.lifeCards || [];
  const wrapper = document.createElement("div");
  wrapper.className = "nested-list";

  function render() {
    wrapper.innerHTML = "";
    month.lifeCards.forEach((card, index) => {
      const item = document.createElement("article");
      item.className = "nested-item";
      item.append(
        createSectionHeader(`生活灵感 ${index + 1}`, "删除", () => {
          month.lifeCards.splice(index, 1);
          markDirty();
          render();
        }),
        formField("标题", createField(card.title, (value) => card.title = value)),
        formField("小标签", createField(card.label, (value) => card.label = value)),
        formField("说明", createField(card.summary, (value) => card.summary = value, true)),
        formField("图片", imageCell(card.cover, (value) => card.cover = value))
      );
      wrapper.appendChild(item);
    });
  }

  render();
  return wrapper;
}

function featureEditor(month) {
  month.features = month.features || [];
  const wrapper = document.createElement("div");
  wrapper.className = "nested-list";

  function render() {
    wrapper.innerHTML = "";
    month.features.forEach((feature, index) => {
      const item = document.createElement("article");
      item.className = "nested-item";
      item.append(
        createSectionHeader(`精彩回顾 ${index + 1}`, "删除", () => {
          month.features.splice(index, 1);
          markDirty();
          render();
        }),
        formField("标题", createField(feature.title, (value) => feature.title = value)),
        formField("说明", createField(feature.summary, (value) => feature.summary = value, true)),
        formField("封面", imageCell(feature.cover, (value) => feature.cover = value))
      );
      wrapper.appendChild(item);
    });
  }

  render();
  return wrapper;
}

function renderMonthsEditor() {
  const container = document.getElementById("months-editor");
  container.innerHTML = "";

  siteData.months.forEach((month) => {
    const details = document.createElement("details");
    details.className = "month-editor";
    details.open = month.id === "month-5";

    const summary = document.createElement("summary");
    summary.append(
      createElement("strong", "", `${month.month || ""} ${month.title || ""}`),
      createElement("span", "", month.intro || "")
    );

    const body = document.createElement("div");
    body.className = "month-editor-body";
    body.append(
      formField("月份", createField(month.month, (value) => month.month = value)),
      formField("标题", createField(month.title, (value) => month.title = value)),
      formField("介绍", createField(month.intro, (value) => month.intro = value, true)),
      formField("主图", imageCell(month.heroImage, (value) => month.heroImage = value)),
      formField("影展标题", createField(month.galleryTitle, (value) => month.galleryTitle = value)),
      formField("回顾标题", createField(month.reviewTitle, (value) => month.reviewTitle = value)),
      formField("生活灵感标题", createField(month.lifeTitle, (value) => month.lifeTitle = value)),
      formField("照片日记标题", createField(month.diaryTitle, (value) => month.diaryTitle = value))
    );

    const galleryPanel = document.createElement("section");
    galleryPanel.className = "nested-panel";
    month.gallery = month.gallery || [];
    galleryPanel.append(
      createSectionHeader("影展照片", "新增照片", () => {
        month.gallery.push("");
        markDirty();
        renderMonthsEditor();
      }),
      imageListEditor(month.gallery, (items) => month.gallery = items)
    );

    const diaryPanel = document.createElement("section");
    diaryPanel.className = "nested-panel";
    month.diary = month.diary || [];
    diaryPanel.append(
      createSectionHeader("照片日记", "新增照片", () => {
        month.diary.push("");
        markDirty();
        renderMonthsEditor();
      }),
      imageListEditor(month.diary, (items) => month.diary = items)
    );

    const lifePanel = document.createElement("section");
    lifePanel.className = "nested-panel";
    lifePanel.append(
      createSectionHeader("生活灵感", "新增卡片", () => {
        month.lifeCards = month.lifeCards || [];
        month.lifeCards.push({
          title: "新的灵感",
          label: "打卡爱生活的100件事之",
          summary: "在这里填写说明。",
          cover: ""
        });
        markDirty();
        renderMonthsEditor();
      }),
      lifeCardsEditor(month)
    );

    const featurePanel = document.createElement("section");
    featurePanel.className = "nested-panel";
    featurePanel.append(
      createSectionHeader("精彩回顾", "新增回顾", () => {
        month.features = month.features || [];
        month.features.push({
          title: "新的回顾",
          summary: "在这里填写说明。",
          cover: ""
        });
        markDirty();
        renderMonthsEditor();
      }),
      featureEditor(month)
    );

    details.append(summary, body, galleryPanel, diaryPanel, lifePanel, featurePanel);
    container.appendChild(details);
  });
}

function renderWorksTable() {
  const tbody = document.getElementById("works-table");
  tbody.innerHTML = "";

  siteData.works.forEach((work, index) => {
    const card = document.createElement("article");
    card.className = "record-card";
    card.append(
      createSectionHeader(`作品 ${index + 1}`, "删除作品", () => {
        if (!confirm(`确定删除作品“${work.title || "未命名作品"}”吗？`)) return;
        siteData.works.splice(index, 1);
        markDirty();
        renderWorksTable();
      }),
      formField("标题", createField(work.title, (value) => work.title = value)),
      formField("类型", createField(work.category, (value) => work.category = value)),
      formField("年份", createField(work.year, (value) => work.year = value)),
      formField("简介", createField(work.summary, (value) => work.summary = value, true)),
      formField("封面/上传", imageCell(work.cover, (value) => work.cover = value)),
      formField("外部链接", createField(work.watchUrl, (value) => work.watchUrl = value)),
      featuredCheckbox(work)
    );
    tbody.appendChild(card);
  });
}

function renderArticlesTable() {
  const tbody = document.getElementById("articles-table");
  tbody.innerHTML = "";

  siteData.articles.forEach((article, index) => {
    const card = document.createElement("article");
    card.className = "record-card";
    card.append(
      createSectionHeader(`文章 ${index + 1}`, "删除文章", () => {
        if (!confirm(`确定删除文章“${article.title || "未命名文章"}”吗？`)) return;
        siteData.articles.splice(index, 1);
        markDirty();
        renderArticlesTable();
      }),
      formField("标题", createField(article.title, (value) => article.title = value)),
      formField("类型", createField(article.type, (value) => article.type = value)),
      formField("日期", createField(article.date, (value) => article.date = value)),
      formField("摘要", createField(article.excerpt, (value) => article.excerpt = value, true)),
      formField("封面/上传", imageCell(article.cover, (value) => article.cover = value)),
      formField("正文", createField(article.content, (value) => article.content = value, true))
    );
    tbody.appendChild(card);
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

function deleteButton(text, onClick, className = "button delete-button") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
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

  document.getElementById("excel-import-button").addEventListener("click", async () => {
    const input = document.getElementById("excel-import-file");
    const file = input.files[0];
    if (!file) {
      setImportPreview("请先选择一个 .xlsx 或 .csv 文件。", "error");
      return;
    }

    if (!confirm("导入后会覆盖 Excel 中对应的网页内容，并自动备份当前数据。确定导入吗？")) return;

    const button = document.getElementById("excel-import-button");
    button.disabled = true;
    setImportPreview("正在导入，请稍等...", "neutral");
    setStatus("正在导入 Excel...", "neutral");

    try {
      const result = await importExcel(file);
      const summary = result.summary || {};
      const warnings = result.warnings || [];
      setImportPreview([
        `导入成功，共读取 ${result.rows || 0} 行。`,
        `首页字段：${summary.home || 0}`,
        `侧边栏：${summary.sidebar || 0}`,
        `月份字段：${summary.months || 0}`,
        `生活灵感卡片：${summary.lifeCards || 0}`,
        `影展照片：${summary.galleries || 0}`,
        `照片日记：${summary.diaries || 0}`,
        `精彩回顾：${summary.features || 0}`,
        warnings.length ? `提醒：\n${warnings.join("\n")}` : ""
      ].filter(Boolean).join("\n"), warnings.length ? "warning" : "success");

      const response = await fetch("/api/site");
      if (!response.ok) throw new Error("导入后重新加载数据失败");
      siteData = await response.json();
      renderHomeForm();
      renderMonthsEditor();
      renderWorksTable();
      renderArticlesTable();
      hasUnsavedChanges = false;
      setStatus("Excel 已导入并保存。回到网站刷新即可看到更新。", "success");
    } catch (error) {
      setImportPreview(error.message || "Excel 导入失败", "error");
      setStatus(error.message || "Excel 导入失败", "error");
    } finally {
      button.disabled = false;
    }
  });

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
  renderMonthsEditor();
  renderWorksTable();
  renderArticlesTable();
  bindActions();
  setStatus("内容已加载，可以开始编辑。", "success");
}

loadAdmin().catch((error) => {
  setStatus(`后台加载失败：${error.message || "请确认本地服务器已经启动。"}`, "error");
});
