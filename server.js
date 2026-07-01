const http = require("http");
const childProcess = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const root = __dirname;
const publicDir = path.join(root, "public");
const adminDir = path.join(root, "admin");
const uploadsDir = path.join(publicDir, "uploads");
const dataFile = path.join(root, "data", "site-data.json");
const backupFile = path.join(root, "data", "site-data.backup.json");
const staticDataFile = path.join(publicDir, "data", "site-data.json");
const excelParser = path.join(root, "scripts", "parse-excel.ps1");
const port = process.env.PORT || 3000;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml; charset=utf-8"
};

const importHeaders = ["type", "target", "field", "order", "title", "label", "text", "image", "href"];

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function readBody(req, limit = 30 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("Request body is too large. Please compress images or save fewer images at once."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function saveUploadedImage(filename, dataUrl) {
  const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || "");
  if (!match) {
    throw new Error("Only png, jpg, webp, and gif images are supported");
  }

  const extensions = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif"
  };
  const safeName = path.basename(filename || "image").replace(/[^a-zA-Z0-9._-]/g, "-").replace(/\.+/g, ".");
  const parsedName = path.parse(safeName);
  const extension = extensions[match[1]];
  const baseName = (parsedName.name || "image").slice(0, 42);
  const finalName = `${Date.now()}-${baseName}${extension}`;

  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.writeFileSync(path.join(uploadsDir, finalName), Buffer.from(match[2], "base64"));
  return `/uploads/${finalName}`;
}

function readCurrentData() {
  return JSON.parse(fs.readFileSync(dataFile, "utf8").replace(/^\uFEFF/, ""));
}

function validateSiteData(data) {
  if (!data || typeof data !== "object" || !data.home || !Array.isArray(data.months) || !Array.isArray(data.sidebarLinks) || !Array.isArray(data.works) || !Array.isArray(data.articles)) {
    throw new Error("Invalid site data shape");
  }
}

function backupSiteData() {
  if (!fs.existsSync(dataFile)) return null;

  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const timestampedBackup = path.join(root, "data", `site-data.backup-${stamp}.json`);

  try {
    fs.copyFileSync(dataFile, timestampedBackup);
    return timestampedBackup;
  } catch (error) {
    try {
      fs.copyFileSync(dataFile, backupFile);
      return backupFile;
    } catch (fallbackError) {
      console.warn(`Backup skipped: ${fallbackError.message || error.message}`);
      return null;
    }
  }
}

function saveSiteData(data) {
  validateSiteData(data);
  backupSiteData();
  const content = `${JSON.stringify(data, null, 2)}\n`;
  fs.writeFileSync(dataFile, content, "utf8");
  fs.mkdirSync(path.dirname(staticDataFile), { recursive: true });
  fs.writeFileSync(staticDataFile, content, "utf8");
}

function decodeDataUrl(dataUrl) {
  const match = /^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || "");
  if (!match) throw new Error("Invalid upload data");
  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64")
  };
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (quoted) {
      if (char === "\"" && next === "\"") {
        value += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        value += char;
      }
    } else if (char === "\"") {
      quoted = true;
    } else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else if (char !== "\r") {
      value += char;
    }
  }

  row.push(value);
  rows.push(row);
  return rows.filter((cells) => cells.some((cell) => String(cell || "").trim()));
}

function rowsToObjects(rows) {
  const header = (rows[0] || []).map((value) => String(value || "").trim());
  const headerMap = new Map(header.map((name, index) => [name, index]));
  const missing = importHeaders.filter((name) => !headerMap.has(name));
  if (missing.length) {
    throw new Error(`Excel 模板缺少列：${missing.join(", ")}`);
  }

  return rows.slice(1).map((cells) => {
    const item = {};
    importHeaders.forEach((name) => {
      item[name] = String(cells[headerMap.get(name)] || "").trim();
    });
    return item;
  }).filter((item) => item.type);
}

