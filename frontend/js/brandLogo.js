/** Logo load fallback — show typographic KARNEX if image fails. */
export function initBrandLogoFallback(root = document) {
  root.querySelectorAll(".kx-brand-logo-wrap").forEach((wrap) => {
    const img = wrap.querySelector(".kx-brand-logo");
    if (!img || wrap.dataset.kxBrandBound === "1") return;
    wrap.dataset.kxBrandBound = "1";
    const markFailed = () => wrap.classList.add("is-fallback");
    img.addEventListener("error", markFailed);
    if (img.complete && img.naturalWidth === 0) markFailed();
  });
}
