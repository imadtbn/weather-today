import { createPlaceIllustration, wilayaScene } from "./place-illustration.js";

const grid = document.querySelector("#marine-city-grid");
const count = document.querySelector("#marine-directory-count");
const status = document.querySelector(".marine-directory-status");

const makeCard = city => {
  const link = document.createElement("a");
  link.className = "directory-card directory-card--unified";
  link.href = "../weather/" + encodeURIComponent(city.slug) + "/";
  link.setAttribute("aria-label", "عرض النشرة البحرية والطقس في " + city.name);

  const media = document.createElement("span");
  media.className = "directory-card__media";
  const fallback = () => {
    media.classList.add("is-photo-missing");
    media.replaceChildren(createPlaceIllustration(wilayaScene(city.region, true), city.name, "ساحل الجزائر"));
  };
  const photo = document.createElement("img");
  photo.className = "directory-card__photo";
  photo.src = city.countryImages;
  photo.alt = "صورة ساحل " + city.name + " في الجزائر";
  photo.loading = "lazy";
  photo.decoding = "async";
  photo.addEventListener("error", fallback, { once: true });
  media.append(photo);

  const body = document.createElement("span");
  body.className = "directory-card__body";
  const meta = document.createElement("span");
  meta.className = "directory-card__meta";
  meta.textContent = "ولاية " + city.code + " · " + city.region;

  const title = document.createElement("strong");
  title.className = "directory-card__title";
  title.textContent = "ساحل " + city.name;

  const phone = document.createElement("span");
  phone.className = "directory-card__phone marine-phone-code";
  phone.dir = "rtl";
  phone.textContent = "دليل الهاتف: " + (city.phone_code || "غير متاح");

  const action = document.createElement("span");
  action.className = "directory-card__action";
  action.textContent = "عرض النشرة البحرية";

  body.append(meta, title, phone, action);
  link.append(media, body);
  return link;
};

async function renderCoastalCities() {
  if (!grid) return;
  try {
    const response = await fetch(new URL("../../data/cities.json", import.meta.url), { cache: "no-cache" });
    if (!response.ok) throw new Error("تعذر تحميل بيانات الولايات");
    const cities = await response.json();
    const coastal = Array.isArray(cities) ? cities.filter(city => city.coastal === true) : [];
    grid.replaceChildren(...coastal.map(makeCard));
    if (count) count.textContent = coastal.length + " ولاية ساحلية جزائرية";
    if (!coastal.length) {
      const message = document.createElement("p");
      message.className = "marine-directory-status";
      message.textContent = "لا تتوفر بيانات الولايات الساحلية حاليًا.";
      grid.replaceChildren(message);
    }
  } catch (error) {
    console.error("Marine directory:", error);
    if (status) status.textContent = "تعذر تحميل قائمة الولايات الساحلية. يرجى تحديث الصفحة.";
  }
}

renderCoastalCities();