function parseExcelFile(filePath) {
  const script = [
    "$OutputEncoding=[System.Text.Encoding]::UTF8",
    `& '${excelParser.replace(/'/g, "''")}' -Path '${filePath.replace(/'/g, "''")}'`
  ].join("; ");
  const result = childProcess.spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024
  });

  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "Excel 解析失败").trim());
  }

  return JSON.parse(result.stdout || "[]");
}

function numberValue(value, fallback = 0) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sortByOrder(items) {
  return items.sort((a, b) => numberValue(a.order) - numberValue(b.order));
}

function applyImportRows(existingData, rows) {
  const data = JSON.parse(JSON.stringify(existingData));
  const warnings = [];
  const summary = {
    home: 0,
    sidebar: 0,
    months: 0,
    lifeCards: 0,
    galleries: 0,
    diaries: 0,
    features: 0
  };

  const monthMap = new Map((data.months || []).map((month) => [month.id, month]));
  const grouped = {
    sidebar: [],
    lifeCard: new Map(),
    gallery: new Map(),
    diary: new Map(),
    feature: new Map()
  };

  rows.forEach((row, index) => {
    const line = index + 2;
    const type = row.type;
    const month = row.target ? monthMap.get(row.target) : null;

    if (type === "home") {
      if (!row.field) {
        warnings.push(`第 ${line} 行 home 缺少 field`);
        return;
      }
      if (row.image) data.home[row.field] = row.image;
      else data.home[row.field] = row.text || row.title || "";
      summary.home += 1;
      return;
    }

    if (type === "sidebar") {
      if (!row.title || !row.href) {
        warnings.push(`第 ${line} 行 sidebar 需要 title 和 href`);
        return;
      }
      grouped.sidebar.push(row);
      summary.sidebar += 1;
      return;
    }

    if (!month) {
      warnings.push(`第 ${line} 行找不到月份：${row.target || "空"}`);
      return;
    }

    if (type === "month") {
      if (!row.field) {
        warnings.push(`第 ${line} 行 month 缺少 field`);
        return;
      }
      month[row.field] = row.image || row.text || row.title || "";
      summary.months += 1;
      return;
    }

    if (["lifeCard", "gallery", "diary", "feature"].includes(type)) {
      if (!grouped[type].has(row.target)) grouped[type].set(row.target, []);
      grouped[type].get(row.target).push(row);
      return;
    }

    warnings.push(`第 ${line} 行类型不支持：${type}`);
  });

  if (grouped.sidebar.length) {
    data.sidebarLinks = sortByOrder(grouped.sidebar).map((row) => ({
      title: row.title,
      href: row.href
    }));
  }

  grouped.lifeCard.forEach((items, monthId) => {
    const month = monthMap.get(monthId);
    month.lifeCards = sortByOrder(items).map((row) => ({
      title: row.title,
      label: row.label,
      summary: row.text,
      cover: row.image
    }));
    summary.lifeCards += month.lifeCards.length;
  });

  grouped.gallery.forEach((items, monthId) => {
    const month = monthMap.get(monthId);
    month.gallery = sortByOrder(items).map((row) => row.image).filter(Boolean);
    summary.galleries += month.gallery.length;
  });

  grouped.diary.forEach((items, monthId) => {
    const month = monthMap.get(monthId);
    month.diary = sortByOrder(items).map((row) => row.image).filter(Boolean);
    summary.diaries += month.diary.length;
  });

  grouped.feature.forEach((items, monthId) => {
    const month = monthMap.get(monthId);
    month.features = sortByOrder(items).map((row) => ({
      title: row.title,
      summary: row.text,
      cover: row.image
    }));
    summary.features += month.features.length;
  });

  validateSiteData(data);
  return { data, summary, warnings };
}

