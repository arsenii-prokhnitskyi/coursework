"use strict";

const modal = document.querySelector("#request-modal");
const requestForm = document.querySelector("#request-form");
const formStatus = document.querySelector("#form-status");
const menu = document.querySelector("#main-nav");
const menuToggle = document.querySelector(".menu-toggle");
const topButton = document.querySelector(".back-top");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let focusBeforeModal = null;

function closeModal() {
  if (!modal || modal.hidden) return;
  modal.hidden = true;
  document.body.classList.remove("modal-open");
  requestForm?.reset();
  requestForm?.querySelectorAll("input, textarea").forEach(field => field.setCustomValidity(""));
  if (formStatus) formStatus.textContent = "";
  focusBeforeModal?.focus();
}

function openModal(event) {
  if (!modal) return;
  focusBeforeModal = event?.currentTarget || document.activeElement;
  modal.hidden = false;
  document.body.classList.add("modal-open");
  modal.querySelector("input")?.focus();
}

document.querySelectorAll("[data-modal-open]").forEach(button => button.addEventListener("click", openModal));
document.querySelector("[data-modal-close]")?.addEventListener("click", closeModal);
modal?.addEventListener("click", event => {
  if (event.target === modal) closeModal();
});

// Keep keyboard navigation inside the open dialog and return focus on close.
modal?.addEventListener("keydown", event => {
  if (event.key !== "Tab") return;
  const fields = [...modal.querySelectorAll("button:not([disabled]), input:not([disabled]), textarea:not([disabled])")];
  if (!fields.length) return;
  event.preventDefault();
  const current = fields.indexOf(document.activeElement);
  const step = event.shiftKey ? -1 : 1;
  const next = current < 0 ? (event.shiftKey ? fields.length - 1 : 0) : (current + step + fields.length) % fields.length;
  fields[next].focus();
});

function validateField(field) {
  field.value = field.value.trim();
  field.setCustomValidity("");
  if (field.required && !field.value) {
    field.setCustomValidity("Заповни це поле. Самих пробілів недостатньо.");
  } else if (field.value && field.minLength > 0 && field.value.length < field.minLength) {
    field.setCustomValidity(`Введи щонайменше ${field.minLength} символів.`);
  } else if (field.maxLength > 0 && field.value.length > field.maxLength) {
    field.setCustomValidity(`Введи не більше ${field.maxLength} символів.`);
  } else if (field.validity.typeMismatch) {
    field.setCustomValidity("Введи коректну адресу електронної пошти.");
  }
  return field.validity.valid;
}

function validateForm(form) {
  const fields = [...form.querySelectorAll("input, textarea")];
  let firstInvalid = null;
  fields.forEach(field => {
    if (!validateField(field) && !firstInvalid) firstInvalid = field;
  });
  if (firstInvalid) {
    firstInvalid.focus();
    firstInvalid.reportValidity();
    return false;
  }
  return true;
}

document.querySelectorAll("input, textarea").forEach(field => {
  field.addEventListener("input", () => field.setCustomValidity(""));
});
requestForm?.addEventListener("submit", event => {
  event.preventDefault();
  if (!validateForm(requestForm)) {
    if (formStatus) formStatus.textContent = "Перевір заповнення полів. Дані не надсилалися.";
    return;
  }
  if (formStatus) formStatus.textContent = "Заявку перевірено. Це навчальна демонстрація: дані не надсилалися та не зберігалися.";
});

const subscribeForm = document.querySelector("#subscribe-form");
subscribeForm?.addEventListener("submit", event => {
  event.preventDefault();
  const status = document.querySelector("#subscribe-status");
  if (!validateForm(subscribeForm)) {
    if (status) status.textContent = "Вкажи коректну адресу. Підписку не оформлено.";
    return;
  }
  if (status) status.textContent = "Адресу перевірено. Демонстраційна форма: підписку не оформлено, листи не надсилаються.";
});

function closeMenu(returnFocus = false) {
  if (!menu?.classList.contains("open")) return;
  menu.classList.remove("open");
  menuToggle?.setAttribute("aria-expanded", "false");
  menuToggle?.setAttribute("aria-label", "Відкрити меню");
  if (returnFocus) menuToggle?.focus();
}
menuToggle?.addEventListener("click", () => {
  if (!menu) return;
  const open = menu.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(open));
  menuToggle.setAttribute("aria-label", open ? "Закрити меню" : "Відкрити меню");
});
menu?.querySelectorAll("a").forEach(link => link.addEventListener("click", () => closeMenu()));
document.addEventListener("click", event => {
  if (!event.target.closest(".site-header")) closeMenu();
});
document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;
  if (modal && !modal.hidden) closeModal();
  else closeMenu(true);
});
const mobileMenu = window.matchMedia("(max-width: 800px)");
mobileMenu.addEventListener("change", () => closeMenu(mobileMenu.matches && menu?.contains(document.activeElement)));

function syncTopButton() {
  if (topButton) topButton.hidden = window.scrollY < 370;
}
window.addEventListener("scroll", syncTopButton, { passive: true });
syncTopButton();
topButton?.addEventListener("click", () => window.scrollTo({ top: 0, behavior: reducedMotion.matches ? "auto" : "smooth" }));

const currentFile = location.pathname.split("/").pop() || "index.html";
const pageNames = { "index.html": "home", "blog.html": "blog", "services.html": "services" };
const currentPage = pageNames[currentFile];
if (currentPage) document.querySelector(`[data-page="${currentPage}"]`)?.setAttribute("aria-current", "page");

const privacyDialog = document.querySelector("#privacy-dialog");
document.querySelector("[data-privacy-open]")?.addEventListener("click", () => privacyDialog?.showModal());
privacyDialog?.addEventListener("click", event => {
  if (event.target !== privacyDialog) return;
  const bounds = privacyDialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) privacyDialog.close();
});

// Preserve the layout if a resource is absent; the fallback cannot recurse on error.
const imageFallback = new URL("../images/image-unavailable.svg", document.currentScript.src).href;
document.querySelectorAll("img").forEach(img => {
  function replaceMissingImage() {
    if (img.dataset.fallback) return;
    img.dataset.fallback = "true";
    img.classList.add("is-unavailable");
    img.alt = `Зображення недоступне: ${img.alt}`;
    img.removeAttribute("srcset");
    img.src = imageFallback;
  }
  img.addEventListener("error", replaceMissingImage);
  if (img.complete && img.naturalWidth === 0) replaceMissingImage();
});
