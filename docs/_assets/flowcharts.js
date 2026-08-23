/* ponytail: shared Mermaid viewer — CDN only, no build step */
document.addEventListener("DOMContentLoaded", async () => {
  const navLinks = document.querySelectorAll(".nav a[data-target]");
  const sections = document.querySelectorAll(".chart-card[id]");

  function setActive(id) {
    navLinks.forEach((link) => {
      link.classList.toggle("active", link.dataset.target === id);
    });
  }

  navLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const target = document.getElementById(link.dataset.target);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        setActive(link.dataset.target);
      }
    });
  });

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      if (visible[0]?.target?.id) setActive(visible[0].target.id);
    },
    { rootMargin: "-20% 0px -55% 0px", threshold: [0.1, 0.4, 0.7] }
  );

  sections.forEach((section) => observer.observe(section));

  if (typeof mermaid === "undefined") return;

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: "base",
    flowchart: { htmlLabels: true, curve: "basis" },
    themeVariables: {
      primaryColor: "#e8ecf8",
      primaryTextColor: "#020a31",
      primaryBorderColor: "#052699",
      secondaryColor: "#f4f6fb",
      tertiaryColor: "#fff",
      lineColor: "#052699",
      textColor: "#020a31",
      fontFamily: "system-ui, sans-serif",
    },
  });

  await mermaid.run({ querySelector: ".mermaid" });
});
