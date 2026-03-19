const SUPABASE_URL = "https://lwlyefbubroohjgslsjy.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_w0RQx_aqJ35DOfpLobKp1w_jOB8CSxI";
const BUCKET_NAME = "screenshots";
const REQUEST_TIMEOUT_MS = 20000;
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

const demoEntries = [
  {
    date: "2026-03-08",
    title: "想法记录",
    notes: "开始整理 Vibe Coding 日历的结构和要展示的数据。",
    link: "",
    cost: 0,
    image_url: createPlaceholder("03/08", "Idea"),
    image_path: null,
  },
  {
    date: "2026-03-10",
    title: "线框草图",
    notes: "确定按日展开的横向时间轴布局。",
    link: "",
    cost: 299,
    image_url: createPlaceholder("03/10", "Wireframe"),
    image_path: null,
  },
  {
    date: "2026-03-12",
    title: "首屏视觉探索",
    notes: "尝试米白底和黑色折线的方向。",
    link: "https://example.com",
    cost: 1299,
    image_url: createPlaceholder("03/12", "Hero"),
    image_path: null,
  },
  {
    date: "2026-03-12",
    title: "图表样式",
    notes: "补上花费面积图和节点样式。",
    link: "",
    cost: 0,
    image_url: createPlaceholder("03/12", "Chart"),
    image_path: null,
  },
  {
    date: "2026-03-14",
    title: "截图卡片版式",
    notes: "让预览图和说明文案堆叠在同一天下面。",
    link: "",
    cost: 2480,
    image_url: createPlaceholder("03/14", "Cards"),
    image_path: null,
  },
  {
    date: "2026-03-16",
    title: "可录入版本",
    notes: "加入本地上传图片和 Supabase 云端保存。",
    link: "",
    cost: 9415,
    image_url: createPlaceholder("03/16", "Upload"),
    image_path: null,
  },
];

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
);

const authForm = document.querySelector("#auth-form");
const authStatus = document.querySelector("#auth-status");
const authHint = document.querySelector("#auth-hint");
const authSubmitButton = document.querySelector("#auth-submit");
const signOutButton = document.querySelector("#sign-out");
const timeline = document.querySelector("#timeline");
const costChart = document.querySelector("#cost-chart");
const form = document.querySelector("#entry-form");
const resetButton = document.querySelector("#reset-demo");
const cancelEditButton = document.querySelector("#cancel-edit");
const submitButton = document.querySelector("#submit-button");
const formStatus = document.querySelector("#form-status");
const formStatusText = document.querySelector("#form-status-text");
const imageLabel = document.querySelector("#image-label");
const template = document.querySelector("#event-card-template");
const metricDays = document.querySelector("#metric-days");
const metricEntries = document.querySelector("#metric-entries");
const metricTotal = document.querySelector("#metric-total");
const costTotal = document.querySelector("#cost-total");
const previewModal = document.querySelector("#preview-modal");
const previewCloseButton = document.querySelector("#preview-close");
const previewImage = document.querySelector("#preview-image");
const previewMeta = document.querySelector("#preview-meta");
const previewTitle = document.querySelector("#preview-title");
const previewNotes = document.querySelector("#preview-notes");
const previewLink = document.querySelector("#preview-link");

let entries = [];
let editingId = null;
let currentUser = null;
let lastActiveElement = null;

boot();

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(authForm);
  const email = String(formData.get("email") || "").trim();
  if (!email) {
    return;
  }

  authSubmitButton.disabled = true;
  authStatus.textContent = "正在发送登录链接...";

  const { error } = await supabaseClient.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin,
    },
  });

  authSubmitButton.disabled = false;
  authStatus.textContent = error
    ? `发送失败：${error.message}`
    : "登录链接已发送，请去邮箱打开。";
});

