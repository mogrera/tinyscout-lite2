import type { HealthViewModel } from "./types";

type HealthLocale = "en" | "es";

interface HealthCopy {
  lessThanOneMinute: string;
  minute: string;
  minutes: (count: number) => string;
  hour: string;
  hours: (count: number) => string;
  serviceLive: string;
  serviceStale: string;
  serviceWaiting: string;
  setupComplete: string;
  setupCompleteBody: string;
  useUrl: string;
  savedIt: string;
  setupInitialized: string;
  setupInitializedBody: string;
  latestReading: string;
  receivedAgo: string;
  direction: string;
  noData: string;
  noReadings: string;
  configureUrl: string;
  latestTreatment: string;
  untypedTreatment: string;
  insulin: string;
  noInsulin: string;
  notes: string;
  noNotes: string;
  noTreatments: string;
  noTreatmentsBody: string;
  title: string;
  status: string;
  viewStatusJson: string;
  openSource: string;
  openSourceBody: string;
  viewRepository: string;
}

const COPY: Record<HealthLocale, HealthCopy> = {
  en: {
    lessThanOneMinute: "less than 1 minute",
    minute: "1 minute",
    minutes: (count) => `${count} minutes`,
    hour: "1 hour",
    hours: (count) => `${count} hours`,
    serviceLive: "Service active",
    serviceStale: "Service stale",
    serviceWaiting: "Waiting for data",
    setupComplete: "Setup complete",
    setupCompleteBody: "Save this secret code now. For security reasons it will only be shown this one time.",
    useUrl: "Use this xDrip+ URL:",
    savedIt: "I saved it",
    setupInitialized: "Setup already initialized",
    setupInitializedBody: "The one-time secret code screen has already been opened in another browser session.",
    latestReading: "Latest reading",
    receivedAgo: "Received",
    direction: "Direction",
    noData: "No data",
    noReadings: "No readings received yet.",
    configureUrl: "Configure xDrip+ with this URL:",
    latestTreatment: "Latest treatment",
    untypedTreatment: "Untyped treatment",
    insulin: "Insulin",
    noInsulin: "No insulin",
    notes: "Notes",
    noNotes: "No notes",
    noTreatments: "No treatments received yet.",
    noTreatmentsBody: "GlucoEasy will show the most recent treatment here so this service can stay ready as a simple fallback.",
    title: "GlucoEasy",
    status: "Status",
    viewStatusJson: "View status data",
    openSource: "Secondary service purpose",
    openSourceBody: "GlucoEasy is designed as an easy secondary service for apps like xDrip+ and Zukkah, with free Cloudflare deployment.",
    viewRepository: "View repository"
  },
  es: {
    lessThanOneMinute: "menos de 1 minuto",
    minute: "1 minuto",
    minutes: (count) => `${count} minutos`,
    hour: "1 hora",
    hours: (count) => `${count} horas`,
    serviceLive: "Servicio activo",
    serviceStale: "Servicio sin datos recientes",
    serviceWaiting: "Esperando datos",
    setupComplete: "Configuracion completada",
    setupCompleteBody: "Guarda este codigo secreto ahora. Por seguridad solo se mostrara esta unica vez.",
    useUrl: "Usa esta URL de xDrip+:",
    savedIt: "Ya lo guarde",
    setupInitialized: "La configuracion ya fue inicializada",
    setupInitializedBody: "La pantalla del codigo secreto de un solo uso ya fue vista en otra sesion del navegador.",
    latestReading: "Ultima lectura",
    receivedAgo: "Recibido hace",
    direction: "Direccion",
    noData: "Sin datos",
    noReadings: "Todavia no se han recibido lecturas.",
    configureUrl: "Configura xDrip+ con esta URL:",
    latestTreatment: "Ultimo tratamiento",
    untypedTreatment: "Tratamiento sin tipo",
    insulin: "Insulina",
    noInsulin: "Sin insulina",
    notes: "Notas",
    noNotes: "Sin notas",
    noTreatments: "Todavia no se han recibido tratamientos.",
    noTreatmentsBody: "GlucoEasy mostrara aqui el tratamiento mas reciente para que este servicio este listo como respaldo sencillo.",
    title: "GlucoEasy",
    status: "Estado",
    viewStatusJson: "Ver datos de estado",
    openSource: "Finalidad del servicio",
    openSourceBody: "GlucoEasy esta pensado como servicio secundario para apps como xDrip+ y Zukkah, con despliegue gratis en Cloudflare y una instalacion muy simple.",
    viewRepository: "Ver repositorio"
  }
};

