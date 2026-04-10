/* ═══════════════════════════════════════════════════
   Connect with DA — Application Logic
   ═══════════════════════════════════════════════════ */

(function () {
  "use strict";

  /* ─── Configuration ─── */
  const CONFIG = {
    calUsername: "meetwithda",
    calOrigin: "https://cal.com",
    apiBase: "/api",
    eventTypes: {
      454747: {
        slug: "discovery",
        title: "$25k Discovery Call with DA",
        shortTitle: "Discovery Call",
        durations: [60, 120, 180],
        defaultDuration: 180,
      },
      454745: {
        slug: "online-meeting",
        title: "Online Meeting with DA",
        shortTitle: "Online Meeting",
        durations: [60, 120],
        defaultDuration: 120,
      },
    },
  };

  /* ─── State ─── */
  const state = {
    selectedEventId: null,
    selectedDuration: null,
    selectedDate: null,
    selectedSlot: null,
    weekStart: null,
    slots: {},
    loading: false,
  };

  /* ─── DOM References ─── */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const dom = {
    meetingCards: $$(".meeting-card"),
    durationSection: $("#durationSection"),
    durationGrid: $("#durationGrid"),
    calendarSection: $("#calendarSection"),
    calendarMonth: $("#calendarMonth"),
    calendarWeek: $("#calendarWeek"),
    prevWeek: $("#prevWeek"),
    nextWeek: $("#nextWeek"),
    tzBadge: $("#tzBadge"),
    timeslotsPrompt: $("#timeslotsPrompt"),
    timeslotsLoading: $("#timeslotsLoading"),
    timeslotsGrid: $("#timeslotsGrid"),
    timeslotsEmpty: $("#timeslotsEmpty"),
    bookingSection: $("#bookingSection"),
    bookingSummary: $("#bookingSummary"),
    bookBtn: $("#bookBtn"),
    backBtn: $("#backBtn"),
    footerYear: $("#footerYear"),
  };

  /* ─── Helpers ─── */
  const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  function getUserTimezone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (_) {
      return "America/Los_Angeles";
    }
  }

  function formatTime(isoString) {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  function formatDateLong(date) {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  function toDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  function isToday(date) {
    const now = new Date();
    return toDateKey(date) === toDateKey(now);
  }

  function isPast(date) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return date < now;
  }

  function show(el) {
    el.classList.remove("hidden");
    el.classList.add("section-enter");
  }

  function hide(el) {
    el.classList.add("hidden");
    el.classList.remove("section-enter");
  }

  /* ─── API ─── */
  async function fetchSlots(eventTypeId, startDate, endDate) {
    const tz = getUserTimezone();
    const url =
      `${CONFIG.apiBase}/slots?eventTypeId=${eventTypeId}` +
      `&startTime=${startDate.toISOString()}` +
      `&endTime=${endDate.toISOString()}` +
      `&duration=${state.selectedDuration || ""}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json.data?.slots || json.slots || {};
    } catch (err) {
      console.error("Failed to fetch slots:", err);
      return {};
    }
  }

  /* ─── Render: Duration Selector ─── */
  function renderDurations() {
    const cfg = CONFIG.eventTypes[state.selectedEventId];
    if (!cfg || cfg.durations.length <= 1) {
      hide(dom.durationSection);
      state.selectedDuration = cfg ? cfg.defaultDuration : null;
      return;
    }

    dom.durationGrid.innerHTML = "";
    cfg.durations.forEach((dur) => {
      const btn = document.createElement("button");
      btn.className = "duration-btn" + (dur === state.selectedDuration ? " active" : "");
      btn.textContent = dur >= 60 ? `${dur / 60} hr${dur > 60 ? "s" : ""}` : `${dur} min`;
      btn.setAttribute("aria-label", btn.textContent);
      btn.addEventListener("click", () => {
        state.selectedDuration = dur;
        state.selectedSlot = null;
        renderDurations();
        loadWeekSlots();
      });
      dom.durationGrid.appendChild(btn);
    });

    show(dom.durationSection);
  }

  /* ─── Render: Calendar ─── */
  function renderCalendar() {
    const ws = state.weekStart;
    if (!ws) return;

    /* Month label — show range if week spans two months */
    const weekEnd = addDays(ws, 6);
    if (ws.getMonth() === weekEnd.getMonth()) {
      dom.calendarMonth.textContent = `${MONTH_NAMES[ws.getMonth()]} ${ws.getFullYear()}`;
    } else {
      dom.calendarMonth.textContent =
        `${MONTH_NAMES[ws.getMonth()].slice(0, 3)} – ${MONTH_NAMES[weekEnd.getMonth()]} ${weekEnd.getFullYear()}`;
    }

    /* Disable prev if week is in the past */
    const thisWeekStart = getWeekStart(new Date());
    dom.prevWeek.disabled = ws <= thisWeekStart;

    /* Days */
    dom.calendarWeek.innerHTML = "";
    for (let i = 0; i < 7; i++) {
      const day = addDays(ws, i);
      const key = toDateKey(day);
      const hasSlots = state.slots[key] && state.slots[key].length > 0;
      const past = isPast(day);
      const available = hasSlots && !past;

      const btn = document.createElement("button");
      btn.className = "calendar__day";
      if (available) btn.classList.add("calendar__day--available");
      else btn.classList.add("calendar__day--unavailable");
      if (isToday(day)) btn.classList.add("calendar__day--today");
      if (state.selectedDate && toDateKey(state.selectedDate) === key) {
        btn.classList.add("calendar__day--selected");
      }
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-selected", state.selectedDate && toDateKey(state.selectedDate) === key ? "true" : "false");
      btn.setAttribute("aria-label", `${DAY_NAMES[day.getDay()]} ${day.getDate()}${available ? "" : " (unavailable)"}`);

      btn.innerHTML = `
        <span class="calendar__day-label">${DAY_NAMES[day.getDay()]}</span>
        <span class="calendar__day-num">${day.getDate()}</span>
      `;

      if (available) {
        btn.addEventListener("click", () => selectDate(day));
      }

      dom.calendarWeek.appendChild(btn);
    }
  }

  /* ─── Render: Time Slots ─── */
  function renderTimeSlots() {
    if (!state.selectedDate) {
      show(dom.timeslotsPrompt);
      hide(dom.timeslotsGrid);
      hide(dom.timeslotsEmpty);
      hide(dom.timeslotsLoading);
      return;
    }

    const key = toDateKey(state.selectedDate);
    const daySlots = state.slots[key] || [];

    hide(dom.timeslotsPrompt);
    hide(dom.timeslotsLoading);

    if (daySlots.length === 0) {
      hide(dom.timeslotsGrid);
      show(dom.timeslotsEmpty);
      return;
    }

    hide(dom.timeslotsEmpty);
    dom.timeslotsGrid.innerHTML = "";

    daySlots.forEach((slot) => {
      const btn = document.createElement("button");
      btn.className = "timeslot-btn";
      if (state.selectedSlot === slot.time) btn.classList.add("active");
      btn.textContent = formatTime(slot.time);
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-selected", state.selectedSlot === slot.time ? "true" : "false");
      btn.addEventListener("click", () => selectSlot(slot.time));
      dom.timeslotsGrid.appendChild(btn);
    });

    show(dom.timeslotsGrid);
  }

  /* ─── Render: Booking Summary ─── */
  function renderBookingSummary() {
    if (!state.selectedSlot || !state.selectedEventId) {
      hide(dom.bookingSection);
      return;
    }

    const cfg = CONFIG.eventTypes[state.selectedEventId];
    const slotDate = new Date(state.selectedSlot);
    const durLabel = state.selectedDuration >= 60
      ? `${state.selectedDuration / 60} hour${state.selectedDuration > 60 ? "s" : ""}`
      : `${state.selectedDuration} minutes`;

    dom.bookingSummary.innerHTML = `
      <p class="booking-summary__type">${cfg.shortTitle}</p>
      <p class="booking-summary__datetime">${formatDateLong(slotDate)} at ${formatTime(state.selectedSlot)}</p>
      <p class="booking-summary__duration">${durLabel} &middot; ${getUserTimezone()}</p>
    `;

    show(dom.bookingSection);

    /* Smooth scroll to booking section */
    dom.bookingSection.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  /* ─── Actions ─── */
  function selectMeetingType(eventId) {
    state.selectedEventId = eventId;
    state.selectedDate = null;
    state.selectedSlot = null;

    const cfg = CONFIG.eventTypes[eventId];
    state.selectedDuration = cfg.defaultDuration;

    /* Update active card */
    dom.meetingCards.forEach((card) => {
      card.classList.toggle("active", card.dataset.eventId === String(eventId));
    });

    /* Show duration & calendar */
    renderDurations();
    show(dom.calendarSection);
    hide(dom.bookingSection);

    /* Set week and load slots */
    state.weekStart = getWeekStart(new Date());
    loadWeekSlots();

    /* Scroll to calendar */
    dom.calendarSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function selectDate(date) {
    state.selectedDate = date;
    state.selectedSlot = null;
    renderCalendar();
    renderTimeSlots();
    hide(dom.bookingSection);
  }

  function selectSlot(slotTime) {
    state.selectedSlot = slotTime;
    renderTimeSlots();
    renderBookingSummary();
  }

  async function loadWeekSlots() {
    if (!state.selectedEventId || !state.weekStart) return;

    state.loading = true;
    hide(dom.timeslotsPrompt);
    hide(dom.timeslotsGrid);
    hide(dom.timeslotsEmpty);
    show(dom.timeslotsLoading);

    const start = state.weekStart;
    const end = addDays(start, 7);

    state.slots = await fetchSlots(state.selectedEventId, start, end);
    state.loading = false;

    /* Re-render */
    renderCalendar();

    /* If a date was selected, check if it still has slots */
    if (state.selectedDate) {
      renderTimeSlots();
    } else {
      hide(dom.timeslotsLoading);
      show(dom.timeslotsPrompt);
    }
  }

  function navigateWeek(delta) {
    state.weekStart = addDays(state.weekStart, delta * 7);
    state.selectedDate = null;
    state.selectedSlot = null;
    hide(dom.bookingSection);
    loadWeekSlots();
  }

  function openCalBooking() {
    if (!state.selectedSlot || !state.selectedEventId) return;

    const cfg = CONFIG.eventTypes[state.selectedEventId];
    const slotDate = state.selectedSlot.split("T")[0];
    const calLink = `${CONFIG.calUsername}/${cfg.slug}`;

    /* Build Cal.com URL params for pre-selection */
    const params = new URLSearchParams({
      date: slotDate,
      slot: state.selectedSlot,
    });

    if (state.selectedDuration) {
      params.set("duration", state.selectedDuration);
    }

    /* Use Cal.com embed modal */
    if (window.Cal && window.Cal.ns && window.Cal.ns.booking) {
      window.Cal.ns.booking("modal", {
        calLink: `${calLink}?${params.toString()}`,
        config: {
          theme: "dark",
          layout: "month_view",
          styles: {
            branding: { brandColor: "#c9a84c" },
          },
        },
      });
    } else {
      /* Fallback: open Cal.com in new tab */
      window.open(`${CONFIG.calOrigin}/${calLink}?${params.toString()}`, "_blank");
    }
  }

  function resetSelection() {
    state.selectedDate = null;
    state.selectedSlot = null;
    hide(dom.bookingSection);
    renderCalendar();
    renderTimeSlots();
    dom.calendarSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ─── Initialization ─── */
  function init() {
    /* Footer year */
    dom.footerYear.textContent = new Date().getFullYear();

    /* Timezone badge */
    dom.tzBadge.textContent = getUserTimezone().replace(/_/g, " ");

    /* Meeting card clicks */
    dom.meetingCards.forEach((card) => {
      card.addEventListener("click", () => {
        selectMeetingType(parseInt(card.dataset.eventId, 10));
      });
    });

    /* Calendar navigation */
    dom.prevWeek.addEventListener("click", () => navigateWeek(-1));
    dom.nextWeek.addEventListener("click", () => navigateWeek(1));

    /* Booking buttons */
    dom.bookBtn.addEventListener("click", openCalBooking);
    dom.backBtn.addEventListener("click", resetSelection);
  }

  /* ─── Start ─── */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