signOutButton.addEventListener("click", async () => {
  signOutButton.disabled = true;
  const { error } = await supabaseClient.auth.signOut();
  signOutButton.disabled = false;
  if (error) {
    authStatus.textContent = `退出失败：${error.message}`;
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const imageFile = formData.get("image");
  const date = formData.get("date");
  const title = formData.get("title").trim();
  const link = formData.get("link").trim();
  const notes = formData.get("notes").trim();
  const cost = Number(formData.get("cost")) || 0;
  const isEditing = Boolean(editingId);

  if (!currentUser) {
    setFormMessage("请先登录，再写入云端。");
    return;
  }

  if (!date || !title) {
    return;
  }

  if (!isEditing && (!(imageFile instanceof File) || imageFile.size === 0)) {
    setFormMessage("新建条目时必须上传一张预览图。");
    return;
  }

  setFormPending(true, isEditing ? "正在保存修改..." : "正在上传并保存...");

  try {
    setFormMessage(
      imageFile instanceof File && imageFile.size > 0 ? "正在上传图片..." : "正在保存记录...",
    );

    const imageUpload =
      imageFile instanceof File && imageFile.size > 0
        ? await uploadImage(imageFile)
        : null;

    if (isEditing) {
      setFormMessage("正在写入修改...");

      const current = entries.find((entry) => entry.id === editingId);
      const nextPayload = {
        event_date: date,
        title,
        link,
        notes,
        cost,
        image_url: imageUpload?.imageUrl ?? current.image,
        image_path: imageUpload?.imagePath ?? current.imagePath ?? null,
      };

      const { error } = await withTimeout(
        supabaseClient.from("entries").update(nextPayload).eq("id", editingId),
        "保存修改",
      );

      if (error) {
        throw error;
      }

      if (imageUpload?.imagePath && current?.imagePath) {
        await deleteImagePath(current.imagePath);
      }
    } else {
      setFormMessage("正在写入记录...");

      const { error } = await withTimeout(
        supabaseClient.from("entries").insert({
          user_id: currentUser.id,
          event_date: date,
          title,
          link,
          notes,
          cost,
          image_url: imageUpload.imageUrl,
          image_path: imageUpload.imagePath,
        }),
        "写入记录",
      );

      if (error) {
        throw error;
      }
    }

    exitEditMode();
    setFormMessage("正在刷新列表...");
    await loadEntries();
  } catch (error) {
    setFormMessage(`保存失败：${formatError(error)}`);
  } finally {
    setFormPending(false);
  }
});

resetButton.addEventListener("click", async () => {
  if (!currentUser) {
    setFormMessage("请先登录，再导入示例数据。");
    return;
  }

  setFormPending(true, "正在导入示例数据...");

  try {
    const { error } = await withTimeout(
      supabaseClient.from("entries").insert(
        demoEntries.map((entry) => ({
          user_id: currentUser.id,
          event_date: entry.date,
          title: entry.title,
          notes: entry.notes,
          link: entry.link,
          cost: entry.cost,
          image_url: entry.image_url,
          image_path: entry.image_path,
        })),
      ),
      "导入示例数据",
    );

    if (error) {
      throw error;
    }

    exitEditMode();
    setFormMessage("正在刷新列表...");
    await loadEntries();
  } catch (error) {
    setFormMessage(`导入示例失败：${formatError(error)}`);
  } finally {
    setFormPending(false);
  }
});

cancelEditButton.addEventListener("click", () => {
  exitEditMode();
});

previewCloseButton.addEventListener("click", () => {
  closePreviewModal();
});

previewModal.addEventListener("click", (event) => {
  if (event.target instanceof HTMLElement && event.target.dataset.closePreview !== undefined) {
    closePreviewModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !previewModal.hidden) {
    closePreviewModal();
  }
});

async function boot() {
  setFormPending(true, "正在连接云端...");
  await handleAuthCallback();
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  currentUser = session?.user ?? null;
  applyAuthState();
  await loadEntries();
  setFormPending(false);

  supabaseClient.auth.onAuthStateChange(async (_event, session) => {
    const previousUserId = currentUser?.id ?? null;
    currentUser = session?.user ?? null;
    const nextUserId = currentUser?.id ?? null;

    if (previousUserId && previousUserId !== nextUserId) {
      exitEditMode(true);
    }

    applyAuthState();
    await loadEntries();
  });
}

async function handleAuthCallback() {
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  const errorDescription =
    hash.get("error_description") || url.searchParams.get("error_description");

  if (errorDescription) {
    authStatus.textContent = decodeURIComponent(errorDescription.replace(/\+/g, " "));
    return;
  }

  if (accessToken && refreshToken) {
    const { error } = await supabaseClient.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      authStatus.textContent = `登录失败：${error.message}`;
      return;
    }

    clearAuthParams();
    return;
  }

  if (tokenHash && type) {
    const { error } = await supabaseClient.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (error) {
      authStatus.textContent = `登录失败：${error.message}`;
      return;
    }

    clearAuthParams();
  }
}

