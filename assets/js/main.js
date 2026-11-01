"use strict";

const modal = document.querySelector("#request-modal");
const requestForm = document.querySelector("#request-form");
const formStatus = document.querySelector("#form-status");
const menu = document.querySelector("#main-nav");
const menuToggle = document.querySelector(".menu-toggle");
const topButton = document.querySelector(".back-top");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let focusBeforeModal = null;
let activeRequest = null;
const requestButton = requestForm?.querySelector('button[type="submit"]');

function setRequestPending(pending) {
  if (!requestButton) return;
  requestButton.disabled = pending;
  requestButton.textContent = pending ? "Перевіряємо…" : "Перевірити заявку";
  requestForm.setAttribute("aria-busy", String(pending));
}

function closeModal() {
  if (!modal || modal.hidden) return;
  activeRequest?.abort();
  activeRequest = null;
  setRequestPending(false);
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
requestForm?.addEventListener("submit", async event => {
  event.preventDefault();
  if (activeRequest) return;
  if (!validateForm(requestForm)) {
    if (formStatus) formStatus.textContent = "Перевір заповнення полів. Дані не надсилалися.";
    return;
  }
  const controller = new AbortController();
  activeRequest = controller;
  setRequestPending(true);
  if (formStatus) formStatus.textContent = "Перевіряємо заявку…";
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(new URL("api/requests", document.baseURI), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(requestForm))),
      signal: controller.signal
    });
    const result = await response.json();
    // A closed or reopened dialog must not receive a late response.
    if (activeRequest !== controller) return;
    if (response.status === 422 && result.errors) {
      let firstInvalid = null;
      Object.entries(result.errors).forEach(([name, message]) => {
        const field = requestForm.elements.namedItem(name);
        if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) return;
        field.setCustomValidity(String(message));
        if (!firstInvalid) firstInvalid = field;
      });
      firstInvalid?.focus();
      firstInvalid?.reportValidity();
      if (formStatus) formStatus.textContent = "Перевір заповнення полів.";
    } else if (!response.ok || result.ok !== true) {
      throw new Error("Request was not accepted");
    } else if (formStatus) {
      formStatus.textContent = result.message;
    }
  } catch (error) {
    if (activeRequest === controller && formStatus) {
      formStatus.textContent = "Не вдалося перевірити заявку. Спробуй пізніше.";
    }
  } finally {
    clearTimeout(timeout);
    if (activeRequest === controller) {
      activeRequest = null;
      setRequestPending(false);
    }
  }
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
