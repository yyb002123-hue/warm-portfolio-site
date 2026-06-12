const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const source = path.join(root, "data", "site-data.json");
const targetDir = path.join(root, "public", "data");
const target = path.join(targetDir, "site-data.json");

const content = fs.readFileSync(source, "utf8").replace(/^\uFEFF/, "");
JSON.parse(content);

fs.mkdirSync(targetDir, { recursive: true });
fs.writeFileSync(target, `${content.trim()}\n`, "utf8");

console.log("Synced data/site-data.json -> public/data/site-data.json");