function formatElapsed(date: number, now: number, copy: HealthCopy): string {
  const deltaMs = Math.max(0, now - date);
  const minutes = Math.floor(deltaMs / 60000);

  if (minutes < 1) {
    return copy.lessThanOneMinute;
  }

  if (minutes === 1) {
    return copy.minute;
  }

  if (minutes < 60) {
    return copy.minutes(minutes);
  }

  const hours = Math.floor(minutes / 60);
  if (hours === 1) {
    return copy.hour;
  }

  return copy.hours(hours);
}

function directionToArrow(direction?: string, fallback?: string): string {
  const arrows: Record<string, string> = {
    DoubleUp: "⇈",
    SingleUp: "↑",
    FortyFiveUp: "↗",
    Flat: "→",
    FortyFiveDown: "↘",
    SingleDown: "↓",
    DoubleDown: "⇊",
    NONE: "•",
    None: "•",
    NOT_COMPUTABLE: "•",
    RATE_OUT_OF_RANGE: "•"
  };

  if (!direction) {
    return fallback ?? "";
  }

  return arrows[direction] ?? direction;
}

function directionTone(direction?: string): string {
  if (!direction) {
    return "is-muted";
  }

  if (["DoubleUp", "SingleUp", "FortyFiveUp"].includes(direction)) {
    return "is-up";
  }

  if (["Flat", "NONE", "None"].includes(direction)) {
    return "is-flat";
  }

  if (["FortyFiveDown", "SingleDown", "DoubleDown"].includes(direction)) {
    return "is-down";
  }

  return "is-muted";
}

function glucoseTone(sgv?: number): string {
  if (typeof sgv !== "number") {
    return "is-neutral";
  }

  if (sgv < 70) {
    return "is-low";
  }

  if (sgv > 180) {
    return "is-high";
  }

  return "is-range";
}

function formatDelta(delta: number | null | undefined): string | null {
  if (typeof delta !== "number" || !Number.isFinite(delta)) {
    return null;
  }

  return `${delta > 0 ? "+" : ""}${delta}`;
}

function deltaTone(delta: number | null | undefined): string {
  if (typeof delta !== "number" || !Number.isFinite(delta) || delta === 0) {
    return "is-neutral";
  }

  return delta > 0 ? "is-up" : "is-down";
}

function getServiceState(
  latestDate: number | undefined,
  refreshMs: number,
  copy: HealthCopy
): { tone: "live" | "stale" | "waiting"; label: string } {
  if (!latestDate) {
    return { tone: "waiting", label: copy.serviceWaiting };
  }

  const staleAfterMs = Math.max(refreshMs * 2, 5 * 60 * 1000);
  const ageMs = Date.now() - latestDate;
  if (ageMs <= staleAfterMs) {
    return { tone: "live", label: copy.serviceLive };
  }

  return { tone: "stale", label: copy.serviceStale };
}

