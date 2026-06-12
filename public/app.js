const state = {
  data: null
};

const fallbackImage = "/assets/hero.png";

function imageUrl(value) {
  const url = String(value || "").trim();
  return url || fallbackImage;
}

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = value || "";
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text || "";
  return element;
}

function createImage(src, alt, className = "") {
  const image = document.createElement("img");
  image.src = imageUrl(src);
  image.alt = alt || "";
  image.loading = "lazy";
  if (className) image.className = className;
  image.addEventListener("error", () => {
    image.src = fallbackImage;
  }, { once: true });
  return image;
}

function renderHome(home) {
  document.title = home.siteTitle || "作品集网站";
  setText("site-title", home.siteTitle);
  setText("site-subtitle", home.subtitle);
  setText("footer-note", home.footerNote);
}

function renderSidebarLinks(links) {
  const container = document.getElementById("sidebar-links");
  container.innerHTML = "";

  links.forEach((link) => {
    const anchor = createElement("a", "", link.title || "补充信息");
    anchor.href = link.href || "#month-5";
    container.appendChild(anchor);
  });
}

function renderMonthNav(months) {
  const nav = document.getElementById("month-nav");
  nav.innerHTML = "";

  months.forEach((month, index) => {
    const anchor = document.createElement("a");
    anchor.href = `#${month.id}`;
    anchor.className = index === 0 ? "active" : "";

    const monthLabel = createElement("strong", "", month.month || "");
    const titleLabel = createElement("span", "", month.title || "");
    anchor.append(monthLabel, titleLabel);
    nav.appendChild(anchor);
  });
}

function renderGallery(month) {
  const section = createElement("section", "month-block");
  const heading = createElement("div", "month-heading");
  heading.appendChild(createElement("h2", "", month.galleryTitle || "当月影展"));

  const grid = createElement("div", "monthly-gallery");
  const images = month.gallery && month.gallery.length ? month.gallery : [month.heroImage];
  images.forEach((src, index) => {
    grid.appendChild(createImage(src, `${month.month || ""}${month.title || ""}影像 ${index + 1}`, "gallery-image"));
  });

  section.append(heading, grid);
  return section;
}

function renderFeatureShowcase(month) {
  const section = createElement("section", "month-block");
  const heading = createElement("div", "month-heading");
  heading.appendChild(createElement("h2", "", month.reviewTitle || `${month.month || ""}${month.title || ""} · 精彩回顾`));

  const layout = createElement("div", "feature-layout");
  const featureImages = createElement("div", "feature-covers");
  const featureList = createElement("div", "feature-list");
  const features = month.features || [];

  features.forEach((feature, index) => {
    const coverCard = createElement("article", "feature-cover-card");
    coverCard.appendChild(createImage(feature.cover, feature.title || "回顾封面", "feature-cover-image"));
    const coverText = createElement("div", "feature-cover-text");
    coverText.append(
      createElement("span", "", "打卡爱生活的100件事之"),
      createElement("strong", "", feature.title || "未命名回顾")
    );
    coverCard.appendChild(coverText);
    featureImages.appendChild(coverCard);

    const item = createElement("article", "feature-item");
    const copy = createElement("div", "feature-copy");
    copy.append(
      createElement("span", "feature-index", `第${index + 1}期`),
      createElement("h3", "", feature.title || "未命名回顾"),
      createElement("p", "", feature.summary || "")
    );

    const thumbs = createElement("div", "feature-thumbs");
    const thumbSources = feature.thumbs && feature.thumbs.length ? feature.thumbs : [feature.cover, month.heroImage, ...(month.gallery || [])].slice(0, 4);
    thumbSources.slice(0, 4).forEach((src) => {
      thumbs.appendChild(createImage(src, feature.title || "缩略图", "thumb-image"));
    });

    item.append(copy, thumbs);
    featureList.appendChild(item);
  });

  layout.append(featureImages, featureList);
  section.append(heading, layout);
  return section;
}

function renderMonths(months) {
  const main = document.getElementById("month-content");
  main.innerHTML = "";

  months.forEach((month) => {
    const section = createElement("section", "month-section");
    section.id = month.id;

    const hero = createElement("div", "month-hero");
    hero.appendChild(createImage(month.heroImage, `${month.month || ""}${month.title || ""}`, "month-hero-image"));
    const heroCopy = createElement("div", "month-hero-copy");
    heroCopy.append(
      createElement("p", "eyebrow", "Monthly Archive"),
      createElement("h1", "", `${month.month || ""} · ${month.title || ""}`),
      createElement("p", "", month.intro || "")
    );
    hero.appendChild(heroCopy);

    section.append(hero, renderGallery(month), renderFeatureShowcase(month));
    main.appendChild(section);
  });
}

function bindMonthNav() {
  const links = [...document.querySelectorAll(".month-nav a")];
  const sections = links.map((link) => document.querySelector(link.getAttribute("href")));
  let activeLink = links.find((link) => link.classList.contains("active"));

  window.addEventListener("scroll", () => {
    const current = sections.findLast((section) => section && section.getBoundingClientRect().top < 220);
    links.forEach((link) => {
      link.classList.toggle("active", current && link.getAttribute("href") === `#${current.id}`);
    });

    const nextActiveLink = links.find((link) => link.classList.contains("active"));
    if (nextActiveLink && nextActiveLink !== activeLink) {
      activeLink = nextActiveLink;
      nextActiveLink.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, { passive: true });
}

async function loadSite() {
  let response = await fetch("/api/site");
  if (!response.ok) {
    response = await fetch("/data/site-data.json");
  }
  if (!response.ok) throw new Error("Failed to load site data");
  state.data = await response.json();
  const months = state.data.months || [];

  renderHome(state.data.home || {});
  renderSidebarLinks(state.data.sidebarLinks || []);
  renderMonthNav(months);
  renderMonths(months);
  bindMonthNav();
}

document.querySelector(".dialog-close").addEventListener("click", () => {
  document.getElementById("article-dialog").close();
});

loadSite().catch(() => {
  document.body.appendChild(createElement("p", "save-status", "内容加载失败，请确认本地服务器已经启动。"));
});
