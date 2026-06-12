const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const publicDir = path.join(root, "public");
const uploadsDir = path.join(publicDir, "uploads");
const dataFile = path.join(root, "data", "site-data.json");
const backupFile = path.join(root, "data", "site-data.backup.json");
const port = process.env.PORT || 3000;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml; charset=utf-8"
};

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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

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
      if (!data || typeof data !== "object" || !data.home || !Array.isArray(data.works) || !Array.isArray(data.articles)) {
        throw new Error("Invalid site data shape");
      }
      if (fs.existsSync(dataFile)) {
        fs.copyFileSync(dataFile, backupFile);
      }
      fs.writeFileSync(dataFile, `${JSON.stringify(data, null, 2)}\n`, "utf8");
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

  serveStatic(req, res);
});

server.listen(port, () => {
  console.log(`Site running: http://localhost:${port}`);
  console.log(`Admin: http://localhost:${port}/admin.html`);
});
