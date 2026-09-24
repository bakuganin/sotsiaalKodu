import { readFile, writeFile, mkdir } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const metadata = JSON.parse(
  await readFile(new URL("src/content/page-meta.json", root), "utf8"),
);
const template = await readFile(new URL("dist/index.html", root), "utf8");
const escapeHtml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

// Real directory entry points allow direct links and reloads on static hosting.
const pages = Object.keys(metadata).filter((page) => page !== "home");
for (const page of pages) {
  const folder = new URL(`dist/${page}/`, root);
  await mkdir(folder, { recursive: true });
  const html = template
    .replace(
      /<title>.*?<\/title>/s,
      `<title>${escapeHtml(metadata[page].title)}</title>`,
    )
    .replace(
      /(<meta\s+name="description"\s+content=")[^"]*("\s*\/?>)/s,
      `$1${escapeHtml(metadata[page].description)}$2`,
    );
  await writeFile(new URL("index.html", folder), html);
}
console.log(
  `Created ${pages.map((page) => `/${page}/`).join(", ")} entry pages with individual metadata.`,
);