function importRowsFromUpload(payload) {
  const filename = path.basename(payload.filename || "");
  const lowerName = filename.toLowerCase();
  const { buffer } = decodeDataUrl(payload.dataUrl);

  if (lowerName.endsWith(".csv")) {
    return rowsToObjects(parseCsvRows(buffer.toString("utf8").replace(/^\uFEFF/, "")));
  }

  if (!lowerName.endsWith(".xlsx")) {
    throw new Error("请上传 .xlsx Excel 文件，或使用模板另存为 .csv。");
  }

  const tempPath = path.join(os.tmpdir(), `site-import-${Date.now()}-${Math.random().toString(16).slice(2)}.xlsx`);
  fs.writeFileSync(tempPath, buffer);
  try {
    return rowsToObjects(parseExcelFile(tempPath));
  } finally {
    fs.rmSync(tempPath, { force: true });
  }
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requestedPath = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(publicDir, requestedPath));
  const relativePath = path.relative(publicDir, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    send(res, 403, "Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      send(res, 404, "Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    send(res, 200, content, mimeTypes[ext] || "application/octet-stream");
  });
}

function serveLocalAdmin(req, res, requestedPath) {
  const cleanPath = decodeURIComponent(requestedPath).replace(/^\/+/, "");
  const filePath = path.normalize(path.join(adminDir, cleanPath));
  const relativePath = path.relative(adminDir, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    send(res, 403, "Forbidden");
    return true;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      send(res, 404, "Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    send(res, 200, content, mimeTypes[ext] || "application/octet-stream");
  });
  return true;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/health" && req.method === "GET") {
    send(res, 200, JSON.stringify({ ok: true }), "application/json; charset=utf-8");
    return;
  }

  if (url.pathname === "/admin.html" && req.method === "GET") {
    serveLocalAdmin(req, res, "/admin.html");
    return;
  }

  if (url.pathname === "/admin.js" && req.method === "GET") {
    serveLocalAdmin(req, res, "/admin.js");
    return;
  }

  if (url.pathname.startsWith("/templates/") && req.method === "GET") {
    serveLocalAdmin(req, res, url.pathname);
    return;
  }

  if (url.pathname === "/api/site" && req.method === "GET") {
    fs.readFile(dataFile, "utf8", (error, content) => {
      if (error) {
        send(res, 500, JSON.stringify({ error: "Failed to read site data" }), "application/json; charset=utf-8");
        return;
      }
      send(res, 200, content.replace(/^\uFEFF/, ""), "application/json; charset=utf-8");
    });
    return;
  }

  if (url.pathname === "/api/site" && req.method === "POST") {
    try {
      const body = await readBody(req);
      const data = JSON.parse(body);
      saveSiteData(data);
      send(res, 200, JSON.stringify({ ok: true }), "application/json; charset=utf-8");
    } catch (error) {
      send(res, 400, JSON.stringify({ error: error.message || "Failed to save site data" }), "application/json; charset=utf-8");
    }
    return;
  }

  if (url.pathname === "/api/upload" && req.method === "POST") {
    try {
      const body = await readBody(req);
      const payload = JSON.parse(body);
      const uploadedUrl = saveUploadedImage(payload.filename, payload.dataUrl);
      send(res, 200, JSON.stringify({ ok: true, url: uploadedUrl }), "application/json; charset=utf-8");
    } catch (error) {
      send(res, 400, JSON.stringify({ error: error.message || "Failed to upload image" }), "application/json; charset=utf-8");
    }
    return;
  }

  if (url.pathname === "/api/import-excel" && req.method === "POST") {
    try {
      const body = await readBody(req, 12 * 1024 * 1024);
      const payload = JSON.parse(body);
      const rows = importRowsFromUpload(payload);
      if (!rows.length) throw new Error("Excel 里没有可导入的内容行。");
      const result = applyImportRows(readCurrentData(), rows);
      saveSiteData(result.data);
      send(res, 200, JSON.stringify({ ok: true, rows: rows.length, summary: result.summary, warnings: result.warnings }), "application/json; charset=utf-8");
    } catch (error) {
      send(res, 400, JSON.stringify({ error: error.message || "Excel 导入失败" }), "application/json; charset=utf-8");
    }
    return;
  }

  serveStatic(req, res);
});

server.listen(port, () => {
  console.log(`Site running: http://localhost:${port}`);
  console.log(`Admin: http://localhost:${port}/admin.html`);
});
