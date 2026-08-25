(() => {
  "use strict";

  const CATEGORIES = [
    "POSTER",
    "INFOGRAFIS",
    "BANNER",
    "LOGO",
    "PAMFLET",
    "FEEDS",
    "LAINNYA"
  ];

  const CATEGORY_LABELS = {
    POSTER: "Poster",
    INFOGRAFIS: "Infografis",
    BANNER: "Banner",
    LOGO: "Logo",
    PAMFLET: "Pamflet",
    FEEDS: "Feeds",
    LAINNYA: "Visual Content"
  };

  const config = window.PORTFOLIO_CONFIG || {};

  const hasConfig =
    typeof config.supabaseUrl === "string" &&
    /^https:\/\//.test(config.supabaseUrl) &&
    !config.supabaseUrl.includes("PASTE_") &&
    typeof config.supabaseAnonKey === "string" &&
    config.supabaseAnonKey.length > 20 &&
    !config.supabaseAnonKey.includes("PASTE_");

  const elements = {
    tabs: Array.from(
      document.querySelectorAll(".category-tab")
    ),

    grid: document.getElementById("portfolioGrid"),
    loading: document.getElementById("loadingBox"),
    empty: document.getElementById("emptyBox"),

    heading: document.getElementById("portfolioHeading"),
    subtitle: document.getElementById("portfolioSubtitle"),
    count: document.getElementById("portfolioCount"),
    categoryPath: document.getElementById("activeCategoryPath"),

    modal: document.getElementById("detailModal"),
    modalClose: document.getElementById("modalClose"),
    modalImage: document.getElementById("modalImage"),
    modalCategory: document.getElementById("modalCategory"),
    modalTitle: document.getElementById("modalTitle"),
    modalCaption: document.getElementById("modalCaption"),

    year: document.getElementById("currentYear"),
    clock: document.getElementById("liveClock")
  };

  let supabaseClient = null;
  let catalog = [];
  let activeCategory = "POSTER";

  function escapeHtml(value) {
    const div = document.createElement("div");

    div.textContent = String(value ?? "");

    return div.innerHTML;
  }

  function safeCategory(value) {
    const normalized = String(value || "")
      .trim()
      .toUpperCase();

    return CATEGORIES.includes(normalized)
      ? normalized
      : "LAINNYA";
  }

  function normalizeItem(item) {
    if (
      !item ||
      typeof item !== "object"
    ) {
      return null;
    }

    const title = String(
      item.title || "Untitled"
    )
      .trim()
      .slice(0, 120);

    const path = String(
      item.path || ""
    ).replace(/^\/+/, "");

    if (!path) {
      return null;
    }

    return {
      id: String(item.id || path),

      title,

      category: safeCategory(
        item.category
      ),

      caption: String(
        item.caption ||
          `Design ${title} `
      )
        .trim()
        .slice(0, 350),

      alt: String(
        item.alt ||
          `Karya desain ${title} oleh Berline`
      )
        .trim()
        .slice(0, 180),

      path,

      createdAt: String(
        item.createdAt || ""
      )
    };
  }

  function publicImageUrl(path) {
    if (!supabaseClient) {
      return "";
    }

    const result =
      supabaseClient.storage
        .from(
          config.portfolioBucket ||
            "portfolio"
        )
        .getPublicUrl(path);

    return result?.data?.publicUrl || "";
  }

  async function loadCatalog() {
    /*
     * Tampilkan kotak loading.
     */
    elements.loading.hidden = false;

    elements.loading.style.setProperty(
      "display",
      "block",
      "important"
    );

    elements.empty.hidden = true;
    elements.grid.replaceChildren();

    /*
     * Berhenti jika konfigurasi Supabase belum benar.
     */
    if (
      !hasConfig ||
      !window.supabase?.createClient
    ) {
      console.error(
        "Konfigurasi Supabase belum tersedia."
      );

      catalog = [];

      elements.loading.hidden = true;

      elements.loading.style.setProperty(
        "display",
        "none",
        "important"
      );

      renderPortfolio();
      return;
    }

    try {
      /*
       * Buat koneksi Supabase satu kali saja.
       */
      if (!supabaseClient) {
        supabaseClient =
          window.supabase.createClient(
            config.supabaseUrl,
            config.supabaseAnonKey,
            {
              auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false
              }
            }
          );
      }

      const bucket =
        config.portfolioBucket ||
        "portfolio";

      const catalogFile =
        config.catalogPath ||
        "catalog.json";

      /*
       * Download catalog.json langsung melalui Supabase.
       */
      const downloadPromise =
        supabaseClient.storage
          .from(bucket)
          .download(catalogFile);

      /*
       * Mencegah tulisan loading muncul selamanya.
       */
      const timeoutPromise =
        new Promise((_, reject) => {
          window.setTimeout(() => {
            reject(
              new Error(
                "Waktu memuat katalog habis."
              )
            );
          }, 15000);
        });

      const result =
        await Promise.race([
          downloadPromise,
          timeoutPromise
        ]);

      const { data, error } = result;

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error(
          "Isi catalog.json tidak ditemukan."
        );
      }

      const text = await data.text();
      const raw = JSON.parse(text);

      catalog = (
        Array.isArray(raw)
          ? raw
          : []
      )
        .map(normalizeItem)
        .filter(Boolean)
        .sort((a, b) =>
          String(
            b.createdAt
          ).localeCompare(
            String(a.createdAt)
          )
        );
    } catch (error) {
      console.error(
        "Galeri gagal dimuat:",
        error
      );

      catalog = [];
    } finally {
      /*
       * Loading wajib disembunyikan,
       * baik prosesnya berhasil maupun gagal.
       */
      elements.loading.hidden = true;

      elements.loading.style.setProperty(
        "display",
        "none",
        "important"
      );

      renderPortfolio();
    }
  }

  function renderPortfolio() {
    const items = catalog.filter(
      (item) =>
        item.category === activeCategory
    );

    const readable =
      CATEGORY_LABELS[activeCategory] ||
      activeCategory;

    elements.heading.innerHTML =
      `${escapeHtml(activeCategory)} ` +
      `<span>✦</span>`;

    /*
     * Elemen subtitle tidak selalu tersedia
     * pada setiap versi HTML.
     */
    if (elements.subtitle) {
      elements.subtitle.textContent =
        `Kumpulan karya desain Ku — ` +
        `${readable} (｡•̀ᴗ-)✧`;
    }

    elements.categoryPath.textContent =
      activeCategory.toLowerCase();

    elements.count.textContent =
      String(items.length);

    elements.grid.replaceChildren();

    elements.empty.hidden =
      items.length !== 0;

    items.forEach((item) => {
      const imageUrl =
        publicImageUrl(item.path);

      const article =
        document.createElement("article");

      article.className =
        "portfolio-card";

      article.innerHTML = `
        <div class="art-frame">
          <img
            src="${escapeHtml(imageUrl)}"
            alt="${escapeHtml(item.alt)}"
            loading="lazy"
            decoding="async"
          />
        </div>

        <div class="art-details">
          <div>
            <span class="art-category">
              ${escapeHtml(item.category)}
            </span>

            <h3>
              ${escapeHtml(item.title)}
            </h3>

            <p>
              ${escapeHtml(item.caption)}
            </p>
          </div>

          <button
            class="detail-button"
            type="button"
          >
            LIHAT DETAIL
          </button>
        </div>
      `;

      const image =
        article.querySelector("img");

      image.addEventListener(
        "error",
        () => {
          image.alt =
            `Gambar ${item.title} belum dapat dimuat`;

          image.style.minHeight =
            "220px";

          image.style.background =
            "linear-gradient(135deg, #ffe7f2, #e4f5ff)";
        }
      );

      const detailButton =
        article.querySelector(
          ".detail-button"
        );

      detailButton.addEventListener(
        "click",
        () => {
          openModal(
            item,
            imageUrl
          );
        }
      );

      elements.grid.appendChild(article);
    });
  }

  function selectCategory(
    category,
    shouldScroll = false
  ) {
    activeCategory =
      safeCategory(category);

    elements.tabs.forEach((tab) => {
      const isSelected =
        tab.dataset.category ===
        activeCategory;

      tab.classList.toggle(
        "is-active",
        isSelected
      );

      tab.setAttribute(
        "aria-selected",
        String(isSelected)
      );

      tab.tabIndex =
        isSelected ? 0 : -1;
    });

    renderPortfolio();

    if (shouldScroll) {
      document
        .getElementById("karya")
        ?.scrollIntoView({
          behavior: "smooth"
        });
    }
  }

  function openModal(
    item,
    imageUrl
  ) {
    elements.modalImage.src =
      imageUrl;

    elements.modalImage.alt =
      item.alt;

    elements.modalCategory.textContent =
      item.category;

    elements.modalTitle.textContent =
      item.title;

    elements.modalCaption.textContent =
      item.caption;

    if (
      typeof elements.modal.showModal ===
      "function"
    ) {
      elements.modal.showModal();
    } else {
      elements.modal.setAttribute(
        "open",
        ""
      );
    }
  }

  function closeModal() {
    if (
      typeof elements.modal.close ===
      "function"
    ) {
      elements.modal.close();
    } else {
      elements.modal.removeAttribute(
        "open"
      );
    }
  }

  function setupTabs() {
    elements.tabs.forEach(
      (tab, index) => {
        tab.addEventListener(
          "click",
          () => {
            selectCategory(
              tab.dataset.category,
              true
            );
          }
        );

        tab.addEventListener(
          "keydown",
          (event) => {
            const allowedKeys = [
              "ArrowLeft",
              "ArrowRight",
              "Home",
              "End"
            ];

            if (
              !allowedKeys.includes(
                event.key
              )
            ) {
              return;
            }

            event.preventDefault();

            let nextIndex = index;

            if (
              event.key === "ArrowLeft"
            ) {
              nextIndex =
                (
                  index -
                  1 +
                  elements.tabs.length
                ) %
                elements.tabs.length;
            }

            if (
              event.key === "ArrowRight"
            ) {
              nextIndex =
                (
                  index +
                  1
                ) %
                elements.tabs.length;
            }

            if (event.key === "Home") {
              nextIndex = 0;
            }

            if (event.key === "End") {
              nextIndex =
                elements.tabs.length - 1;
            }

            elements.tabs[
              nextIndex
            ].focus();

            selectCategory(
              elements.tabs[
                nextIndex
              ].dataset.category,
              false
            );
          }
        );
      }
    );
  }

  function setupModal() {
    elements.modalClose.addEventListener(
      "click",
      closeModal
    );

    elements.modal.addEventListener(
      "click",
      (event) => {
        if (
          event.target ===
          elements.modal
        ) {
          closeModal();
        }
      }
    );
  }

  function setupContacts() {
    const contacts =
      config.contacts || {};

    const contactLinks =
      document.querySelectorAll(
        "[data-contact]"
      );

    contactLinks.forEach((link) => {
      const type =
        link.dataset.contact;

      const raw = String(
        contacts[type] || ""
      ).trim();

      if (!raw) {
        link.addEventListener(
          "click",
          (event) => {
            event.preventDefault();
          }
        );

        link.setAttribute(
          "aria-disabled",
          "true"
        );

        link.title =
          "Kontak akan ditambahkan Berline";

        return;
      }

      if (type === "email") {
        link.href =
          raw.startsWith("mailto:")
            ? raw
            : `mailto:${raw}`;
      } else if (
        type === "whatsapp"
      ) {
        const number =
          raw.replace(/\D/g, "");

        link.href =
          raw.startsWith("http")
            ? raw
            : `https://wa.me/${number}`;

        link.target = "_blank";
        link.rel =
          "noopener noreferrer";
      } else {
        link.href =
          raw.startsWith("http")
            ? raw
            : `https://instagram.com/${raw.replace(
                /^@/,
                ""
              )}`;

        link.target = "_blank";
        link.rel =
          "noopener noreferrer";
      }
    });
  }

  function setupNavigationObserver() {
    const links = Array.from(
      document.querySelectorAll(
        ".nav-link"
      )
    );

    const sections = [
      "home",
      "karya",
      "tentang",
      "contact"
    ]
      .map((id) =>
        document.getElementById(id)
      )
      .filter(Boolean);

    if (
      !(
        "IntersectionObserver" in
        window
      )
    ) {
      return;
    }

    const observer =
      new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter(
              (entry) =>
                entry.isIntersecting
            )
            .sort(
              (a, b) =>
                b.intersectionRatio -
                a.intersectionRatio
            )[0];

          if (!visible) {
            return;
          }

          links.forEach((link) => {
            link.classList.toggle(
              "is-active",
              link.getAttribute(
                "href"
              ) ===
                `#${visible.target.id}`
            );
          });
        },
        {
          rootMargin:
            "-25% 0px -62%",

          threshold: [
            0.05,
            0.25,
            0.5
          ]
        }
      );

    sections.forEach((section) => {
      observer.observe(section);
    });
  }

  function updateClock() {
    const now = new Date();

    elements.clock.textContent =
      `${now.toLocaleTimeString(
        "id-ID",
        {
          hour: "2-digit",
          minute: "2-digit"
        }
      )} · online`;
  }

  function init() {
    if (elements.year) {
      elements.year.textContent =
        String(
          new Date().getFullYear()
        );
    }

    updateClock();

    window.setInterval(
      updateClock,
      30000
    );

    setupTabs();
    setupModal();
    setupContacts();
    setupNavigationObserver();

    /*
     * Pilih kategori poster sebelum katalog dimuat.
     */
    selectCategory(
      "POSTER",
      false
    );

    /*
     * Ambil katalog dari Supabase.
     */
    loadCatalog();
  }

  init();
})();