export function renderHealthPage(view: HealthViewModel, locale: HealthLocale = "en"): string {
  const copy = COPY[locale];
  const exampleSecret = view.setupSecret ?? "YOUR_API_SECRET";
  const exampleUrl = `https://${exampleSecret}@${view.baseUrl.replace(/^https?:\/\//, "")}/api/v1/`;
  const acknowledgePath = locale === "es" ? "/es/setup/acknowledge" : "/setup/acknowledge";
  const pageTitle = view.latest ? `${view.latest.sgv} mg/dL | GlucoEasy` : "GlucoEasy";
  const latestAge = view.latest ? formatElapsed(view.latest.date, Date.now(), copy) : null;
  const latestTreatmentAge = view.latestTreatment ? formatElapsed(view.latestTreatment.mills, Date.now(), copy) : null;
  const latestDirection = directionToArrow(view.latest?.direction, copy.noData);
  const latestDirectionTone = directionTone(view.latest?.direction);
  const latestGlucoseTone = glucoseTone(view.latest?.sgv);
  const latestDelta = formatDelta(view.latestDelta);
  const latestDeltaTone = deltaTone(view.latestDelta);
  const refreshMs = Math.max(5000, (view.refreshSeconds ?? 30) * 1000);
  const serviceState = getServiceState(view.latest?.date, refreshMs, copy);
  const autoRefreshScript =
    view.setupSecret || view.setupPending
      ? ""
      : `
    <script>
      (() => {
        window.setTimeout(() => {
          window.location.reload();
        }, ${refreshMs});
      })();
    </script>
  `;
  const setupBlock = view.setupSecret
    ? `
      <section class="panel setup setup-ready">
        <div class="panel-header">
          <p class="eyebrow">Setup</p>
          <h2>${copy.setupComplete}</h2>
        </div>
        <p class="panel-copy">${copy.setupCompleteBody}</p>
        <code>${view.setupSecret}</code>
        <p class="hint">${copy.useUrl}</p>
        <code>${exampleUrl}</code>
        <form method="post" action="${acknowledgePath}">
          <button type="submit">${copy.savedIt}</button>
        </form>
      </section>
    `
    : view.setupPending
      ? `
      <section class="panel setup">
        <div class="panel-header">
          <p class="eyebrow">Setup</p>
          <h2>${copy.setupInitialized}</h2>
        </div>
        <p class="panel-copy">${copy.setupInitializedBody}</p>
      </section>
    `
      : "";
  const latestBlock = view.latest
    ? `
      <section class="panel reading-panel">
        <div class="panel-header">
          <p class="eyebrow">Glucose</p>
          <h2>${copy.latestReading}</h2>
        </div>
        <div class="reading-row">
          <div class="reading-value-group">
            <p class="reading ${latestGlucoseTone}">${view.latest.sgv} <span>mg/dL</span> <span class="direction-arrow ${latestDirectionTone}">${latestDirection}</span></p>
            ${latestDelta ? `<p class="reading-delta ${latestDeltaTone}">${latestDelta}</p>` : ""}
          </div>
          <div class="pill-stack">
            <p class="reading-meta">${copy.receivedAgo}: ${latestAge}</p>
          </div>
        </div>
      </section>
    `
    : `
      <section class="panel empty-panel">
        <div class="panel-header">
          <p class="eyebrow">Glucose</p>
          <h2>${copy.noReadings}</h2>
        </div>
        <p class="panel-copy">${copy.configureUrl}</p>
        <code>${exampleUrl}</code>
      </section>
    `;
  const latestTreatmentBlock = view.latestTreatment
    ? `
      <section class="panel treatment-panel">
        <div class="panel-header">
          <p class="eyebrow">Treatment</p>
          <h2>${copy.latestTreatment}</h2>
        </div>
        <div class="reading-row">
          <p class="reading treatment-reading">${
          typeof view.latestTreatment.insulin === "number"
            ? `${view.latestTreatment.insulin} <span>U</span>`
            : `<span>${copy.noInsulin}</span>`
        }</p>
          <div class="pill-stack">
            <p class="pill">${copy.receivedAgo}: ${latestTreatmentAge}</p>
          </div>
        </div>
        <p class="treatment-type">${view.latestTreatment.eventType || copy.untypedTreatment}</p>
        <div class="detail-grid treatment-details">
          <p class="detail-line">${copy.notes}: ${view.latestTreatment.notes ?? copy.noNotes}</p>
        </div>
      </section>
    `
    : `
      <section class="panel empty-panel">
        <div class="panel-header">
          <p class="eyebrow">Treatment</p>
          <h2>${copy.noTreatments}</h2>
        </div>
        <p class="panel-copy">${copy.noTreatmentsBody}</p>
      </section>
    `;

  return `<!doctype html>
<html lang="${locale}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${pageTitle}</title>
    <style>
      :root {
        color-scheme: light;
        --bg-top: #f5fbff;
        --bg-bottom: #eef4ec;
        --text: #193046;
        --muted: #5d7285;
        --line: rgba(25, 48, 70, 0.1);
        --panel: rgba(255, 255, 255, 0.82);
        --panel-strong: #ffffff;
        --shadow: 0 24px 60px rgba(27, 55, 79, 0.12);
        --blue: #1264c7;
        --blue-soft: #eaf4ff;
        --green: #1f8c5b;
        --green-soft: #ecfbf3;
        --gold: #f3b546;
      }
      * {
        box-sizing: border-box;
      }
      body {
        font-family: "Avenir Next", "Segoe UI", "Helvetica Neue", sans-serif;
        margin: 0;
        min-height: 100vh;
        padding: 2rem;
        background:
          radial-gradient(circle at top left, rgba(18, 100, 199, 0.14), transparent 28%),
          radial-gradient(circle at top right, rgba(31, 140, 91, 0.1), transparent 24%),
          linear-gradient(180deg, var(--bg-top) 0%, var(--bg-bottom) 100%);
        color: var(--text);
      }
      main {
        max-width: 58rem;
        margin: 0 auto;
        padding: 1.6rem;
        border-radius: 30px;
        background: rgba(255, 255, 255, 0.58);
        border: 1px solid rgba(255, 255, 255, 0.7);
        box-shadow: var(--shadow);
        backdrop-filter: blur(16px);
      }
      h1, h2, p {
        margin-top: 0;
      }
      h1 {
        margin-bottom: 0.35rem;
        font-size: clamp(1.7rem, 3vw, 2.3rem);
        line-height: 1.05;
        letter-spacing: -0.04em;
      }
      h2 {
        margin-bottom: 0;
        font-size: 1.25rem;
        letter-spacing: -0.02em;
      }
      .brand-bar {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        margin-bottom: 1rem;
        padding: 0.25rem 0 0;
      }
      .brand-lockup {
        display: inline-flex;
        align-items: center;
        gap: 0.85rem;
        padding: 0.9rem 1.1rem;
        border-radius: 18px;
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(234, 244, 255, 0.9));
        border: 1px solid rgba(18, 100, 199, 0.1);
        box-shadow: 0 12px 28px rgba(18, 100, 199, 0.08);
      }
      .brand-mark-dot {
        width: 0.95rem;
        height: 0.95rem;
        flex: 0 0 auto;
        border-radius: 999px;
        border: 0;
        padding: 0;
        cursor: default;
        background: linear-gradient(135deg, #7c8ea0, #5d7285);
        box-shadow: 0 0 0 0.32rem rgba(93, 114, 133, 0.14);
      }
      .brand-mark-dot.is-live {
        background: linear-gradient(135deg, #34c37a, #1f8c5b);
        box-shadow: 0 0 0 0.32rem rgba(31, 140, 91, 0.16);
      }
      .brand-mark-dot.is-stale {
        background: linear-gradient(135deg, #f3b546, #d97706);
        box-shadow: 0 0 0 0.32rem rgba(217, 119, 6, 0.14);
      }
      .brand-mark-dot.is-waiting {
        background: linear-gradient(135deg, #38a8ff, #1264c7);
        box-shadow: 0 0 0 0.32rem rgba(18, 100, 199, 0.14);
      }
      .brand-mark {
        margin: 0;
        color: var(--text);
        font-size: 1.15rem;
        font-weight: 900;
        letter-spacing: -0.03em;
        line-height: 1;
      }
      .brand-mark span {
        color: var(--blue);
      }
      .brand-mark small {
        color: var(--muted);
        font-size: 0.78rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        margin-left: 0.55rem;
        text-transform: uppercase;
      }
      .status-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.55rem;
        padding: 0.55rem 0.8rem;
        border-radius: 999px;
        background: rgba(31, 140, 91, 0.08);
        color: var(--green);
        font-size: 0.88rem;
        font-weight: 800;
        line-height: 1;
        white-space: nowrap;
      }
      .status-badge::before {
        content: "";
        width: 0.7rem;
        height: 0.7rem;
        border-radius: 999px;
        background: currentColor;
        box-shadow: 0 0 0 0.28rem rgba(31, 140, 91, 0.12);
      }
      .layout {
        display: grid;
        gap: 1rem;
        margin-top: 1rem;
      }
      .panel {
        padding: 1.4rem;
        border-radius: 22px;
        background: var(--panel);
        border: 1px solid var(--line);
        box-shadow: 0 10px 30px rgba(25, 48, 70, 0.05);
      }
      .status-panel {
        margin-top: 1rem;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.76), rgba(246, 250, 252, 0.9));
        border-color: rgba(18, 100, 199, 0.12);
      }
      .status-panel-top {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 0.9rem;
        margin-bottom: 1rem;
      }
      .status-heading {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }
      .status-title-row {
        display: flex;
        align-items: center;
        gap: 0.7rem;
        flex-wrap: wrap;
      }
      .system-name {
        margin: 0;
        font-size: 1.1rem;
        font-weight: 800;
        letter-spacing: -0.02em;
      }
      .status-card {
        padding: 1rem;
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.9);
        border: 1px solid rgba(18, 100, 199, 0.08);
      }
      .status-label {
        margin: 0 0 0.35rem;
        color: var(--muted);
        font-size: 0.8rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .repo-copy {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
      }
      .repo-copy p {
        margin: 0;
      }
      .repo-title {
        font-size: 1rem;
        font-weight: 800;
        letter-spacing: -0.02em;
        color: var(--text);
      }
      .repo-body {
        color: var(--muted);
        line-height: 1.5;
      }
      .status-actions {
        margin-top: 0.9rem;
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
      }
      .repo-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        margin-top: 1rem;
        background: linear-gradient(135deg, rgba(234, 244, 255, 0.92), rgba(236, 251, 243, 0.92));
        border-color: rgba(18, 100, 199, 0.12);
      }
      .status-link {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        padding: 0.75rem 0.95rem;
        border-radius: 999px;
        background: var(--blue-soft);
        color: var(--blue);
        font-weight: 800;
        text-decoration: none;
      }
      .repo-link {
        white-space: nowrap;
        background: rgba(255, 255, 255, 0.82);
        border: 1px solid rgba(18, 100, 199, 0.08);
      }
      .reading-panel {
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(238, 247, 255, 0.95));
        border-color: rgba(18, 100, 199, 0.12);
        box-shadow: 0 18px 40px rgba(18, 100, 199, 0.08);
      }
      .panel-header {
        margin-bottom: 0.9rem;
      }
      .eyebrow {
        margin-bottom: 0.45rem;
        color: var(--blue);
        font-size: 0.78rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.1em;
      }
      .panel-copy,
      .hint {
        color: var(--muted);
        line-height: 1.6;
      }
      .ok {
        color: var(--green);
        font-weight: 800;
      }
      .reading {
        margin: 0;
        font-size: clamp(2.5rem, 7vw, 4rem);
        font-weight: 900;
        letter-spacing: -0.06em;
        color: var(--text);
      }
      .reading span {
        color: var(--muted);
        font-size: 1.1rem;
        font-weight: 700;
        letter-spacing: 0;
      }
      .reading.is-low {
        color: #c2410c;
      }
      .reading.is-range {
        color: var(--green);
      }
      .reading.is-high {
        color: #b45309;
      }
      .reading.is-neutral {
        color: var(--text);
      }
      .treatment-reading {
        color: var(--blue);
      }
      .treatment-reading span {
        color: var(--blue);
      }
      .reading-row {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
      }
      .reading-value-group {
        display: flex;
        align-items: end;
        gap: 0.9rem;
        flex-wrap: wrap;
      }
      .pill-stack {
        display: flex;
        flex-wrap: wrap;
        gap: 0.7rem;
        justify-content: flex-end;
      }
      .reading-delta {
        margin: 0 0 0.45rem;
        padding: 0.45rem 0.8rem;
        border-radius: 999px;
        background: rgba(25, 48, 70, 0.08);
        color: var(--text);
        font-size: 1.05rem;
        font-weight: 800;
        line-height: 1;
      }
      .reading-delta.is-up {
        background: rgba(217, 119, 6, 0.12);
        color: #b45309;
      }
      .reading-delta.is-down {
        background: rgba(37, 99, 235, 0.12);
        color: #1d4ed8;
      }
      .reading-delta.is-neutral {
        background: rgba(25, 48, 70, 0.08);
        color: var(--muted);
      }
      .reading-meta {
        margin: 0;
        color: var(--muted);
        font-size: 1rem;
        font-weight: 700;
        line-height: 1.5;
      }
      .pill {
        margin: 0;
        padding: 0.75rem 0.95rem;
        border-radius: 999px;
        background: var(--blue-soft);
        color: var(--blue);
        font-weight: 700;
      }
      .direction-arrow {
        display: inline-block;
        min-width: 1.2em;
        text-align: center;
        font-size: 1em;
        font-weight: 900;
        line-height: 1;
        vertical-align: baseline;
      }
      .direction-arrow.is-up {
        color: #d97706;
      }
      .direction-arrow.is-flat {
        color: var(--green);
      }
      .direction-arrow.is-down {
        color: #2563eb;
      }
      .direction-arrow.is-muted {
        color: var(--muted);
      }
      .detail-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.8rem;
      }
      .treatment-type {
        margin: 1rem 0 0.85rem;
        font-size: 1.55rem;
        font-weight: 800;
        letter-spacing: -0.03em;
      }
      .treatment-details {
        grid-template-columns: 1fr;
      }
      .detail-line {
        margin: 0;
        padding: 1rem;
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.95);
        border: 1px solid var(--line);
        line-height: 1.5;
      }
      .detail-wide {
        grid-column: 1 / -1;
      }
      .setup {
        background: linear-gradient(180deg, #f4faff, #eef7ff);
        border-color: rgba(18, 100, 199, 0.18);
      }
      .setup-ready {
        background: linear-gradient(180deg, #f1fff7, #ebfbf3);
        border-color: rgba(31, 140, 91, 0.2);
      }
      .treatment-panel {
        background: linear-gradient(180deg, #f6fbff, #eef6ff);
        border-color: rgba(18, 100, 199, 0.16);
      }
      .empty-panel {
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.84), rgba(247, 250, 252, 0.92));
      }
      code {
        display: block;
        margin: 0.75rem 0 0;
        padding: 0.95rem 1rem;
        border-radius: 16px;
        background: #f4f8fc;
        border: 1px solid rgba(25, 48, 70, 0.08);
        overflow-wrap: anywhere;
        color: #23415f;
        font-family: "SFMono-Regular", "Cascadia Code", "Liberation Mono", monospace;
      }
      button {
        margin-top: 1rem;
        border: 0;
        border-radius: 999px;
        padding: 0.9rem 1.2rem;
        background: linear-gradient(135deg, #1670d8, #0b5dbb);
        color: #fff;
        font: inherit;
        font-weight: 800;
        cursor: pointer;
        box-shadow: 0 12px 24px rgba(11, 93, 187, 0.22);
      }
      a {
        color: var(--blue);
        font-weight: 700;
        text-underline-offset: 0.18em;
      }
      .status-panel p:last-child {
        margin-bottom: 0;
      }
      @media (max-width: 720px) {
        body {
          padding: 1rem;
        }
        main {
          padding: 1rem;
          border-radius: 24px;
        }
        .status-panel-top {
          align-items: flex-start;
        }
        .repo-card {
          align-items: flex-start;
          flex-direction: column;
        }
        .detail-grid {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <div class="brand-bar">
        <div class="brand-lockup">
          <span
            class="brand-mark-dot is-${serviceState.tone}"
            role="img"
            aria-label="${serviceState.label}"
            title="${serviceState.label}"
          ></span>
          <p class="brand-mark">Gluco<span>Easy</span> <small>CGM</small></p>
        </div>
      </div>
      <div class="layout">
        ${setupBlock}
        ${latestBlock}
        ${latestTreatmentBlock}
      </div>
      <section class="panel status-panel">
        <div class="status-panel-top">
          <div class="status-heading">
            <p class="eyebrow">System</p>
            <div class="status-title-row">
              <p class="system-name">${copy.title}</p>
              <div class="status-badge">${copy.status}</div>
            </div>
          </div>
        </div>
        <div class="status-actions">
          <a class="status-link" href="/api/v1/status.json">${copy.viewStatusJson}</a>
        </div>
        <div class="status-card repo-card">
          <div class="repo-copy">
            <p class="status-label">${copy.openSource}</p>
            <p class="repo-title">GlucoEasy source code</p>
            <p class="repo-body">${copy.openSourceBody}</p>
          </div>
          <a class="status-link repo-link" href="https://github.com/HankScorpi0/GlucoEasy" target="_blank" rel="noopener noreferrer">${copy.viewRepository}</a>
        </div>
      </section>
    </main>
    ${autoRefreshScript}
  </body>
</html>`;
}