async function loadEntries() {
  if (!currentUser) {
    entries = [];
    timeline.innerHTML = '<div class="empty-state">登录后可查看你自己的云端记录。</div>';
    costChart.innerHTML = "";
    updateMetrics([]);
    return;
  }

  const { data, error } = await withTimeout(
    supabaseClient
      .from("entries")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("event_date", { ascending: true })
      .order("created_at", { ascending: true }),
    "读取记录",
  );

  if (error) {
    timeline.innerHTML = `<div class="empty-state">云端读取失败：${formatError(error)}</div>`;
    costChart.innerHTML = "";
    updateMetrics([]);
    return;
  }

  entries = await Promise.all(
    data.map(async (row) => ({
      id: row.id,
      date: row.event_date,
      title: row.title,
      notes: row.notes || "",
      link: row.link || "",
      cost: row.cost || 0,
      image: await resolveImageUrl(row),
      imagePath: row.image_path,
    })),
  );

  render();
}

function render() {
  const sortedEntries = [...entries].sort((left, right) => {
    if (left.date !== right.date) {
      return left.date.localeCompare(right.date);
    }

    return left.title.localeCompare(right.title);
  });

  if (!sortedEntries.length) {
    timeline.innerHTML =
      '<div class="empty-state">云端还没有记录。先在左侧添加第一条，或点击“恢复示例数据”。</div>';
    costChart.innerHTML = "";
    updateMetrics([]);
    return;
  }

  const days = buildDaySeries(sortedEntries);
  const months = buildMonthSeries(days);
  renderTimeline(months);
  renderCostChart(days);
  updateMetrics(days);
}

function buildDaySeries(sortedEntries) {
  const grouped = new Map();

  for (const entry of sortedEntries) {
    const bucket = grouped.get(entry.date) ?? [];
    bucket.push(entry);
    grouped.set(entry.date, bucket);
  }

  const dates = [...grouped.keys()].sort();
  const start = new Date(`${dates[0]}T00:00:00`);
  const end = new Date(`${dates[dates.length - 1]}T00:00:00`);
  const days = [];

  for (
    let current = new Date(start);
    current <= end;
    current.setDate(current.getDate() + 1)
  ) {
    const iso = formatDateISO(current);
    const items = grouped.get(iso) ?? [];
    days.push({
      date: iso,
      items,
      totalCost: items.reduce((sum, item) => sum + (Number(item.cost) || 0), 0),
    });
  }

  return days;
}

