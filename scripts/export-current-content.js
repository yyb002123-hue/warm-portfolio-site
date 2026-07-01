const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const source = path.join(root, "data", "site-data.json");
const targetDir = path.join(root, "admin", "templates");
const target = path.join(targetDir, "site-current-content.csv");

const headers = ["type", "target", "field", "order", "title", "label", "text", "image", "href"];

function csvCell(value) {
  const text = String(value || "");
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function row(values) {
  return headers.map((name) => csvCell(values[name])).join(",");
}

const data = JSON.parse(fs.readFileSync(source, "utf8").replace(/^\uFEFF/, ""));
const rows = [headers.join(",")];

Object.entries(data.home || {}).forEach(([field, value]) => {
  rows.push(row({ type: "home", field, text: field.toLowerCase().includes("image") ? "" : value, image: field.toLowerCase().includes("image") ? value : "" }));
});

(data.sidebarLinks || []).forEach((item, index) => {
  rows.push(row({ type: "sidebar", order: index + 1, title: item.title, href: item.href }));
});

(data.months || []).forEach((month) => {
  ["month", "title", "intro", "heroImage", "galleryTitle", "reviewTitle", "lifeTitle", "diaryTitle"].forEach((field) => {
    if (month[field]) {
      rows.push(row({
        type: "month",
        target: month.id,
        field,
        text: field.toLowerCase().includes("image") ? "" : month[field],
        image: field.toLowerCase().includes("image") ? month[field] : ""
      }));
    }
  });

  (month.lifeCards || []).forEach((item, index) => {
    rows.push(row({ type: "lifeCard", target: month.id, order: index + 1, title: item.title, label: item.label, text: item.summary, image: item.cover }));
  });

  (month.gallery || []).forEach((image, index) => {
    rows.push(row({ type: "gallery", target: month.id, order: index + 1, image }));
  });

  (month.diary || []).forEach((image, index) => {
    rows.push(row({ type: "diary", target: month.id, order: index + 1, image }));
  });

  (month.features || []).forEach((item, index) => {
    rows.push(row({ type: "feature", target: month.id, order: index + 1, title: item.title, text: item.summary, image: item.cover }));
  });
});

fs.mkdirSync(targetDir, { recursive: true });
fs.writeFileSync(target, `\uFEFF${rows.join("\n")}\n`, "utf8");

console.log(`Exported current content -> ${path.relative(root, target)}`);
