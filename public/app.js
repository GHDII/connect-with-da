/* ═══════════════════════════════════════════════════
   Connect with DA — Application Logic v4
   Premium scheduling — closely aligned with reference
   ═══════════════════════════════════════════════════ */

(function () {
  "use strict";

  /* ─── Config ─── */
  const CONFIG = {
    calUsername: "meetwithda",
    calOrigin: "https://cal.com",
    apiBase: "/api",
    daTz: "America/Los_Angeles",
    maxWeeksForward: 12,
    eventTypes: {
      454747: {
        slug: "discovery",
        title: "$25k Discovery Call with DA",
        shortTitle: "Discovery Call",
        durations: [60, 120, 180],
        defaultDuration: 180,
        paid: true,
        price: "$25,000",
      },
      454745: {
        slug: "online-meeting",
        title: "Online Meeting with DA",
        shortTitle: "Online Meeting",
        durations: [60, 120],
        defaultDuration: 120,
        paid: false,
      },
    },
  };

  /* ─── State ─── */
  const state = {
    eventId: null,
    duration: null,
    date: null,
    slot: null,
    weekStart: null,
    slots: {},
    apiAvailable: true,
    embedLoaded: {},
  };

  /* ─── DOM ─── */
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  const dom = {
    viewSelection: $("#viewSelection"),
    viewPayment: $("#viewPayment"),
    viewBooking: $("#viewBooking"),
    viewEmbed: $("#viewEmbed"),
    options: $$("#meetingOptions .option-card"),
    stepDuration: $("#stepDuration"),
    durationPills: $("#durationPills"),
    stepDateTime: $("#stepDateTime"),
    calMonth: $("#calMonth"),
    calStrip: $("#calStrip"),
    prevWeek: $("#prevWeek"),
    nextWeek: $("#nextWeek"),
    timesHeading: $("#timesHeading"),
    timesDateLabel: $("#timesDateLabel"),
    timesLoading: $("#timesLoading"),
    timesPrompt: $("#timesPrompt"),
    timesGrid: $("#timesGrid"),
    timesEmpty: $("#timesEmpty"),
    tzCompare: $("#tzCompare"),
    tzVisitorLabel: $("#tzVisitorLabel"),
    tzVisitorTime: $("#tzVisitorTime"),
    tzVisitorDate: $("#tzVisitorDate"),
    tzDaTime: $("#tzDaTime"),
    tzDaDate: $("#tzDaDate"),
    tzOffset: $("#tzOffset"),
    confirmBar: $("#confirmBar"),
    bookBtn: $("#bookBtn"),
    backBtn: $("#backBtn"),
    backFromPayment: $("#backFromPayment"),
    payBtn: $("#payBtn"),
    paymentRecap: $("#paymentRecap"),
    bookingRecap: $("#bookingRecap"),
    calEmbedWrap: $("#calEmbedWrap"),
    calEmbedInline: $("#calEmbedInline"),
    year: $("#year"),
  };

  /* ─── Helpers ─── */
  const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  function visitorTz() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone; }
    catch (_) { return "America/New_York"; }
  }

  function tzAbbrev(tz) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        timeZoneName: "short",
      }).formatToParts(new Date());
      const tzPart = parts.find((p) => p.type === "timeZoneName");
      return tzPart ? tzPart.value : tz.split("/").pop().replace(/_/g, " ");
    } catch (_) {
      return tz.split("/").pop().replace(/_/g, " ");
    }
  }

  function fmtTime(iso) {
    return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
  }

  function fmtTimeInTz(iso, tz) {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: tz,
    });
  }

  function fmtDateInTz(iso, tz) {
    return new Date(iso).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: tz,
    });
  }

  function fmtDateLong(d) {
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  }

  function fmtDateShort(d) {
    return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  }

  function fmtDateUppercase(d) {
    return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }).toUpperCase();
  }

  function dateKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }

  function getWeekStart(d) {
    const w = new Date(d);
    w.setDate(w.getDate() - w.getDay());
    w.setHours(0, 0, 0, 0);
    return w;
  }

  function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function isToday(d) { return dateKey(d) === dateKey(new Date()); }
  function isPast(d) { const n = new Date(); n.setHours(0,0,0,0); return d < n; }

  function show(el) { if (el) { el.classList.remove("hidden"); } }
  function hide(el) { if (el) { el.classList.add("hidden"); } }

  function showSection(el) {
    if (el) {
      el.classList.remove("section--hidden");
      el.classList.add("section--visible");
    }
  }

  function hideSection(el) {
    if (el) {
      el.classList.add("section--hidden");
      el.classList.remove("section--visible");
    }
  }

  function switchView(target) {
    [dom.viewSelection, dom.viewPayment, dom.viewBooking, dom.viewEmbed].forEach((v) => {
      if (v) v.classList.remove("view--active");
    });
    target.classList.add("view--active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ─── API ─── */
  async function fetchSlots(eventTypeId, start, end) {
    let url = `${CONFIG.apiBase}/slots?eventTypeId=${eventTypeId}&startTime=${start.toISOString()}&endTime=${end.toISOString()}`;
    if (state.duration) {
      url += `&duration=${state.duration}`;
    }
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.status === "error") throw new Error(json.message || "API error");
      state.apiAvailable = true;
      return json.data?.slots || json.slots || {};
    } catch (err) {
      console.warn("API proxy unavailable:", err.message);
      state.apiAvailable = false;
      return null;
    }
  }

  /* ─── Embed Fallback ─── */
  function showEmbedFallback() {
    const cfg = CONFIG.eventTypes[state.eventId];
    if (!cfg) return;

    const key = cfg.slug;
    if (!state.embedLoaded[key]) {
      dom.calEmbedInline.innerHTML = "";
      if (window.Cal && window.Cal.ns) {
        const ns = "embed-" + cfg.slug;
        Cal("init", ns, { origin: CONFIG.calOrigin });
        Cal.ns[ns]("inline", {
          elementOrSelector: "#calEmbedInline",
          calLink: `${CONFIG.calUsername}/${cfg.slug}`,
          config: { theme: "dark", styles: { branding: { brandColor: "#c4a265" } } },
        });
        Cal.ns[ns]("ui", { theme: "dark", styles: { branding: { brandColor: "#c4a265" } } });
      } else {
        dom.calEmbedInline.innerHTML = `<a href="${CONFIG.calOrigin}/${CONFIG.calUsername}/${cfg.slug}" target="_blank" class="btn-confirm" style="display:inline-flex;text-align:center;text-decoration:none;margin-top:1rem">Open Booking Page</a>`;
      }
      state.embedLoaded[key] = true;
    }

    switchView(dom.viewEmbed);
  }

  /* ─── Render: Duration Pills ─── */
  function renderDurations() {
    const cfg = CONFIG.eventTypes[state.eventId];
    if (!cfg || cfg.durations.length <= 1) {
      hideSection(dom.stepDuration);
      state.duration = cfg ? cfg.defaultDuration : null;
      return;
    }

    dom.durationPills.innerHTML = "";
    cfg.durations.forEach((dur) => {
      const btn = document.createElement("button");
      btn.className = "pill" + (dur === state.duration ? " pill--active" : "");
      if (dur >= 60) {
        const hrs = dur / 60;
        btn.textContent = `${hrs} hr${hrs > 1 ? "s" : ""}`;
      } else {
        btn.textContent = `${dur} min`;
      }
      btn.addEventListener("click", () => {
        state.duration = dur;
        state.slot = null;
        renderDurations();
        hide(dom.confirmBar);
        hide(dom.tzCompare);
        loadWeekSlots();
      });
      dom.durationPills.appendChild(btn);
    });

    showSection(dom.stepDuration);
  }

  /* ─── Render: Calendar Strip ─── */
  function renderCalendar() {
    const ws = state.weekStart;
    if (!ws) return;

    const we = addDays(ws, 6);
    dom.calMonth.textContent = ws.getMonth() === we.getMonth()
      ? `${MONTHS[ws.getMonth()]} ${ws.getFullYear()}`
      : ws.getFullYear() === we.getFullYear()
        ? `${MONTHS[ws.getMonth()].slice(0,3)} \u2013 ${MONTHS[we.getMonth()]} ${we.getFullYear()}`
        : `${MONTHS[ws.getMonth()].slice(0,3)} ${ws.getFullYear()} \u2013 ${MONTHS[we.getMonth()].slice(0,3)} ${we.getFullYear()}`;

    /* Navigation limits */
    dom.prevWeek.disabled = ws <= getWeekStart(new Date());
    const maxWeek = addDays(getWeekStart(new Date()), CONFIG.maxWeeksForward * 7);
    dom.nextWeek.disabled = ws >= maxWeek;

    dom.calStrip.innerHTML = "";
    for (let i = 0; i < 7; i++) {
      const d = addDays(ws, i);
      const k = dateKey(d);
      const hasSlots = state.slots[k] && state.slots[k].length > 0;
      const past = isPast(d);
      const avail = hasSlots && !past;
      const selected = state.date && dateKey(state.date) === k;

      const cell = document.createElement("button");
      cell.className = "day";
      if (avail) cell.classList.add("day--available");
      if (selected) cell.classList.add("day--selected");
      if (isToday(d)) cell.classList.add("day--today");
      cell.setAttribute("role", "option");
      cell.setAttribute("aria-selected", selected ? "true" : "false");
      cell.setAttribute("aria-label", `${DAYS[d.getDay()]} ${d.getDate()}${avail ? "" : " (unavailable)"}`);

      cell.innerHTML = `
        <span class="day__label">${DAYS[d.getDay()]}</span>
        <span class="day__num">${d.getDate()}</span>
      `;

      if (avail) {
        cell.addEventListener("click", () => selectDate(d));
      }

      dom.calStrip.appendChild(cell);
    }
  }

  /* ─── Render: Time Grid ─── */
  function renderTimes() {
    if (!state.date) {
      show(dom.timesPrompt);
      hide(dom.timesGrid);
      hide(dom.timesEmpty);
      hide(dom.timesLoading);
      hide(dom.timesHeading);
      return;
    }

    const k = dateKey(state.date);
    const daySlots = state.slots[k] || [];

    hide(dom.timesPrompt);
    hide(dom.timesLoading);

    if (daySlots.length === 0) {
      hide(dom.timesGrid);
      hide(dom.timesHeading);
      show(dom.timesEmpty);
      return;
    }

    hide(dom.timesEmpty);

    /* Show "Select Time" heading with date label */
    dom.timesDateLabel.textContent = fmtDateUppercase(state.date);
    show(dom.timesHeading);

    dom.timesGrid.innerHTML = "";

    daySlots.forEach((slot, idx) => {
      const btn = document.createElement("button");
      btn.className = "time-btn";
      if (state.slot === slot.time) btn.classList.add("time-btn--active");
      btn.textContent = fmtTime(slot.time);
      btn.style.animationDelay = `${idx * 0.04}s`;
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-selected", state.slot === slot.time ? "true" : "false");
      btn.addEventListener("click", () => selectSlot(slot.time));
      dom.timesGrid.appendChild(btn);
    });

    show(dom.timesGrid);
  }

  /* ─── Render: Timezone Comparison ─── */
  function renderTimezone() {
    if (!state.slot) {
      hide(dom.tzCompare);
      return;
    }

    const vTz = visitorTz();
    const dTz = CONFIG.daTz;

    /* Display times in each timezone */
    const visitorTime = fmtTimeInTz(state.slot, vTz);
    const daTime = fmtTimeInTz(state.slot, dTz);
    const visitorDateStr = fmtDateInTz(state.slot, vTz);
    const daDateStr = fmtDateInTz(state.slot, dTz);

    /* Timezone abbreviations */
    const vAbbrev = tzAbbrev(vTz);

    dom.tzVisitorLabel.textContent = `YOUR TIME (${vAbbrev})`;
    dom.tzVisitorTime.textContent = visitorTime;
    dom.tzDaTime.textContent = daTime;

    /* Show dates */
    dom.tzVisitorDate.textContent = visitorDateStr;
    dom.tzDaDate.textContent = daDateStr;

    /* Calculate offset */
    const slotDate = new Date(state.slot);
    const vOffset = getUtcOffset(vTz, slotDate);
    const dOffset = getUtcOffset(dTz, slotDate);
    const diff = Math.abs(vOffset - dOffset);
    const diffHrs = Math.floor(diff);
    const diffMins = Math.round((diff - diffHrs) * 60);
    dom.tzOffset.textContent = diffMins > 0 ? `${diffHrs}h ${diffMins}m` : `${diffHrs} hr`;

    /* Don't show comparison if same timezone */
    if (vTz === dTz) {
      hide(dom.tzCompare);
      return;
    }

    show(dom.tzCompare);
  }

  function getUtcOffset(tz, date) {
    const utcStr = date.toLocaleString("en-US", { timeZone: "UTC" });
    const tzStr = date.toLocaleString("en-US", { timeZone: tz });
    const utcDate = new Date(utcStr);
    const tzDate = new Date(tzStr);
    return (tzDate - utcDate) / (1000 * 60 * 60);
  }

  /* ─── Render: Booking Recap Card ─── */
  function buildRecapHTML() {
    const cfg = CONFIG.eventTypes[state.eventId];
    const slotObj = new Date(state.slot);
    const durLabel = state.duration >= 60
      ? `${state.duration / 60} hr${state.duration > 60 ? "s" : ""}`
      : `${state.duration} min`;

    return `
      <div class="booking-recap__icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      </div>
      <div class="booking-recap__text">
        <p class="booking-recap__type">${cfg.shortTitle}</p>
        <p class="booking-recap__datetime">${fmtDateLong(slotObj)} at ${fmtTime(state.slot)} &middot; ${durLabel}</p>
      </div>
    `;
  }

  /* ─── Actions ─── */
  function selectMeeting(eventId) {
    state.eventId = eventId;
    state.date = null;
    state.slot = null;

    const cfg = CONFIG.eventTypes[eventId];
    state.duration = cfg.defaultDuration;

    dom.options.forEach((o) => {
      o.classList.toggle("option-card--active", o.dataset.eventId === String(eventId));
    });

    renderDurations();
    showSection(dom.stepDateTime);
    hide(dom.confirmBar);
    hide(dom.tzCompare);

    state.weekStart = getWeekStart(new Date());
    loadWeekSlots();

    const hasDurations = cfg.durations.length > 1;
    (hasDurations ? dom.stepDuration : dom.stepDateTime).scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function selectDate(d) {
    state.date = d;
    state.slot = null;
    renderCalendar();
    renderTimes();
    hide(dom.confirmBar);
    hide(dom.tzCompare);
  }

  function selectSlot(time) {
    state.slot = time;
    renderTimes();
    renderTimezone();
    show(dom.confirmBar);
    dom.confirmBar.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function loadWeekSlots() {
    if (!state.eventId || !state.weekStart) return;

    hide(dom.timesPrompt);
    hide(dom.timesGrid);
    hide(dom.timesEmpty);
    hide(dom.timesHeading);
    show(dom.timesLoading);

    const result = await fetchSlots(state.eventId, state.weekStart, addDays(state.weekStart, 7));

    if (result === null) {
      hide(dom.timesLoading);
      showEmbedFallback();
      return;
    }

    state.slots = result;
    renderCalendar();

    if (state.date) {
      renderTimes();
    } else {
      hide(dom.timesLoading);
      show(dom.timesPrompt);
    }
  }

  function navWeek(delta) {
    state.weekStart = addDays(state.weekStart, delta * 7);
    state.date = null;
    state.slot = null;
    hide(dom.confirmBar);
    hide(dom.tzCompare);
    loadWeekSlots();
  }

  function openBooking() {
    if (!state.slot || !state.eventId) return;

    const cfg = CONFIG.eventTypes[state.eventId];

    /* If paid event, go to payment page first */
    if (cfg.paid) {
      dom.paymentRecap.innerHTML = buildRecapHTML();
      switchView(dom.viewPayment);
      return;
    }

    /* Otherwise go straight to booking */
    goToBookingPage();
  }

  function goToBookingPage() {
    const cfg = CONFIG.eventTypes[state.eventId];
    const slotDate = state.slot.split("T")[0];
    const calLink = `${CONFIG.calUsername}/${cfg.slug}`;
    const params = new URLSearchParams({ date: slotDate, slot: state.slot });
    if (state.duration) params.set("duration", state.duration);

    dom.bookingRecap.innerHTML = buildRecapHTML();

    /* Switch to booking view */
    switchView(dom.viewBooking);

    /* Use Cal.com embed inline on booking page */
    if (window.Cal && window.Cal.ns && window.Cal.ns.booking) {
      dom.calEmbedWrap.innerHTML = "";
      window.Cal.ns.booking("inline", {
        elementOrSelector: "#calEmbedWrap",
        calLink: `${calLink}?${params.toString()}`,
        config: {
          theme: "dark",
          layout: "month_view",
          styles: { branding: { brandColor: "#c4a265" } },
        },
      });
    } else {
      window.open(`${CONFIG.calOrigin}/${calLink}?${params.toString()}`, "_blank");
    }
  }

  function handlePayment() {
    /* Dummy payment processing — will be replaced with Stripe */
    const nameInput = $("#cardName");
    const numberInput = $("#cardNumber");
    const expiryInput = $("#cardExpiry");
    const cvcInput = $("#cardCvc");

    /* Basic validation */
    const fields = [nameInput, numberInput, expiryInput, cvcInput];
    let valid = true;
    fields.forEach((f) => {
      if (!f.value.trim()) {
        f.style.borderColor = "#e74c3c";
        valid = false;
      } else {
        f.style.borderColor = "";
      }
    });

    if (!valid) return;

    /* Simulate payment processing */
    dom.payBtn.textContent = "Processing...";
    dom.payBtn.disabled = true;

    setTimeout(() => {
      dom.payBtn.innerHTML = 'Pay & Continue <span>&rarr;</span>';
      dom.payBtn.disabled = false;
      goToBookingPage();
    }, 1500);
  }

  /* Card number formatting */
  function formatCardNumber(input) {
    let value = input.value.replace(/\D/g, "");
    value = value.replace(/(\d{4})(?=\d)/g, "$1 ");
    input.value = value.substring(0, 19);
  }

  function formatExpiry(input) {
    let value = input.value.replace(/\D/g, "");
    if (value.length >= 2) {
      value = value.substring(0, 2) + " / " + value.substring(2);
    }
    input.value = value.substring(0, 7);
  }

  /* ─── Init ─── */
  function init() {
    dom.year.textContent = new Date().getFullYear();

    dom.options.forEach((o) => {
      o.addEventListener("click", () => selectMeeting(parseInt(o.dataset.eventId, 10)));
    });

    dom.prevWeek.addEventListener("click", () => navWeek(-1));
    dom.nextWeek.addEventListener("click", () => navWeek(1));
    dom.bookBtn.addEventListener("click", openBooking);
    dom.backBtn.addEventListener("click", () => switchView(dom.viewSelection));

    /* Payment page */
    if (dom.backFromPayment) {
      dom.backFromPayment.addEventListener("click", () => switchView(dom.viewSelection));
    }
    if (dom.payBtn) {
      dom.payBtn.addEventListener("click", handlePayment);
    }

    /* Card input formatting */
    const cardNumberInput = $("#cardNumber");
    const cardExpiryInput = $("#cardExpiry");
    if (cardNumberInput) {
      cardNumberInput.addEventListener("input", () => formatCardNumber(cardNumberInput));
    }
    if (cardExpiryInput) {
      cardExpiryInput.addEventListener("input", () => formatExpiry(cardExpiryInput));
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
