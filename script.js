const toggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".main-nav");
const year = document.querySelector("#year");
const form = document.querySelector(".booking-form");
const reviewForm = document.querySelector(".review-form");
const serviceSelect = document.querySelector('select[name="service"]');
const priceSearch = document.querySelector("#priceSearch");
const filterButtons = document.querySelectorAll(".filter-btn");
const priceCards = document.querySelectorAll(".price-card");
const priceCount = document.querySelector("#priceCount");
const priceGrid = document.querySelector(".price-grid");
const whatsappNumber = "14313368788";

function openWhatsApp(message) {
  window.location.href = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
}

year.textContent = new Date().getFullYear();

toggle.addEventListener("click", () => {
  const isOpen = nav.classList.toggle("is-open");
  toggle.setAttribute("aria-expanded", String(isOpen));
});

nav.addEventListener("click", (event) => {
  if (event.target.matches("a")) {
    nav.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
  }
});

document.querySelectorAll(".service-card").forEach((card) => {
  card.addEventListener("click", () => {
    const title = card.querySelector("h3").textContent;
    selectService(title);
    document.querySelector("#reservation").scrollIntoView({ behavior: "smooth" });
  });
});

function selectService(serviceName) {
  const existingOption = Array.from(serviceSelect.options).find(
    (item) => item.textContent === serviceName
  );

  if (existingOption) {
    serviceSelect.value = existingOption.textContent;
  } else {
    const option = new Option(serviceName, serviceName, true, true);
    serviceSelect.add(option);
  }
}

function updatePriceMenu() {
  const activeFilter = document.querySelector(".filter-btn.is-active")?.dataset.filter || "all";
  const query = priceSearch.value.trim().toLowerCase();
  let visibleCount = 0;

  priceCards.forEach((card) => {
    const service = card.dataset.service.toLowerCase();
    const category = card.dataset.category;
    const matchesFilter = activeFilter === "all" || category === activeFilter;
    const matchesSearch = !query || service.includes(query);
    const isVisible = matchesFilter && matchesSearch;

    card.classList.toggle("is-hidden", !isVisible);
    if (isVisible) {
      visibleCount += 1;
    }
  });

  priceCount.textContent = visibleCount;
  priceGrid.classList.toggle("has-no-results", visibleCount === 0);
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    filterButtons.forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");
    updatePriceMenu();
  });
});

priceSearch.addEventListener("input", updatePriceMenu);

priceCards.forEach((card) => {
  card.addEventListener("click", () => {
    selectService(card.dataset.service);
    document.querySelector("#reservation").scrollIntoView({ behavior: "smooth" });
  });
});

updatePriceMenu();

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const message = [
    "Hello DG Beauty, I would like to book an appointment.",
    "",
    `Name: ${data.get("name")}`,
    `Phone: ${data.get("phone")}`,
    `Preferred service: ${data.get("service")}`,
    "",
    "Message:",
    data.get("message") || "No message added.",
  ].join("\n");
  const note = form.querySelector(".form-note");
  note.textContent = "Thank you, your WhatsApp message is ready.";
  openWhatsApp(message);
  form.reset();
});

reviewForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(reviewForm);
  const message = [
    "Hello DG Beauty, I would like to leave a review.",
    "",
    `Rating: ${data.get("rating")} / 5`,
    `Name: ${data.get("reviewer")}`,
    `Service received: ${data.get("review_service") || "Not specified"}`,
    `Review title: ${data.get("review_title") || "No title"}`,
    `Recommendation: ${data.get("recommend")}`,
    `Email: ${data.get("review_email") || "Not provided"}`,
    "",
    "Review:",
    data.get("review_text"),
  ].join("\n");
  const note = reviewForm.querySelector(".review-note");
  note.textContent = "Thank you, your WhatsApp review message is ready.";
  openWhatsApp(message);
  reviewForm.reset();
});
