const { forbiddenMarkers: H5_SWIPER_MARKERS } = require("../validate-h5-preview-bundle");

const IMAGE_LIBRARY_STORAGE_KEY = "erkexitong-image-library";

function createSvgFixtureDataUrl(label, background, accent) {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">',
    `<rect width="640" height="480" fill="${background}"/>`,
    `<circle cx="500" cy="120" r="84" fill="${accent}" opacity="0.9"/>`,
    '<text x="54" y="238" fill="#ffffff" font-family="Arial, sans-serif" font-size="54" font-weight="700">PREVIEW</text>',
    `<text x="54" y="328" fill="#ffffff" font-family="Arial, sans-serif" font-size="96" font-weight="700">${label}</text>`,
    "</svg>"
  ].join("");
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

const IMAGE_LIBRARY_FIXTURE_URLS = [
  createSvgFixtureDataUrl("01", "#0b806b", "#d7c08a"),
  createSvgFixtureDataUrl("02", "#9f3b32", "#f1b24a")
];

function createImageLibraryFixtures(uploadedAt = Date.now()) {
  return IMAGE_LIBRARY_FIXTURE_URLS.map((url, index) => ({
    id: `smoke-preview-image-${index + 1}`,
    originalUrl: url,
    thumbUrl: url,
    width: 640,
    height: 480,
    size: Buffer.byteLength(url),
    uploadedAt: uploadedAt - index,
    usedCount: 0
  }));
}

function hasSwiperRuntimeMarkers(source) {
  return H5_SWIPER_MARKERS.some((marker) => String(source).includes(marker));
}