function buildMonthSeries(days) {
  const months = [];
  const monthMap = new Map();

  days.forEach((day) => {
    const dateObj = new Date(`${day.date}T00:00:00`);
    const key = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}`;

    if (!monthMap.has(key)) {
      monthMap.set(key, []);
    }

    monthMap.get(key).push(day);
  });

  for (const [key, monthDays] of monthMap) {
    const [year, month] = key.split("-").map(Number);
    const firstDate = new Date(year, month - 1, 1);
    const firstWeekday = firstDate.getDay();
    const totalDays = new Date(year, month, 0).getDate();
    const dayMap = new Map(monthDays.map((day) => [day.date, day]));
    const cells = [];

    for (let index = 0; index < firstWeekday; index += 1) {
      cells.push({ empty: true, id: `${key}-empty-${index}` });
    }

    for (let date = 1; date <= totalDays; date += 1) {
      const current = new Date(year, month - 1, date);
      const iso = formatDateISO(current);
      const existing = dayMap.get(iso);

      cells.push(
        existing ?? {
          date: iso,
          items: [],
          totalCost: 0,
        },
      );
    }

    months.push({
      key,
      year,
      month,
      cells,
      totalCost: monthDays.reduce((sum, day) => sum + day.totalCost, 0),
      entryCount: monthDays.reduce((sum, day) => sum + day.items.length, 0),
    });
  }

  return months;
}

function renderTimeline(months) {
  timeline.innerHTML = "";

  const weekLabels = ["日", "一", "二", "三", "四", "五", "六"];

  for (const month of months) {
    const section = document.createElement("section");
    section.className = "month-board";

    const header = document.createElement("div");
    header.className = "month-head";
    header.innerHTML = `
      <div>
        <p class="month-eyebrow">${month.year}</p>
        <h4>${month.month} 月</h4>
      </div>
      <div class="month-summary">
        <span>${month.entryCount} 个条目</span>
        <strong>¥${formatCurrency(month.totalCost)}</strong>
      </div>
    `;
    section.append(header);

    const weekRow = document.createElement("div");
    weekRow.className = "week-row";
    weekLabels.forEach((label) => {
      const node = document.createElement("div");
      node.className = "week-label";
      node.textContent = label;
      weekRow.append(node);
    });
    section.append(weekRow);

    const grid = document.createElement("div");
    grid.className = "month-grid";

    month.cells.forEach((cell) => {
      if (cell.empty) {
        const emptyCell = document.createElement("div");
        emptyCell.className = "calendar-day is-empty";
        grid.append(emptyCell);
        return;
      }

      const dateObj = new Date(`${cell.date}T00:00:00`);
      const dayNode = document.createElement("article");
      dayNode.className = `calendar-day${cell.items.length ? " has-entry" : ""}`;

      const meta = document.createElement("div");
      meta.className = "calendar-day-meta";
      meta.innerHTML = `
        <div class="calendar-date-row">
          <time>${dateObj.getDate()}</time>
          <span>${weekdayLabel(dateObj)}</span>
        </div>
        <div class="calendar-cost-row">${cell.totalCost ? `¥${formatCurrency(cell.totalCost)}` : ""}</div>
      `;
      dayNode.append(meta);

      const stack = document.createElement("div");
      stack.className = "calendar-events";

      cell.items.forEach((item) => {
        const node = template.content.firstElementChild.cloneNode(true);
        const previewTrigger = node.querySelector(".event-preview-trigger");
        const previewImageNode = node.querySelector(".event-thumb");
        previewImageNode.src = item.image;
        previewImageNode.alt = item.title;
        node.querySelector(".event-title").textContent = item.title;
        node.querySelector(".event-date").textContent = `${formatDateCN(item.date)} · ¥${formatCurrency(item.cost)}`;
        node.querySelector(".event-notes").textContent = item.notes || "无备注";

        previewTrigger.addEventListener("click", () => {
          openPreviewModal(item, previewTrigger);
        });

        const link = node.querySelector(".event-link");
        if (item.link) {
          link.href = item.link;
          link.textContent = "打开链接";
        } else {
          link.remove();
        }

        node.querySelector(".edit-event").addEventListener("click", () => {
          enterEditMode(item);
        });

        node.querySelector(".delete-event").addEventListener("click", async () => {
          await deleteEntry(item);
        });

        stack.append(node);
      });

      if (!cell.items.length) {
        const emptyNote = document.createElement("p");
        emptyNote.className = "day-empty-note";
        emptyNote.textContent = "暂无记录";
        stack.append(emptyNote);
      }

      dayNode.append(stack);
      grid.append(dayNode);
    });

    section.append(grid);
    timeline.append(section);
  }
}

function renderCostChart(days) {
  const width = Math.max(days.length * 140, 760);
  const height = 290;
  const padding = { top: 24, right: 24, bottom: 56, left: 24 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const maxCost = Math.max(...days.map((day) => day.totalCost), 1);

  const points = days.map((day, index) => {
    const x =
      padding.left +
      (days.length === 1 ? innerWidth / 2 : (innerWidth / (days.length - 1)) * index);
    const y = padding.top + innerHeight - (day.totalCost / maxCost) * innerHeight;
    return { x, y, date: day.date, cost: day.totalCost };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath = `${linePath} L ${points.at(-1).x} ${padding.top + innerHeight} L ${points[0].x} ${padding.top + innerHeight} Z`;

  const gridLines = [0, 0.5, 1]
    .map((ratio) => {
      const y = padding.top + innerHeight - innerHeight * ratio;
      return `<line class="chart-grid" x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" />`;
    })
    .join("");

  const dots = points
    .map(
      (point) =>
        `<g>
          <circle class="chart-dot" cx="${point.x}" cy="${point.y}" r="8" />
          <text x="${point.x}" y="${height - 24}" text-anchor="middle">${formatShortDate(point.date)}</text>
        </g>`,
    )
    .join("");

  costChart.innerHTML = `
    <svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="每日花费图">
      <g class="chart-axis">
        ${gridLines}
        <path class="chart-area" d="${areaPath}" />
        <path class="chart-line" d="${linePath}" />
        ${dots}
      </g>
    </svg>
  `;
}

