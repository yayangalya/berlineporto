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

  const IMAGE_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp"
  ];

  const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
  const MAX_PDF_BYTES = 25 * 1024 * 1024;
  const WATERMARK_PATH = "assets/wm.png";

  let watermarkImagePromise = null;

  const config = window.PORTFOLIO_CONFIG || {};

  const hasConfig =
    typeof config.supabaseUrl === "string" &&
    /^https:\/\//.test(config.supabaseUrl) &&
    !config.supabaseUrl.includes("PASTE_") &&
    typeof config.supabaseAnonKey === "string" &&
    config.supabaseAnonKey.length > 20 &&
    !config.supabaseAnonKey.includes("PASTE_");

  const elements = {
    loginView: document.getElementById("loginView"),
    dashboard: document.getElementById("dashboardView"),
    loginForm: document.getElementById("loginForm"),
    loginEmail: document.getElementById("loginEmail"),
    loginPassword: document.getElementById("loginPassword"),
    loginMessage: document.getElementById("loginMessage"),

    logoutButton: document.getElementById("logoutButton"),
    adminIdentity: document.getElementById("adminIdentity"),

    artworkForm: document.getElementById("artworkForm"),
    artworkTitle: document.getElementById("artworkTitle"),
    artworkCategory: document.getElementById("artworkCategory"),
    artworkCaption: document.getElementById("artworkCaption"),
    artworkAlt: document.getElementById("artworkAlt"),
    artworkFile: document.getElementById("artworkFile"),
    artworkFileLabel: document.getElementById("artworkFileLabel"),
    artworkMessage: document.getElementById("artworkMessage"),
    uploadArtworkButton: document.getElementById(
      "uploadArtworkButton"
    ),

    pdfFile: document.getElementById("pdfFile"),
    pdfFileLabel: document.getElementById("pdfFileLabel"),
    pdfMessage: document.getElementById("pdfMessage"),
    uploadPdfButton: document.getElementById("uploadPdfButton"),
    downloadPdfButton: document.getElementById(
      "downloadPdfButton"
    ),

    refreshButton: document.getElementById("refreshButton"),
    adminLoading: document.getElementById("adminLoading"),
    adminGallery: document.getElementById("adminGallery"),
    adminEmpty: document.getElementById("adminEmpty")
  };

  let supabaseClient = null;
  let catalog = [];
  let currentSession = null;

  function setMessage(element, text, type = "") {
    if (!element) {
      return;
    }

    element.textContent = text;

    element.classList.toggle(
      "is-error",
      type === "error"
    );

    element.classList.toggle(
      "is-success",
      type === "success"
    );
  }

  function setButtonBusy(
    button,
    busy,
    busyText = "Memproses..."
  ) {
    if (!button) {
      return;
    }

    if (busy) {
      button.dataset.originalText = button.textContent;
      button.textContent = busyText;
    } else if (button.dataset.originalText) {
      button.textContent = button.dataset.originalText;
      delete button.dataset.originalText;
    }

    button.disabled = busy;
  }

  function loadImage(source) {
    return new Promise((resolve, reject) => {
      const image = new Image();

      image.onload = () => resolve(image);
      image.onerror = () => reject(
        new Error("Gambar atau watermark gagal dibaca.")
      );
      image.src = source;
    });
  }

  function getWatermarkImage() {
    if (!watermarkImagePromise) {
      watermarkImagePromise = loadImage(WATERMARK_PATH);
    }

    return watermarkImagePromise;
  }

  async function addWatermark(file) {
    const sourceUrl = URL.createObjectURL(file);

    try {
      const [sourceImage, watermarkImage] = await Promise.all([
        loadImage(sourceUrl),
        getWatermarkImage()
      ]);

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      canvas.width = sourceImage.naturalWidth;
      canvas.height = sourceImage.naturalHeight;

      if (!context || !canvas.width || !canvas.height) {
        throw new Error("Gambar tidak dapat diproses.");
      }

      context.drawImage(
        sourceImage,
        0,
        0,
        canvas.width,
        canvas.height
      );

      /*
       * Watermark berada di tengah dengan ukuran medium.
       * Ukurannya menyesuaikan gambar portrait maupun landscape.
       */
      const watermarkScale = Math.min(
        (canvas.width * 0.32) / watermarkImage.naturalWidth,
        (canvas.height * 0.32) / watermarkImage.naturalHeight
      );

      const watermarkWidth =
        watermarkImage.naturalWidth * watermarkScale;
      const watermarkHeight =
        watermarkImage.naturalHeight * watermarkScale;
      const watermarkX =
        (canvas.width - watermarkWidth) / 2;
      const watermarkY =
        (canvas.height - watermarkHeight) / 2;

      context.save();
      context.globalAlpha = 0.78;
      context.drawImage(
        watermarkImage,
        watermarkX,
        watermarkY,
        watermarkWidth,
        watermarkHeight
      );
      context.restore();

      const outputType = IMAGE_TYPES.includes(file.type)
        ? file.type
        : "image/jpeg";
      const quality = outputType === "image/png" ? undefined : 0.92;
      const blob = await new Promise((resolve) => {
        canvas.toBlob(resolve, outputType, quality);
      });

      if (!blob) {
        throw new Error("Watermark gagal dipasang.");
      }

      return new File(
        [blob],
        file.name,
        {
          type: outputType,
          lastModified: Date.now()
        }
      );
    } finally {
      URL.revokeObjectURL(sourceUrl);
    }
  }

  function escapeHtml(value) {
    const div = document.createElement("div");

    div.textContent = String(value ?? "");

    return div.innerHTML;
  }

  function slugify(value) {
    return (
      String(value || "artwork")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 70) || "artwork"
    );
  }

  function safeCategory(value) {
    const category = String(value || "").toUpperCase();

    return CATEGORIES.includes(category)
      ? category
      : "LAINNYA";
  }

  function normalizeCatalog(raw) {
    if (!Array.isArray(raw)) {
      return [];
    }

    return raw
      .filter(
        (item) =>
          item &&
          typeof item === "object" &&
          item.path
      )
      .map((item) => ({
        id: String(item.id || item.path),

        title: String(
          item.title || "Untitled"
        ).slice(0, 120),

        category: safeCategory(item.category),

        caption: String(
          item.caption || ""
        ).slice(0, 350),

        alt: String(
          item.alt || ""
        ).slice(0, 180),

        path: String(item.path).replace(/^\/+/, ""),

        createdAt: String(item.createdAt || "")
      }))
      .sort((a, b) =>
        String(b.createdAt).localeCompare(
          String(a.createdAt)
        )
      );
  }

  function portfolioBucket() {
    return config.portfolioBucket || "portfolio";
  }

  function privateBucket() {
    return (
      config.privateBucket ||
      "portfolio-private"
    );
  }

  function catalogPath() {
    return config.catalogPath || "catalog.json";
  }

  function publicImageUrl(path) {
    const result = supabaseClient.storage
      .from(portfolioBucket())
      .getPublicUrl(path);

    return result?.data?.publicUrl || "";
  }

  async function readCatalog() {
    /*
     * Mengecek keberadaan catalog.json terlebih dahulu.
     * Cara ini mencegah error 400 ketika portfolio masih kosong.
     */
    const { data: rootFiles, error: listError } =
      await supabaseClient.storage
        .from(portfolioBucket())
        .list("", {
          limit: 100,
          search: catalogPath()
        });

    if (listError) {
      throw listError;
    }

    const catalogExists = rootFiles?.some(
      (file) => file.name === catalogPath()
    );

    if (!catalogExists) {
      return [];
    }

    const { data, error } =
      await supabaseClient.storage
        .from(portfolioBucket())
        .download(catalogPath());

    if (error) {
      throw error;
    }

    try {
      const text = await data.text();
      const parsed = JSON.parse(text);

      return normalizeCatalog(parsed);
    } catch {
      throw new Error(
        "catalog.json tidak dapat dibaca. Pastikan isinya berupa JSON yang valid."
      );
    }
  }

  async function writeCatalog(nextCatalog) {
    const payload = new Blob(
      [
        JSON.stringify(
          nextCatalog,
          null,
          2
        )
      ],
      {
        type: "application/json"
      }
    );

    const { error } =
      await supabaseClient.storage
        .from(portfolioBucket())
        .upload(
          catalogPath(),
          payload,
          {
            upsert: true,
            contentType: "application/json",
            cacheControl: "0"
          }
        );

    if (error) {
      throw error;
    }
  }

  async function loadCatalog() {
    elements.adminLoading.hidden = false;
    elements.adminLoading.textContent =
      "sedang membuka koleksi... ♡";

    elements.adminEmpty.hidden = true;
    elements.adminGallery.replaceChildren();

    try {
      catalog = await readCatalog();

      renderAdminGallery();
    } catch (error) {
      console.error(error);

      elements.adminLoading.hidden = false;
      elements.adminLoading.textContent =
        `Gagal memuat karya: ${
          error.message || "unknown error"
        }`;
    }
  }

  function renderAdminGallery() {
    elements.adminLoading.hidden = true;
    elements.adminGallery.replaceChildren();

    elements.adminEmpty.hidden =
      catalog.length !== 0;

    catalog.forEach((item) => {
      const card =
        document.createElement("article");

      card.className = "admin-art-card";

      card.innerHTML = `
        <img
          src="${escapeHtml(
            publicImageUrl(item.path)
          )}"
          alt="${escapeHtml(
            item.alt || item.title
          )}"
          loading="lazy"
        />

        <div class="admin-art-info">
          <span>
            ${escapeHtml(item.category)}
          </span>

          <h3>
            ${escapeHtml(item.title)}
          </h3>

          <p>
            ${escapeHtml(
              item.caption || "Tanpa caption"
            )}
          </p>

          <button
            class="danger-button"
            type="button"
          >
            Hapus karya
          </button>
        </div>
      `;

      const deleteButton =
        card.querySelector(".danger-button");

      deleteButton.addEventListener(
        "click",
        () => deleteArtwork(item)
      );

      elements.adminGallery.appendChild(card);
    });
  }

  function showAuthenticated(session) {
    currentSession = session;

    /*
     * Memaksa tampilan login benar-benar hilang.
     * Digunakan karena CSS .login-view memakai display:grid.
     */
    elements.loginView.hidden = true;

    elements.loginView.style.setProperty(
      "display",
      "none",
      "important"
    );

    elements.dashboard.hidden = false;

    elements.dashboard.style.setProperty(
      "display",
      "block",
      "important"
    );

    elements.adminIdentity.textContent =
      session?.user?.email
        ? `Login sebagai ${session.user.email}`
        : "Admin aktif";

    setMessage(elements.loginMessage, "");

    loadCatalog();
  }

  function showLoggedOut() {
    currentSession = null;
    catalog = [];

    elements.dashboard.hidden = true;

    elements.dashboard.style.setProperty(
      "display",
      "none",
      "important"
    );

    elements.loginView.hidden = false;

    elements.loginView.style.setProperty(
      "display",
      "grid",
      "important"
    );

    elements.loginPassword.value = "";
  }

  async function handleLogin(event) {
    event.preventDefault();

    setMessage(elements.loginMessage, "");

    const email =
      elements.loginEmail.value.trim();

    const password =
      elements.loginPassword.value;

    if (!email || !password) {
      setMessage(
        elements.loginMessage,
        "Isi email dan password terlebih dahulu yaa.",
        "error"
      );

      return;
    }

    const button =
      elements.loginForm.querySelector(
        "button[type='submit']"
      );

    setButtonBusy(
      button,
      true,
      "Sedang masuk..."
    );

    try {
      const { data, error } =
        await supabaseClient.auth
          .signInWithPassword({
            email,
            password
          });

      if (error) {
        throw error;
      }

      if (!data?.session) {
        throw new Error(
          "Login berhasil, tetapi sesi admin tidak terbentuk."
        );
      }

      showAuthenticated(data.session);

      setMessage(
        elements.loginMessage,
        ""
      );
    } catch (error) {
      console.error("Login gagal:", error);

      setMessage(
        elements.loginMessage,
        error.message ||
          "Login gagal. Periksa kembali email dan password.",
        "error"
      );
    } finally {
      setButtonBusy(button, false);
    }
  }

  async function handleLogout() {
    setButtonBusy(
      elements.logoutButton,
      true,
      "Keluar..."
    );

    const { error } =
      await supabaseClient.auth.signOut();

    setButtonBusy(
      elements.logoutButton,
      false
    );

    if (error) {
      window.alert(
        error.message ||
          "Gagal keluar dari akun."
      );

      return;
    }

    showLoggedOut();
  }

  async function uploadArtwork(event) {
    event.preventDefault();

    setMessage(
      elements.artworkMessage,
      ""
    );

    if (!currentSession) {
      setMessage(
        elements.artworkMessage,
        "Sesi admin sudah berakhir. Silakan login ulang.",
        "error"
      );

      showLoggedOut();

      return;
    }

    const title =
      elements.artworkTitle.value.trim();

    const category =
      safeCategory(
        elements.artworkCategory.value
      );

    const file =
      elements.artworkFile.files?.[0];

    const caption =
      elements.artworkCaption.value.trim() ||
      `Design ${title} :3.`;

    const alt =
      elements.artworkAlt.value.trim() ||
      `Karya desain ${title} oleh Berline`;

    if (!title || !file) {
      setMessage(
        elements.artworkMessage,
        "Judul dan gambar karya wajib diisi.",
        "error"
      );

      return;
    }

    if (!IMAGE_TYPES.includes(file.type)) {
      setMessage(
        elements.artworkMessage,
        "Gunakan file JPG, PNG, atau WEBP.",
        "error"
      );

      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setMessage(
        elements.artworkMessage,
        "Ukuran gambar maksimal 50 MB.",
        "error"
      );

      return;
    }

    setButtonBusy(
      elements.uploadArtworkButton,
      true,
      "Sedang upload..."
    );

    let uploadedPath = "";

    try {
      elements.uploadArtworkButton.textContent =
        "Memasang watermark...";

      const watermarkedFile =
        await addWatermark(file);

      elements.uploadArtworkButton.textContent =
        "Sedang upload...";

      const extension =
        (
          watermarkedFile.name.split(".").pop() ||
          "jpg"
        ).toLowerCase();

      const unique =
        crypto.randomUUID
          ? crypto.randomUUID().slice(0, 8)
          : Math.random()
              .toString(36)
              .slice(2, 10);

      uploadedPath =
        `${category.toLowerCase()}/` +
        `${Date.now()}-` +
        `${unique}-` +
        `${slugify(title)}.` +
        `${extension}`;

      const { error: uploadError } =
        await supabaseClient.storage
          .from(portfolioBucket())
          .upload(
            uploadedPath,
            watermarkedFile,
            {
              upsert: false,
              contentType: watermarkedFile.type,
              cacheControl: "3600"
            }
          );

      if (uploadError) {
        throw uploadError;
      }

      const item = {
        id: crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${unique}`,

        title,
        category,
        caption,
        alt,
        path: uploadedPath,
        createdAt: new Date().toISOString()
      };

      const nextCatalog = [
        item,
        ...catalog
      ];

      try {
        await writeCatalog(nextCatalog);
      } catch (catalogError) {
        await supabaseClient.storage
          .from(portfolioBucket())
          .remove([uploadedPath]);

        throw catalogError;
      }

      catalog = nextCatalog;

      renderAdminGallery();

      elements.artworkForm.reset();

      elements.artworkFileLabel.textContent =
        "Pilih gambar karya";

      setMessage(
        elements.artworkMessage,
        "Karya berhasil ditambahkan ke portfolio ♡",
        "success"
      );
    } catch (error) {
      console.error(error);

      setMessage(
        elements.artworkMessage,
        error.message ||
          "Upload gagal. Coba lagi yaa.",
        "error"
      );
    } finally {
      setButtonBusy(
        elements.uploadArtworkButton,
        false
      );
    }
  }

  async function deleteArtwork(item) {
    const approved = window.confirm(
      `Hapus “${item.title}” dari portfolio? ` +
      "Gambar yang sudah dihapus tidak dapat dikembalikan."
    );

    if (!approved) {
      return;
    }

    const nextCatalog =
      catalog.filter(
        (entry) => entry.id !== item.id
      );

    try {
      await writeCatalog(nextCatalog);

      const { error } =
        await supabaseClient.storage
          .from(portfolioBucket())
          .remove([item.path]);

      if (error) {
        throw error;
      }

      catalog = nextCatalog;

      renderAdminGallery();
    } catch (error) {
      console.error(error);

      window.alert(
        error.message ||
          "Karya gagal dihapus."
      );

      await loadCatalog();
    }
  }

  async function uploadPdf() {
    setMessage(
      elements.pdfMessage,
      ""
    );

    const file =
      elements.pdfFile.files?.[0];

    if (!file) {
      setMessage(
        elements.pdfMessage,
        "Pilih file PDF terlebih dahulu.",
        "error"
      );

      return;
    }

    if (file.type !== "application/pdf") {
      setMessage(
        elements.pdfMessage,
        "File harus berformat PDF.",
        "error"
      );

      return;
    }

    if (file.size > MAX_PDF_BYTES) {
      setMessage(
        elements.pdfMessage,
        "Ukuran PDF maksimal 25 MB.",
        "error"
      );

      return;
    }

    setButtonBusy(
      elements.uploadPdfButton,
      true,
      "Mengunggah PDF..."
    );

    try {
      const { error } =
        await supabaseClient.storage
          .from(privateBucket())
          .upload(
            config.pdfPath ||
              "berline-portfolio.pdf",
            file,
            {
              upsert: true,
              contentType: "application/pdf",
              cacheControl: "0"
            }
          );

      if (error) {
        throw error;
      }

      elements.pdfFile.value = "";

      elements.pdfFileLabel.textContent =
        "Pilih file PDF";

      setMessage(
        elements.pdfMessage,
        "PDF berhasil disimpan secara private ♡",
        "success"
      );
    } catch (error) {
      console.error(error);

      setMessage(
        elements.pdfMessage,
        error.message ||
          "PDF gagal di-upload.",
        "error"
      );
    } finally {
      setButtonBusy(
        elements.uploadPdfButton,
        false
      );
    }
  }

  async function downloadPdf() {
    setMessage(
      elements.pdfMessage,
      ""
    );

    setButtonBusy(
      elements.downloadPdfButton,
      true,
      "Menyiapkan PDF..."
    );

    try {
      const { data, error } =
        await supabaseClient.storage
          .from(privateBucket())
          .createSignedUrl(
            config.pdfPath ||
              "berline-portfolio.pdf",
            60,
            {
              download:
                "Berline-Portfolio.pdf"
            }
          );

      if (error) {
        throw error;
      }

      const link =
        document.createElement("a");

      link.href = data.signedUrl;
      link.download =
        "Berline-Portfolio.pdf";
      link.rel = "noopener";

      document.body.appendChild(link);
      link.click();
      link.remove();

      setMessage(
        elements.pdfMessage,
        "Download PDF dimulai ♡",
        "success"
      );
    } catch (error) {
      console.error(error);

      setMessage(
        elements.pdfMessage,
        error.message ||
          "PDF belum tersedia atau tidak dapat diunduh.",
        "error"
      );
    } finally {
      setButtonBusy(
        elements.downloadPdfButton,
        false
      );
    }
  }

  function setupFileLabels() {
    elements.artworkFile.addEventListener(
      "change",
      () => {
        elements.artworkFileLabel.textContent =
          elements.artworkFile
            .files?.[0]?.name ||
          "Pilih gambar karya";
      }
    );

    elements.pdfFile.addEventListener(
      "change",
      () => {
        elements.pdfFileLabel.textContent =
          elements.pdfFile
            .files?.[0]?.name ||
          "Pilih file PDF";
      }
    );
  }

  async function init() {
    if (
      !hasConfig ||
      !window.supabase?.createClient
    ) {
      setMessage(
        elements.loginMessage,
        "Supabase belum terhubung. Isi supabase-config.js terlebih dahulu.",
        "error"
      );

      elements.loginForm
        .querySelector("button")
        .disabled = true;

      return;
    }

    supabaseClient =
      window.supabase.createClient(
        config.supabaseUrl,
        config.supabaseAnonKey,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        }
      );

    elements.loginForm.addEventListener(
      "submit",
      handleLogin
    );

    elements.logoutButton.addEventListener(
      "click",
      handleLogout
    );

    elements.artworkForm.addEventListener(
      "submit",
      uploadArtwork
    );

    elements.uploadPdfButton.addEventListener(
      "click",
      uploadPdf
    );

    elements.downloadPdfButton.addEventListener(
      "click",
      downloadPdf
    );

    elements.refreshButton.addEventListener(
      "click",
      loadCatalog
    );

    setupFileLabels();

    /*
     * Memeriksa sesi yang sudah tersimpan saat halaman dibuka.
     */
    const { data, error } =
      await supabaseClient.auth.getSession();

    if (error) {
      setMessage(
        elements.loginMessage,
        error.message ||
          "Sesi tidak dapat diperiksa.",
        "error"
      );

      showLoggedOut();

      return;
    }

    if (data?.session) {
      showAuthenticated(data.session);
    } else {
      showLoggedOut();
    }

    /*
     * Memantau login dan logout setelah halaman terbuka.
     */
    supabaseClient.auth.onAuthStateChange(
      (_event, session) => {
        window.setTimeout(() => {
          if (session) {
            showAuthenticated(session);
          } else {
            showLoggedOut();
          }
        }, 0);
      }
    );
  }

  init();
})();
