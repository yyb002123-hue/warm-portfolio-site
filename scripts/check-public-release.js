const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");
const frontPages = [
  "index.html",
  "alumni-intro.html",
  "alumni-members.html",
  "awards.html"
];

const errors = [];
const maxImageBytes = 900 * 1024;

function exists(relativePath) {
  return fs.existsSync(path.join(publicDir, relativePath));
}

function readPublic(relativePath) {
  return fs.readFileSync(path.join(publicDir, relativePath), "utf8");
}

if (exists("admin.html")) errors.push("public/admin.html should not be published.");
if (exists("admin.js")) errors.push("public/admin.js should not be published.");
if (exists("templates")) errors.push("public/templates should not be published.");

frontPages.forEach((page) => {
  if (!exists(page)) {
    errors.push(`${page} is missing.`);
    return;
  }

  const html = readPublic(page);
  if (/admin\.html|admin-link/.test(html)) {
    errors.push(`${page} still exposes an admin entry.`);
  }
});

try {
  const data = JSON.parse(readPublic(path.join("data", "site-data.json")).replace(/^\uFEFF/, ""));
  if (!data.home || !Array.isArray(data.months)) {
    errors.push("public/data/site-data.json has an invalid shape.");
  }
} catch (error) {
  errors.push(`public/data/site-data.json is not valid JSON: ${error.message}`);
}

function walk(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      return;
    }

    if (/\.(png|jpe?g|webp|gif)$/i.test(entry.name)) {
      const size = fs.statSync(fullPath).size;
      if (size > maxImageBytes) {
        errors.push(`${path.relative(root, fullPath)} is ${(size / 1024 / 1024).toFixed(1)}MB; compress before publishing.`);
      }
    }
  });
}

walk(publicDir);

if (errors.length) {
  console.error("Public release check failed:");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log("Public release check passed.");