function updateMetrics(days) {
  const dayCount = days.length;
  const entryCount = entries.length;
  const total = entries.reduce((sum, item) => sum + (Number(item.cost) || 0), 0);

  metricDays.textContent = String(dayCount);
  metricEntries.textContent = String(entryCount);
  metricTotal.textContent = `¥${formatCurrency(total)}`;
  costTotal.textContent = `¥${formatCurrency(total)}`;
}

async function uploadImage(file) {
  const extension = file.name.includes(".") ? file.name.split(".").pop() : "png";
  const filePath = `entries/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await withTimeout(
    supabaseClient.storage.from(BUCKET_NAME).upload(filePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    }),
    "上传图片",
  );

  if (uploadError) {
    throw uploadError;
  }

  const { data, error: signedUrlError } = await withTimeout(
    supabaseClient.storage.from(BUCKET_NAME).createSignedUrl(filePath, SIGNED_URL_TTL_SECONDS),
    "生成图片地址",
  );

  if (signedUrlError) {
    throw signedUrlError;
  }

  return {
    imagePath: filePath,
    imageUrl: data.signedUrl,
  };
}

async function deleteEntry(item) {
  if (!currentUser) {
    setFormMessage("请先登录。");
    return;
  }

  setFormPending(true, "正在删除...");

  try {
    const { error } = await withTimeout(
      supabaseClient.from("entries").delete().eq("id", item.id),
      "删除记录",
    );

    if (error) {
      throw error;
    }

    if (item.imagePath) {
      await deleteImagePath(item.imagePath);
    }

    if (editingId === item.id) {
      exitEditMode();
    }

    await loadEntries();
  } catch (error) {
    setFormMessage(`删除失败：${formatError(error)}`);
  } finally {
    setFormPending(false);
  }
}

async function deleteImagePath(path) {
  const { error } = await withTimeout(
    supabaseClient.storage.from(BUCKET_NAME).remove([path]),
    "删除图片",
  );

  if (error) {
    console.error(error);
  }
}

async function resolveImageUrl(row) {
  if (!row.image_path) {
    return row.image_url;
  }

  const { data, error } = await withTimeout(
    supabaseClient.storage
      .from(BUCKET_NAME)
      .createSignedUrl(row.image_path, SIGNED_URL_TTL_SECONDS),
    "读取图片地址",
  );

  if (error) {
    console.error(error);
    return row.image_url;
  }

  return data.signedUrl;
}

function openPreviewModal(item, trigger) {
  lastActiveElement = trigger;
  previewModal.hidden = false;
  previewModal.classList.add("is-open");
  document.body.classList.add("modal-open");
  previewImage.src = item.image;
  previewImage.alt = item.title;
  previewMeta.textContent = `${formatDateCN(item.date)} · ¥${formatCurrency(item.cost)}`;
  previewTitle.textContent = item.title;
  previewNotes.textContent = item.notes || "无备注";

  if (item.link) {
    previewLink.href = item.link;
    previewLink.textContent = "打开链接";
    previewLink.hidden = false;
  } else {
    previewLink.hidden = true;
    previewLink.removeAttribute("href");
    previewLink.textContent = "";
  }

  previewCloseButton.focus();
}

function closePreviewModal() {
  previewModal.classList.remove("is-open");
  previewModal.hidden = true;
  document.body.classList.remove("modal-open");
  previewImage.removeAttribute("src");

  if (lastActiveElement instanceof HTMLElement) {
    lastActiveElement.focus();
  }

  lastActiveElement = null;
}

function withTimeout(promise, label, timeoutMs = REQUEST_TIMEOUT_MS) {
  let timerId;

  const timeoutPromise = new Promise((_, reject) => {
    timerId = window.setTimeout(() => {
      reject(new Error(`${label}超时，请检查网络或稍后重试。`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    window.clearTimeout(timerId);
  });
}

function formatError(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error?.message === "string" && error.message) {
    return error.message;
  }

  return "发生未知错误，请稍后重试。";
}

function setFormPending(pending, message = "") {
  submitButton.disabled = pending;
  resetButton.disabled = pending;
  cancelEditButton.disabled = pending;

  if (pending && message) {
    setFormMessage(message);
    return;
  }

  if (!pending && !editingId) {
    formStatus.hidden = true;
    formStatusText.textContent = "";
  }
}

function setFormMessage(message) {
  formStatus.hidden = false;
  formStatusText.textContent = message;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("zh-CN").format(value || 0);
}

function formatDateCN(date) {
  const target = new Date(`${date}T00:00:00`);
  return `${target.getMonth() + 1}月${target.getDate()}日`;
}

function formatShortDate(date) {
  const target = new Date(`${date}T00:00:00`);
  return `${target.getMonth() + 1}/${target.getDate()}`;
}

function formatDateISO(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function weekdayLabel(date) {
  return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()];
}

function enterEditMode(item) {
  if (!currentUser) {
    setFormMessage("请先登录。");
    return;
  }

  editingId = item.id;
  form.elements.date.value = item.date;
  form.elements.title.value = item.title;
  form.elements.link.value = item.link || "";
  form.elements.cost.value = String(item.cost ?? 0);
  form.elements.notes.value = item.notes || "";
  form.elements.image.value = "";
  formStatus.hidden = false;
  formStatusText.textContent = `正在编辑：${item.title}`;
  submitButton.textContent = "保存修改";
  imageLabel.textContent = "替换预览图（可选）";
  form.elements.image.required = false;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function exitEditMode(resetForm = true) {
  editingId = null;

  if (resetForm) {
    form.reset();
  }

  formStatus.hidden = true;
  formStatusText.textContent = "";
  submitButton.textContent = "添加到时间轴";
  imageLabel.textContent = "网站预览图";
  form.elements.image.required = true;
}

function applyAuthState() {
  const signedIn = Boolean(currentUser);
  const disabled = !signedIn;

  for (const element of form.elements) {
    if (element instanceof HTMLElement) {
      element.disabled = disabled;
    }
  }

  resetButton.disabled = disabled;
  cancelEditButton.disabled = disabled;
  signOutButton.hidden = !signedIn;
  authSubmitButton.hidden = signedIn;
  authForm.elements.email.disabled = signedIn;
  authForm.elements.email.value = signedIn ? currentUser.email ?? "" : "";
  authHint.textContent = signedIn
    ? "当前已登录，页面只读取和写入这个邮箱名下的数据。"
    : "用邮箱 Magic Link 登录。登录后才能新增、编辑和删除云端记录。";
  authStatus.textContent = signedIn
    ? `已登录：${currentUser.email ?? "未知邮箱"}`
    : "未登录。请输入邮箱接收登录链接。";

  if (!signedIn) {
    formStatus.hidden = false;
    formStatusText.textContent = "请先登录后再使用云端写入。";
  } else if (!editingId) {
    formStatus.hidden = true;
    formStatusText.textContent = "";
  }
}

function clearAuthParams() {
  const cleanUrl = `${window.location.origin}${window.location.pathname}`;
  window.history.replaceState({}, document.title, cleanUrl);
}

function createPlaceholder(dateLabel, title) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 640">
      <defs>
        <linearGradient id="bg" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stop-color="#faf5ea"/>
          <stop offset="100%" stop-color="#e8dcc7"/>
        </linearGradient>
      </defs>
      <rect width="960" height="640" rx="44" fill="url(#bg)"/>
      <rect x="56" y="52" width="848" height="84" rx="24" fill="rgba(28,26,23,0.08)"/>
      <rect x="56" y="176" width="410" height="336" rx="30" fill="rgba(255,255,255,0.72)"/>
      <rect x="494" y="176" width="410" height="150" rx="30" fill="rgba(28,26,23,0.84)"/>
      <rect x="494" y="362" width="410" height="150" rx="30" fill="rgba(255,255,255,0.72)"/>
      <text x="92" y="112" font-size="36" font-family="Avenir Next, PingFang SC, sans-serif" fill="#2f2a24">${dateLabel}</text>
      <text x="92" y="270" font-size="54" font-family="Avenir Next, PingFang SC, sans-serif" fill="#2f2a24">${title}</text>
      <text x="92" y="328" font-size="28" font-family="Avenir Next, PingFang SC, sans-serif" fill="#74685c">Preview placeholder</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