async function runH5SmokeBrowserFlow(page, options) {
  const baseUrl = String(options.baseUrl).replace(/\/$/, "");
  const artifactDir = String(options.artifactDir).replace(/\\/g, "/").replace(/\/$/, "");
  const imageFixturePath = String(options.imageFixturePath);
  const timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0 ? options.timeoutMs : 5000;
  const userId = `smoke-student-${Date.now()}`;
  const noteTitle = `Smoke 图文材料 ${Date.now()}`;
  const proofText = "Smoke 自动化草稿：班级民主评议过程记录";
  const noteText = "Smoke 自动化图文正文，用于验证离线保存、刷新恢复与材料引用。";
  const steps = {};
  const consoleEntries = [];
  const pageErrors = [];
  const requests = [];
  const dialogs = [];
  const responsiveChecks = [];
  const desktopResponsiveChecks = [];
  const breakpointResponsiveChecks = [];
  const mobileScreenshots = [];
  const imageLibraryPreview = {
    fixtureCount: 0,
    initialLoadJavaScriptUrls: [],
    initialLoadJavaScriptScanFailures: [],
    initialLoadSwiperMarkerUrls: [],
    initialLoadHasSwiperMarkers: null,
    previewOpened: false,
    initialCounter: "",
    nextCounter: "",
    desktopPreviewScreenshot: "",
    mobilePreviewScreenshot: "",
    mobilePreviewNoOverflow: false,
    escapeClosed: false,
    focusRestored: false
  };
  let unexpectedConsoleEntries = [];
  let fatalError = "";
  let currentFlow = "登录页";

  page.setDefaultTimeout(timeoutMs);
  page.setDefaultNavigationTimeout(timeoutMs);

  page.on("console", (message) => {
    if (message.type() !== "error" && message.type() !== "warning") {
      return;
    }

    const location = message.location();
    consoleEntries.push({
      flow: currentFlow,
      level: message.type(),
      text: message.text(),
      url: location.url || "",
      pageUrl: page.url()
    });
  });
  page.on("pageerror", (error) => {
    pageErrors.push({
      flow: currentFlow,
      message: error.message,
      pageUrl: page.url()
    });
  });
  page.on("request", (request) => {
    requests.push({ method: request.method(), url: request.url() });
  });
  page.on("dialog", (dialog) => {
    dialogs.push({ type: dialog.type(), message: dialog.message() });
    void dialog.accept();
  });

  const assert = (condition, message) => {
    if (!condition) {
      throw new Error(message);
    }
  };

  const ignoredConsoleEntry = (entry) =>
    entry.url.endsWith("/favicon.ico") ||
    entry.text.includes("favicon.ico") ||
    entry.url.includes("missing-smoke-image");

  const screenshotPath = (slug) => `${artifactDir}/${slug}.png`;

  const capture = async (slug) => {
    const filePath = screenshotPath(slug);
    await page.screenshot({ path: filePath, fullPage: false });
    return filePath;
  };

  const routeRootSelectors = {
    "pages/login/index": ".login-page",
    "pages/evaluation/index": ".evaluation-page",
    "pages/image/library/index": ".image-library:not(.image-library--gate)",
    "pages/note/list/index": ".note-list:not(.note-list--gate)",
    "pages/note/edit/index": ".note-page:not(.note-page--gate)",
    "pages/note/snapshot/index": ".note-snapshot-page",
    "pages/evaluation/preview/index": ".evaluation-preview:not(.evaluation-preview--gate)",
    "pages/submission/result/index": ".submission-result",
    "pages/submission/history/index": ".submission-history:not(.submission-history--gate)",
    "pages/error/index": ".error-page"
  };

  const gotoRoute = async (route) => {
    const routePath = route.split("?")[0];
    const rootSelector = routeRootSelectors[routePath];
    await page.goto(`${baseUrl}/#/${route}`);
    await page.waitForLoadState("domcontentloaded");
    await page
      .locator(`${rootSelector ?? ".page-shell"}:visible`)
      .waitFor({ state: "visible", timeout: Math.max(timeoutMs, 10000) });
  };

  const buildResultPayload = () => ({
    steps,
    diagnostics: {
      consoleEntries: consoleEntries.slice(-50),
      unexpectedConsoleEntries: unexpectedConsoleEntries.slice(-50),
      pageErrors,
      dialogs,
      requests: requests
        .filter((request) => /\/(?:notes|evaluation-drafts|evaluation-submissions|upload)(?:[/?]|$)/.test(request.url))
        .slice(-50),
      responsiveChecks,
      desktopResponsiveChecks,
      breakpointResponsiveChecks,
      mobileScreenshots,
      imageLibraryPreview,
      fatalError
    }
  });

  const runStep = async (flow, slug, action) => {
    currentFlow = flow;
    try {
      const note = await action();
      steps[flow] = {
        status: "passed",
        note: typeof note === "string" && note ? note : "真实浏览器交互通过",
        screenshot: await capture(slug)
      };
    } catch (error) {
      let screenshot = "";
      try {
        screenshot = await capture(`${slug}-failed`);
      } catch {
        // The original interaction failure is the useful error.
      }
      steps[flow] = {
        status: "failed",
        note: error instanceof Error ? error.message : String(error),
        screenshot
      };
    }
  };

  const runSkippedStep = async (flow, slug, note, action) => {
    currentFlow = flow;
    try {
      await action();
      steps[flow] = {
        status: "skipped",
        note,
        screenshot: await capture(slug)
      };
    } catch (error) {
      let screenshot = "";
      try {
        screenshot = await capture(`${slug}-failed`);
      } catch {
        // The original precondition failure is the useful error.
      }
      steps[flow] = {
        status: "failed",
        note: error instanceof Error ? error.message : String(error),
        screenshot
      };
    }
  };

  try {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${baseUrl}/#/pages/login/index`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await runStep("登录页", "01-login", async () => {
    assert((await page.title()) === "学生综合素质评定系统", "页面标题不正确");
    await page.locator(".login-page__title").waitFor({ state: "visible" });
    const input = page.locator(".login-card__input input");
    await input.fill(userId);
    await page.locator(".login-card__primary").click();
    await page.waitForURL(/#\/pages\/evaluation\/index/, { timeout: 10000 });
    return `离线登录成功并进入评定页：${userId}`;
  });

  await runStep("评定页首页", "02-evaluation-home", async () => {
    await page.locator(".evaluation-top__label").waitFor({ state: "visible" });
    assert(await page.getByText("道德与思想素质", { exact: true }).first().isVisible(), "五维目录未渲染");
    assert(await page.locator(".evaluation-status__sync").isVisible(), "草稿同步状态未渲染");
    return "顶部状态、五维目录和草稿状态均已渲染";
  });

  await runStep("评定页填报", "03-evaluation-fill", async () => {
    const textarea = page.locator("#evaluation-item-moral-class-review textarea");
    await textarea.waitFor({ state: "visible" });
    await textarea.fill(proofText);
    assert((await textarea.inputValue()) === proofText, "证明文字未写入输入框");
    const unsavedStatus = page.locator(".evaluation-status__sync--local-unsaved");
    await unsavedStatus.waitFor({ state: "visible" });
    assert((await unsavedStatus.textContent())?.includes("本地未保存"), "编辑后未显示本地未保存状态");
    return "填写班级民主评议证明文字后，草稿进入本地未保存状态";
  });

  await runStep("保存草稿", "04-draft-saved", async () => {
    const requestStart = requests.length;
    await page.locator(".evaluation-top__action--save").click();
    const savedStatus = page.locator(".evaluation-status__sync--local-saved");
    await savedStatus.waitFor({ state: "visible", timeout: 10000 });
    assert((await savedStatus.textContent())?.includes("本地已保存"), "保存后未显示本地已保存状态");
    const saveRequests = requests.slice(requestStart).map((request) => request.url);
    assert(!saveRequests.some((url) => url.includes("/evaluation-drafts")), "离线保存意外请求 /evaluation-drafts");
    await page.reload();
    const textarea = page.locator("#evaluation-item-moral-class-review textarea");
    await textarea.waitFor({ state: "visible", timeout: 10000 });
    assert((await textarea.inputValue()) === proofText, "刷新后评定草稿未恢复");
    return "离线保存显示本地已保存，刷新后内容恢复且未请求 /evaluation-drafts";
  });

  await runStep("图片上传区域", "05-local-image", async () => {
    assert(imageFixturePath, "缺少 smoke 图片 fixture");
    const proofItem = page.locator("#evaluation-item-moral-class-review .proof-item").first();
    const uploadButton = proofItem.locator(".upload-image-button").first();
    const [chooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      uploadButton.click()
    ]);
    await chooser.setFiles(imageFixturePath);
    const image = proofItem.locator(".proof-item__image").first();
    await image.waitFor({ state: "visible", timeout: 10000 });
    await proofItem.locator(".proof-item__image-remove").first().click();
    await image.waitFor({ state: "detached", timeout: 10000 });
    assert(await proofItem.locator(".proof-item__library").first().isVisible(), "图片库入口不可见");
    assert(await proofItem.locator(".proof-item__library--note").isVisible(), "图文库入口不可见");
    return "本地图片选择、预览、删除以及图片库/图文库入口可操作";
  });

  await runStep("图片库页", "06-image-library", async () => {
    const fixtures = createImageLibraryFixtures();
    const consoleStart = consoleEntries.length;
    const pageErrorStart = pageErrors.length;
    imageLibraryPreview.fixtureCount = fixtures.length;
    await page.evaluate(
      ({ key, images }) => localStorage.setItem(key, JSON.stringify({ data: images })),
      { key: IMAGE_LIBRARY_STORAGE_KEY, images: fixtures }
    );

    const directRouteUrl = `${baseUrl}/?smokeDirect=image-library-${Date.now()}#/pages/image/library/index`;
    await page.goto(directRouteUrl, { waitUntil: "domcontentloaded" });
    await page
      .locator(".image-library:not(.image-library--gate):visible")
      .waitFor({ state: "visible", timeout: Math.max(timeoutMs, 10000) });

    const assets = page.locator(".image-library__asset");
    await assets.nth(fixtures.length - 1).waitFor({ state: "visible", timeout: Math.max(timeoutMs, 10000) });
    assert((await assets.count()) === fixtures.length, "图片库 fixture 未完整渲染");
    await page.waitForLoadState("networkidle", { timeout: Math.max(timeoutMs, 10000) });

    const initialLoadDiagnostics = await page.evaluate(async ({ markers }) => {
      const javaScriptUrls = Array.from(
        new Set(
          performance
            .getEntriesByType("resource")
            .map((entry) => entry.name)
            .filter((url) => {
              const parsed = new URL(url, window.location.href);
              return parsed.origin === window.location.origin && /\.js$/i.test(parsed.pathname);
            })
        )
      );
      const scans = await Promise.all(
        javaScriptUrls.map(async (url) => {
          try {
            const response = await fetch(url, { cache: "force-cache" });
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }
            const source = await response.text();
            return {
              url,
              hasSwiperMarkers: markers.some((marker) => source.includes(marker)),
              error: ""
            };
          } catch (error) {
            return {
              url,
              hasSwiperMarkers: false,
              error: error instanceof Error ? error.message : String(error)
            };
          }
        })
      );

      return {
        initialLoadJavaScriptUrls: javaScriptUrls,
        initialLoadJavaScriptScanFailures: scans
          .filter((scan) => scan.error)
          .map((scan) => ({ url: scan.url, error: scan.error })),
        initialLoadSwiperMarkerUrls: scans.filter((scan) => scan.hasSwiperMarkers).map((scan) => scan.url),
        initialLoadHasSwiperMarkers: scans.some((scan) => scan.hasSwiperMarkers)
      };
    }, { markers: H5_SWIPER_MARKERS });
    Object.assign(imageLibraryPreview, initialLoadDiagnostics);
    assert(initialLoadDiagnostics.initialLoadJavaScriptUrls.length > 0, "首次直达图片库未记录到 JS 资源");
    assert(
      initialLoadDiagnostics.initialLoadJavaScriptScanFailures.length === 0,
      `首次加载 JS 资源扫描失败：${initialLoadDiagnostics.initialLoadJavaScriptScanFailures
        .map((failure) => `${failure.url} (${failure.error})`)
        .join("；")}`
    );
    assert(
      !initialLoadDiagnostics.initialLoadHasSwiperMarkers,
      `首次直达图片库仍加载 Swiper：${initialLoadDiagnostics.initialLoadSwiperMarkerUrls.join("；")}`
    );

    const filters = page.locator(".image-library__filters");
    await filters.waitFor({ state: "visible" });
    const sourceGroup = filters.locator(".image-library__filter-group").filter({ hasText: "来源" });
    await sourceGroup.getByText("远端", { exact: true }).click();
    const reset = page.locator(".image-library__filter-reset");
    const activeSource = sourceGroup.locator(".image-library__filter--active");
    await activeSource.waitFor({ state: "visible" });
    assert((await activeSource.textContent())?.includes("远端"), "来源筛选未切换为远端");
    assert(!(await reset.evaluate((element) => Boolean(element.disabled))), "切换来源后重置按钮未启用");
    await reset.click();
    await sourceGroup.getByText("全部", { exact: true }).waitFor({ state: "visible" });
    assert((await activeSource.textContent())?.includes("全部"), "重置后来源筛选未恢复全部");
    assert(await reset.evaluate((element) => Boolean(element.disabled)), "重置后筛选按钮未恢复禁用状态");
    await assets.nth(fixtures.length - 1).waitFor({ state: "visible", timeout: Math.max(timeoutMs, 10000) });

    const firstAsset = assets.first();
    assert((await firstAsset.evaluate((element) => element.tagName)) === "BUTTON", "图片资产预览入口不是原生按钮");
    assert((await firstAsset.getAttribute("aria-label"))?.startsWith("预览图片 "), "图片资产预览入口缺少可访问名称");
    await firstAsset.focus();
    assert(await firstAsset.evaluate((element) => document.activeElement === element), "图片资产按钮无法获得焦点");
    await firstAsset.press("Enter");
    const preview = page.locator(".image-preview__dialog");
    await preview.waitFor({ state: "visible", timeout: Math.max(timeoutMs, 10000) });
    imageLibraryPreview.previewOpened = true;
    await page.waitForFunction(() => document.activeElement?.matches(".image-preview__close"));

    const counter = preview.locator(".image-preview__counter");
    await page.waitForFunction(
      (expected) => document.querySelector(".image-preview__counter")?.textContent?.trim() === expected,
      `1 / ${fixtures.length}`
    );
    imageLibraryPreview.initialCounter = (await counter.textContent())?.trim() ?? "";
    assert(imageLibraryPreview.initialCounter === `1 / ${fixtures.length}`, "图片预览初始计数不正确");
    await preview.locator('.image-preview__image[alt="预览图片 1"].image-preview__image--loaded').waitFor({
      state: "visible",
      timeout: Math.max(timeoutMs, 10000)
    });

    await preview.locator(".image-preview__next").click();
    await page.waitForFunction(
      (expected) => document.querySelector(".image-preview__counter")?.textContent?.trim() === expected,
      `2 / ${fixtures.length}`
    );
    imageLibraryPreview.nextCounter = (await counter.textContent())?.trim() ?? "";
    assert(imageLibraryPreview.nextCounter === `2 / ${fixtures.length}`, "切换下一张后计数不正确");
    const secondImage = preview.locator('.image-preview__image[alt="预览图片 2"].image-preview__image--loaded');
    await secondImage.waitFor({ state: "visible", timeout: Math.max(timeoutMs, 10000) });
    assert((await secondImage.getAttribute("src")) === fixtures[1].originalUrl, "下一张图片 URL 不正确");

    imageLibraryPreview.desktopPreviewScreenshot = await capture("06-image-library-preview-desktop");
    const desktopViewport = page.viewportSize() ?? { width: 1280, height: 720 };
    try {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined))));
      imageLibraryPreview.mobilePreviewNoOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
      );
      assert(imageLibraryPreview.mobilePreviewNoOverflow, "移动视口图片预览出现横向溢出");
      assert(await preview.locator(".image-preview__close").isVisible(), "移动视口关闭按钮不可见");
      assert(await preview.locator(".image-preview__previous").isVisible(), "移动视口上一张按钮不可见");
      assert(await preview.locator(".image-preview__next").isVisible(), "移动视口下一张按钮不可见");
      imageLibraryPreview.mobilePreviewScreenshot = await capture("06-image-library-preview-mobile");
    } finally {
      await page.setViewportSize(desktopViewport);
    }

    await page.keyboard.press("Escape");
    await preview.waitFor({ state: "detached", timeout: Math.max(timeoutMs, 10000) });
    imageLibraryPreview.escapeClosed = true;
    imageLibraryPreview.focusRestored = await firstAsset.evaluate((element) => document.activeElement === element);
    assert(imageLibraryPreview.focusRestored, "Escape 关闭预览后未恢复到打开预览的图片焦点");
    await firstAsset.press("Space");
    await preview.waitFor({ state: "visible", timeout: Math.max(timeoutMs, 10000) });
    await preview.locator(".image-preview__close").click();
    await preview.waitFor({ state: "detached", timeout: Math.max(timeoutMs, 10000) });
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    );
    const stepConsoleIssues = consoleEntries.slice(consoleStart).filter((entry) => !ignoredConsoleEntry(entry));
    const stepPageErrors = pageErrors.slice(pageErrorStart);
    assert(
      stepConsoleIssues.length === 0,
      `图片库预览出现控制台异常：${stepConsoleIssues.map((entry) => entry.text).join("；")}`
    );
    assert(
      stepPageErrors.length === 0,
      `图片库预览出现页面异常：${stepPageErrors.map((entry) => entry.message).join("；")}`
    );
    return "首次直达未加载 Swiper；筛选重置、键盘打开、双图预览、计数切换、Escape 关闭、Space 重开和焦点恢复均通过";
  });

  await runStep("图文材料列表页", "07-note-list", async () => {
    await gotoRoute("pages/note/list/index");
    await page.locator(".note-list__search input").waitFor({ state: "visible" });
    assert(await page.locator(".note-list__primary").isVisible(), "新建图文材料入口不可见");
    return "列表、搜索框、空态和新建入口可见";
  });

  await runStep("图文编辑页", "08-note-edit", async () => {
    await page.locator(".note-list__primary").click();
    await page.waitForURL(/#\/pages\/note\/edit\/index/, { timeout: 10000 });
    await page.locator(".note-title-box__input input").fill(noteTitle);
    await page.getByText("添加文字", { exact: true }).click();
    await page.locator(".note-block__textarea textarea").fill(noteText);

    const requestStart = requests.length;
    await page.locator(".note-actions__secondary").click();
    await page.locator(".note-actions__meta").getByText("本地已保存", { exact: true }).waitFor({
      state: "visible",
      timeout: 10000
    });
    const noteRequests = requests.slice(requestStart).map((request) => request.url);
    assert(!noteRequests.some((url) => /\/notes(?:[/?]|$)/.test(url)), "离线图文保存意外请求 /notes");

    await page.reload();
    await page.locator(".note-title-box__input input").waitFor({ state: "visible", timeout: 10000 });
    assert((await page.locator(".note-title-box__input input").inputValue()) === noteTitle, "刷新后图文标题未恢复");
    assert((await page.locator(".note-block__textarea textarea").inputValue()) === noteText, "刷新后图文正文未恢复");
    await page.locator(".note-toolbar__button").filter({ hasText: "预览" }).click();
    await page.locator(".note-preview").getByText(noteText, { exact: true }).waitFor({ state: "visible" });
    return "图文编辑、保存、刷新恢复和预览均通过，且未请求 /notes";
  });

  await runStep("图文快照页", "09-note-snapshot", async () => {
    const snapshotKey = `smoke-note-snapshot-${Date.now()}`;
    await page.evaluate(({ key, title, text }) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          data: {
            noteId: "smoke-note-snapshot",
            title,
            plainText: text,
            imageCount: 0,
            referencedAt: Date.now(),
            contentSnapshot: [{ type: "paragraph", text }]
          }
        })
      );
    }, { key: snapshotKey, title: noteTitle, text: noteText });
    await gotoRoute(`pages/note/snapshot/index?snapshotKey=${encodeURIComponent(snapshotKey)}`);
    const snapshotPage = page.locator(".note-snapshot-page:visible");
    await snapshotPage.getByText(noteTitle, { exact: true }).waitFor({ state: "visible" });
    await snapshotPage.getByText(noteText, { exact: true }).waitFor({ state: "visible" });
    return "独立 snapshotKey 可只读恢复标题和内容块快照";
  });

  await runStep("图文材料引用", "10-note-reference-entry", async () => {
    await gotoRoute("pages/evaluation/index");
    const proofItem = page.locator("#evaluation-item-moral-class-review .proof-item").first();
    await proofItem.locator(".proof-item__library--note").click();
    const actionSheet = page.locator(".taro__actionSheet");
    const firstNoteOption = actionSheet.locator('.taro-actionsheet__cell[data-tap-index="0"]');
    await firstNoteOption.waitFor({ state: "visible", timeout: 10000 });
    assert((await firstNoteOption.textContent())?.includes("Smoke 图文材料"), "ActionSheet 未显示刚保存的图文材料");
    await firstNoteOption.click();
    await firstNoteOption.waitFor({ state: "hidden", timeout: 10000 });
    const noteReference = proofItem.locator(".proof-item__note");
    await noteReference.waitFor({ state: "visible", timeout: 10000 });
    assert((await noteReference.locator(".proof-item__note-title").textContent())?.includes(noteTitle), "图文引用标题未写入评定材料");
    assert((await proofItem.locator("textarea").inputValue()).includes(`《${noteTitle}》`), "图文引用摘要未写入证明文字");
    return "通过 Taro ActionSheet 选择本地图文，引用卡片和文字摘要均写入评定材料";
  });

  await runStep("提交前预览页", "11-preview", async () => {
    await page.locator(".evaluation-top__action--preview").click();
    await page.waitForURL(/#\/pages\/evaluation\/preview\/index/, { timeout: 10000 });
    await page.locator(".evaluation-preview__stats").waitFor({ state: "visible" });
    assert(await page.getByText("材料明细", { exact: true }).isVisible(), "预览页材料明细未渲染");
    assert(await page.locator(".evaluation-preview__issue").first().isVisible(), "预览页未显示待完善问题");
    return "预览摘要、材料明细和待完善问题已渲染";
  });

  await runStep("定位校验问题", "12-issue-focus", async () => {
    await page.locator(".evaluation-preview__issue").first().click();
    await page.waitForURL(/#\/pages\/evaluation\/index\?.*focusItem=/, { timeout: 10000 });
    const focusedItem = page.locator(".evaluation-panel__item--focused");
    await focusedItem.waitFor({ state: "visible", timeout: 10000 });
    assert((await focusedItem.getAttribute("id"))?.startsWith("evaluation-item-"), "定位后未高亮具体评定条目");
    return "点击预览问题后返回填报页并高亮具体条目";
  });

  await runStep("提交失败提示", "13-submit-offline-blocked", async () => {
    assert(await page.getByText("离线演示", { exact: true }).first().isVisible(), "未显示离线演示状态");
    const requestStart = requests.length;
    await page.locator(".evaluation-top__action--submit").click();
    const modal = page.locator(".taro__modal");
    const modalTitle = modal.locator(".taro-modal__title");
    await modalTitle.waitFor({ state: "visible", timeout: 10000 });
    assert((await modalTitle.textContent()) === "仅完成本地暂存", "离线提交提示标题不正确");
    assert(
      (await modal.locator(".taro-modal__text").textContent())?.includes("没有进行正式提交"),
      "离线提交提示未说明正式提交被拦截"
    );
    await modal.locator(".taro-model__confirm").click();
    await modalTitle.waitFor({ state: "hidden", timeout: 10000 });
    const submitRequests = requests.slice(requestStart).map((request) => request.url);
    assert(
      !submitRequests.some((url) => /\/evaluation-submissions(?:[/?]|$)/.test(url)),
      "离线提交拦截后仍请求 /evaluation-submissions"
    );
    assert(/#\/pages\/evaluation\/index/.test(page.url()), "离线提交拦截后离开了评定页");
    return "离线点击提交后显示仅本地暂存提示，关闭后停留评定页且未请求正式提交接口";
  });

  await page.evaluate(({ fixtureUserId }) => {
    const createdAt = Date.now();
    const record = {
      submissionId: "smoke-submission-returned-001",
      userId: fixtureUserId,
      studentName: "Smoke 测试学生",
      className: "软件工程 1 班",
      createdAt,
      ruleVersion: "2026.07.v1",
      totalScore: 35,
      materialCount: 1,
      issueCount: 1,
      reviewStatus: "returned",
      reviewComment: "请补充材料。",
      returnReason: "班级民主评议说明不够具体。",
      reviewerName: "Smoke 审核员",
      reviewedAt: createdAt + 1000,
      validationIssues: [],
      records: {},
      selectedItemIds: [],
      dimensionSummaries: []
    };
    localStorage.setItem("erkexitong-submission-history", JSON.stringify({ data: [record] }));
  }, { fixtureUserId: userId });

  await runSkippedStep(
    "提交结果页",
    "14-submission-result-fixture",
    "当前未配置真实后端，正式提交如实跳过；仅用本地不可变 fixture 验证结果页可恢复。",
    async () => {
      await gotoRoute("pages/submission/result/index?submissionId=smoke-submission-returned-001");
      const resultPage = page.locator(".submission-result:visible");
      await resultPage.getByText("正在使用本地提交快照", { exact: true }).waitFor({ state: "visible" });
      assert(
        (await resultPage.locator(".submission-result__sub").textContent())?.includes("smoke-submission-returned-001"),
        "fixture 结果页未恢复提交编号"
      );
    }
  );

  await runStep("提交历史页", "15-submission-history", async () => {
    await gotoRoute("pages/submission/history/index");
    const historyPage = page.locator(".submission-history:visible");
    await historyPage.locator(".submission-history__card-title").waitFor({ state: "visible" });
    assert(
      (await historyPage.locator(".submission-history__card-title").textContent()) === "smoke-submission-returned-001",
      "历史页未显示 fixture 记录"
    );
    await historyPage
      .locator(".submission-history__review-copy")
      .getByText("班级民主评议说明不够具体。", { exact: true })
      .waitFor({ state: "visible" });
    await historyPage.locator(".submission-history__supplement").waitFor({ state: "visible" });
    return "本地历史记录的退回状态、原因和补充入口可见";
  });

  await runStep("状态说明页", "16-error-page", async () => {
    await gotoRoute("pages/error/index?type=offline");
    assert(await page.getByText("当前是离线模式", { exact: true }).isVisible(), "离线状态说明未渲染");
    await page.locator(".error-page__primary").click();
    await page.waitForURL(/#\/pages\/evaluation\/index/, { timeout: 10000 });
    return "离线状态说明和返回评定页入口可操作";
  });

  const responsiveRoutes = [
    ["评定页首页", "pages/evaluation/index", "mobile-evaluation"],
    ["图片库页", "pages/image/library/index", "mobile-image-library"],
    ["图文编辑页", "pages/note/edit/index", "mobile-note-edit"],
    ["提交前预览页", "pages/evaluation/preview/index", "mobile-preview"]
  ];
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [flow, route, slug] of responsiveRoutes) {
    currentFlow = flow;
    try {
      await gotoRoute(route);
      const widths = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth
      }));
      const layoutPresence = await page.evaluate(() => ({
        layoutShellCount: document.querySelectorAll(".web-split-layout").length,
        layoutMasterCount: document.querySelectorAll(".web-split-layout__master").length
      }));
      responsiveChecks.push({
        flow,
        route,
        ...widths,
        ...layoutPresence,
        ok: widths.scrollWidth <= widths.clientWidth && layoutPresence.layoutShellCount === 0 && layoutPresence.layoutMasterCount === 0
      });
      if (widths.scrollWidth > widths.clientWidth && steps[flow]?.status !== "failed") {
        steps[flow] = {
          ...steps[flow],
          status: "failed",
          note: `${steps[flow]?.note || ""}；390px 视口横向溢出 ${widths.scrollWidth - widths.clientWidth}px`
        };
      }
      assert(layoutPresence.layoutShellCount === 0, `${flow} 在 390px 视口仍渲染双栏壳`);
      assert(layoutPresence.layoutMasterCount === 0, `${flow} 在 390px 视口仍挂载评定页 master`);
      if (slug === "mobile-evaluation" || slug === "mobile-note-edit") {
        mobileScreenshots.push(await capture(slug));
      }
    } catch (error) {
      responsiveChecks.push({
        flow,
        route,
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      });
      if (steps[flow]?.status !== "failed") {
        steps[flow] = {
          ...steps[flow],
          status: "failed",
          note: `${steps[flow]?.note || ""}；移动端检查失败`
        };
      }
    }
  }

  const desktopRoutes = [
    ["图片库页", "pages/image/library/index"],
    ["图文编辑页", "pages/note/edit/index"],
    ["提交前预览页", "pages/evaluation/preview/index"]
  ];
  for (const [flow, route] of desktopRoutes) {
    currentFlow = flow;
    await page.setViewportSize({ width: 1280, height: 844 });
    try {
      await gotoRoute(route);
      const widths = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth
      }));
      const layoutPresence = await page.evaluate(() => ({
        layoutShellCount: document.querySelectorAll(".web-split-layout").length,
        layoutMasterCount: document.querySelectorAll(".web-split-layout__master").length,
        layoutDetailCount: document.querySelectorAll(".web-split-layout__detail").length
      }));
      desktopResponsiveChecks.push({
        flow,
        route,
        ...widths,
        ...layoutPresence,
        ok:
          widths.scrollWidth <= widths.clientWidth &&
          layoutPresence.layoutShellCount === 1 &&
          layoutPresence.layoutMasterCount === 1 &&
          layoutPresence.layoutDetailCount === 1
      });
      assert(widths.scrollWidth <= widths.clientWidth, `${flow} 在 1280px 视口横向溢出 ${widths.scrollWidth - widths.clientWidth}px`);
      assert(layoutPresence.layoutShellCount === 1, `${flow} 在 1280px 视口未渲染双栏壳`);
      assert(layoutPresence.layoutMasterCount === 1, `${flow} 在 1280px 视口未挂载评定页 master`);
      assert(layoutPresence.layoutDetailCount === 1, `${flow} 在 1280px 视口未渲染详情 pane`);
    } catch (error) {
      desktopResponsiveChecks.push({
        flow,
        route,
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      });
      if (steps[flow]?.status !== "failed") {
        steps[flow] = {
          ...steps[flow],
          status: "failed",
          note: `${steps[flow]?.note || ""}；桌面宽屏双栏检查失败`
        };
      }
    }
  }

  const breakpointCases = [
    { width: 1179, shouldMountMaster: false },
    { width: 1180, shouldMountMaster: true }
  ];
  const breakpointRoutes = [
    ["图片库页", "pages/image/library/index"],
    ["图文编辑页", "pages/note/edit/index"],
    ["提交前预览页", "pages/evaluation/preview/index"]
  ];
  for (const [flow, route] of breakpointRoutes) {
    for (const { width, shouldMountMaster } of breakpointCases) {
      currentFlow = flow;
      await page.setViewportSize({ width, height: 844 });
      try {
        await gotoRoute(route);
        const widths = await page.evaluate(() => ({
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth
        }));
        const layoutPresence = await page.evaluate(() => ({
          layoutShellCount: document.querySelectorAll(".web-split-layout").length,
          layoutMasterCount: document.querySelectorAll(".web-split-layout__master").length,
          layoutDetailCount: document.querySelectorAll(".web-split-layout__detail").length,
          inlineDetailCount: document.querySelectorAll(".web-split-layout-inline__detail").length
        }));
        const expectedShellCount = shouldMountMaster ? 1 : 0;
        const expectedInlineDetailCount = shouldMountMaster ? 0 : 1;
        breakpointResponsiveChecks.push({
          flow,
          route,
          viewportWidth: width,
          shouldMountMaster,
          ...widths,
          ...layoutPresence,
          ok:
            widths.scrollWidth <= widths.clientWidth &&
            layoutPresence.layoutShellCount === expectedShellCount &&
            layoutPresence.layoutMasterCount === expectedShellCount &&
            layoutPresence.layoutDetailCount === expectedShellCount &&
            layoutPresence.inlineDetailCount === expectedInlineDetailCount
        });
        assert(widths.scrollWidth <= widths.clientWidth, `${flow} 在 ${width}px 视口横向溢出 ${widths.scrollWidth - widths.clientWidth}px`);
        assert(layoutPresence.layoutShellCount === expectedShellCount, `${flow} 在 ${width}px 视口双栏壳数量不符合断点预期`);
        assert(layoutPresence.layoutMasterCount === expectedShellCount, `${flow} 在 ${width}px 视口 master 数量不符合断点预期`);
        assert(layoutPresence.layoutDetailCount === expectedShellCount, `${flow} 在 ${width}px 视口详情 pane 数量不符合断点预期`);
        assert(layoutPresence.inlineDetailCount === expectedInlineDetailCount, `${flow} 在 ${width}px 视口 inline 详情数量不符合断点预期`);
      } catch (error) {
        breakpointResponsiveChecks.push({
          flow,
          route,
          viewportWidth: width,
          shouldMountMaster,
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        });
        if (steps[flow]?.status !== "failed") {
          steps[flow] = {
            ...steps[flow],
            status: "failed",
            note: `${steps[flow]?.note || ""}；${width}px 断点检查失败`
          };
        }
      }
    }
  }

  unexpectedConsoleEntries = consoleEntries.filter((entry) => !ignoredConsoleEntry(entry));
  const runtimeIssuesByFlow = new Map();
  const addRuntimeIssue = (flow, type) => {
    const counts = runtimeIssuesByFlow.get(flow) || { console: 0, page: 0 };
    counts[type] += 1;
    runtimeIssuesByFlow.set(flow, counts);
  };
  unexpectedConsoleEntries.forEach((entry) => addRuntimeIssue(entry.flow, "console"));
  pageErrors.forEach((entry) => addRuntimeIssue(entry.flow, "page"));
  for (const [flow, counts] of runtimeIssuesByFlow) {
    if (!steps[flow]) {
      continue;
    }
    steps[flow] = {
      ...steps[flow],
      status: "failed",
      note: `${steps[flow].note || "浏览器交互出现运行时异常"}；发现 ${counts.console} 条控制台异常和 ${counts.page} 条页面异常`
    };
  }
  } catch (error) {
    fatalError = error instanceof Error ? error.message : String(error);
  }

  return buildResultPayload();
}

module.exports = {
  H5_SWIPER_MARKERS,
  IMAGE_LIBRARY_FIXTURE_URLS,
  IMAGE_LIBRARY_STORAGE_KEY,
  createImageLibraryFixtures,
  hasSwiperRuntimeMarkers,
  runH5SmokeBrowserFlow
};
