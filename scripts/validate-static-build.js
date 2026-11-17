#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "..");
const readJson = relative => JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8"));
const fail = message => { console.error("BUILD VALIDATION FAILED:", message); process.exitCode = 1; };
const cities = readJson("data/cities.json");
const world = readJson("data/world-capitals.json");
const arab = readJson("data/arab-capitals.json");
const sitemap = fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8");
const manifest = readJson("precache-manifest.json");
const expectedRoutes = 12 + cities.length + world.length;

if (cities.length !== 69 || new Set(cities.map(city => city.slug)).size !== 69) fail("Expected 69 unique wilaya records.");
if (arab.length !== 22 || new Set(arab.map(city => city.slug)).size !== 22) fail("Expected 22 unique Arab-capital records.");
if (world.length !== 195 || new Set(world.map(city => city.slug)).size !== 195) fail("Expected 195 unique world-capital records.");
for (const city of arab) if (!world.some(item => item.slug === city.slug)) fail("Arab capital missing from world-capitals data: " + city.slug);

const pageSets = [
  ...cities.map(city => ({ route: "weather/" + city.slug + "/index.html", label: "wilaya " + city.slug })),
  ...world.map(city => ({ route: "world-capitals/" + city.slug + "/index.html", label: "capital " + city.slug }))
];
function readJsonLd(html, label) {
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
  if (!match) { fail("Missing JSON-LD script: " + label); return null; }
  try { return JSON.parse(match[1]); }
  catch (error) { fail("Invalid JSON-LD in " + label + ": " + error.message); return null; }
}
function validateSchema(html, label, requirePlace = false) {
  const schema = readJsonLd(html, label);
  if (!schema) return;
  if (schema["@context"] !== "https://schema.org" || !Array.isArray(schema["@graph"])) {
    fail("Expected Schema.org @graph in " + label); return;
  }
  const types = schema["@graph"].map(node => node["@type"]);
  if (!types.includes("Organization") || !types.includes("WebSite") || (!types.includes("WebPage") && !types.includes("CollectionPage"))) {
    fail("Missing Organization, WebSite or WebPage entity in " + label);
  }
  if (!types.includes("BreadcrumbList")) fail("Missing BreadcrumbList in " + label);
  if (requirePlace && !types.includes("Place")) fail("Missing Place entity in " + label);
  const page = schema["@graph"].find(node => node["@type"] === "WebPage" || node["@type"] === "CollectionPage");
  if (!page || !Array.isArray(page.keywords) || !page.keywords.some(word => /weather/i.test(word)) ||
      !page.keywords.some(word => /météo/i.test(word)) || !page.keywords.some(word => /الطقس/.test(word))) {
    fail("Missing multilingual relevant keywords in " + label);
  }
}
const homeHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
validateSchema(homeHtml, "index.html", false);
const canonicals = new Set();
const titles = new Set();
for (const page of pageSets) {
  const absolute = path.join(ROOT, page.route);
  if (!fs.existsSync(absolute)) { fail("Missing generated page: " + page.route); continue; }
  const html = fs.readFileSync(absolute, "utf8");
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/i)?.[1];
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1];
  if (!canonical || !canonical.endsWith("/")) fail("Missing or malformed canonical URL: " + page.route);
  if (canonical && canonicals.has(canonical)) fail("Duplicate canonical URL: " + canonical);
  if (canonical) canonicals.add(canonical);
  if (!title || !title.trim()) fail("Missing title: " + page.route);
  if (title && titles.has(title)) fail("Duplicate title: " + title);
  if (title) titles.add(title);
  if (!/<meta name="description" content="[^"]+"/i.test(html)) fail("Missing description: " + page.route);
  validateSchema(html, page.route, true);
  if (!/name="robots" content="index,follow/i.test(html)) fail("Page is not explicitly indexable: " + page.route);
  if ((html.match(/<a\b/gi) || []).length !== (html.match(/<\/a>/gi) || []).length) fail("Unbalanced anchor markup: " + page.route);
  if ((html.match(/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js/gi) || []).length !== 1) fail("AdSense loader must appear exactly once: " + page.route);
  if (!html.includes('data-ad-slot="7867079394"') || !html.includes('data-ad-slot="3143411927"')) fail("Expected AdSense placements missing: " + page.route);
  if (!html.includes("assets/js/pages.js") || !html.includes("assets/js/site.js")) fail("Shared page runtime missing: " + page.route);
}
for (const folder of ["wilayas", "arab-capitals", "world-capitals", "world-search", "favorites", "alerts"]) {
  const file = path.join(ROOT, folder, "index.html");
  if (!fs.existsSync(file)) { fail("Missing directory page: " + folder); continue; }
  validateSchema(fs.readFileSync(file, "utf8"), folder + "/index.html", false);
}
const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
if (locations.length !== expectedRoutes) fail("Sitemap URL count mismatch: expected " + expectedRoutes + ", found " + locations.length);
for (const page of pageSets) {
  const expected = "https://imadtbn.github.io/weather-today/" + page.route.replace(/index\.html$/, "");
  if (!locations.includes(expected)) fail("Sitemap missing " + expected);
}
const precache = new Set(manifest.assets);
for (const page of pageSets) {
  const asset = "./" + page.route;
  if (!precache.has(asset)) fail("PWA precache missing generated page: " + asset);
}
const directory = fs.readFileSync(path.join(ROOT, "assets/js/directory-parity.js"), "utf8");
if (!directory.includes('"../world-capitals/"+encodeURIComponent(city.slug)+"/"') ||
    !directory.includes('"../world-capitals/" + encodeURIComponent(city.slug) + "/"')) {
  fail("Capital directory cards do not consistently link to standalone capital pages.");
}
console.log("Validated " + cities.length + " wilaya pages, " + world.length +
  " world-capital pages, " + locations.length + " sitemap URLs and " +
  manifest.assets.length + " precache assets.");
