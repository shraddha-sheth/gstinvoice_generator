// Mobile nav toggle
const header = document.querySelector(".rz-header");
const toggle = document.querySelector(".rz-nav-toggle");

if (toggle && header) {
  toggle.addEventListener("click", () => {
    header.classList.toggle("rz-nav-open");
  });

  // Close nav when clicking a link (on small screens)
  header.addEventListener("click", (e) => {
    if (e.target.matches(".rz-nav a")) {
      header.classList.remove("rz-nav-open");
    }
  });
}

// Smooth scroll for in-page links
document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (e) => {
    const targetId = link.getAttribute("href");
    if (!targetId || targetId === "#") return;
    const target = document.querySelector(targetId);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
});

// Simple fake submit handler (no backend)
const form = document.getElementById("booking-form");
const note = document.getElementById("booking-note");

if (form && note) {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    note.textContent = "Thanks! Your request has been noted. We’ll confirm your slot shortly.";
    note.style.color = "#bbf7d0";
    form.reset();
  });
}

// Footer year
const yearEl = document.getElementById("year");
if (yearEl) {
  yearEl.textContent = new Date().getFullYear();
}

