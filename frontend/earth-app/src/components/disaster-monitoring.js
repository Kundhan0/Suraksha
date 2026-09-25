import {
  HAZARD_TYPES,
  SEVERITY,
  createHazardStore,
  fetchHazards,
  hazardMatchesFilter,
  normalizeHazard,
  polygonLatLngs,
  renderHazard as upsertHazard,
} from '../services/hazardService';
import { analyzeArea } from '../services/analysisService';
import { DEMO_OVERLAY_LAYERS, SATELLITE_IMAGERY_STATUS } from '../services/satelliteService';

const MOCK_RAINFALL_ZONES = [
  {
    id: 'RAIN-GJ-01',
    level: 'extreme',
    label: 'DEMO WEATHER DATA - extreme rainfall zone',
    polygon: [[22.42, 73.0], [22.51, 73.29], [22.22, 73.42], [22.08, 73.09]],
  },
  {
    id: 'RAIN-AS-01',
    level: 'heavy',
    label: 'DEMO WEATHER DATA - heavy rainfall zone',
    polygon: [[26.27, 91.58], [26.34, 91.86], [26.08, 92.0], [25.98, 91.66]],
  },
];

const RAINFALL_STYLES = {
  moderate: { color: '#5aa0ff', fillColor: '#5aa0ff', fillOpacity: 0.11, weight: 1 },
  heavy: { color: '#f3d64e', fillColor: '#f3d64e', fillOpacity: 0.13, weight: 1 },
  extreme: { color: '#ff4d5e', fillColor: '#ff4d5e', fillOpacity: 0.15, weight: 1.2 },
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatClock(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatTimestamp(value) {
  if (!value) return 'Backend timestamp';
  return new Date(value).toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function addMonitoringStyles() {
  if (document.getElementById('disasterMonitoringStyle')) return;
  const style = document.createElement('style');
  style.id = 'disasterMonitoringStyle';
  style.textContent = `
    :root {
      --monitor-bg: rgba(7, 12, 18, 0.82);
      --monitor-bg-strong: rgba(7, 12, 18, 0.95);
      --monitor-border: rgba(198, 221, 255, 0.16);
      --monitor-text: #edf5ff;
      --monitor-muted: rgba(237, 245, 255, 0.64);
      --monitor-accent: #62a8ff;
      --monitor-green: #62e89b;
    }
    #topBar { left: 338px !important; right: 312px !important; top: 14px !important; z-index: 1150 !important; }
    #searchWrap { max-width: 620px !important; }
    #searchInput {
      height: 42px;
      border-radius: 8px !important;
      padding-left: 38px !important;
      background: rgba(5, 10, 16, 0.82) !important;
      border-color: rgba(145, 186, 255, 0.22) !important;
    }
    #searchWrap::before {
      content: '⌕';
      position: absolute;
      left: 14px;
      top: 7px;
      z-index: 1;
      color: rgba(238,245,255,0.72);
      font-size: 20px;
      line-height: 28px;
    }
    #worldBtn { height: 42px; border-radius: 8px !important; }
    #layerToggle, #boundaryToggle { display: none !important; }
    #placePanel { display: none !important; }
    .monitor-only { display: none; }
    body:has(#mapLayer.visible) .monitor-only { display: block; }
    #monitorTopStatus, #prototypeStatusBox, #monitorSidebar, #monitorBottomStatus, #monitorTimeline, #monitorLegend, #analysisPanel, #satelliteInputPanel {
      color: var(--monitor-text);
      background: var(--monitor-bg);
      border: 1px solid var(--monitor-border);
      border-radius: 8px;
      backdrop-filter: blur(14px);
      box-shadow: 0 12px 34px rgba(0,0,0,0.26);
    }
    #monitorTopStatus {
      position: absolute;
      top: 14px;
      left: 16px;
      z-index: 1140;
      width: 296px;
      box-sizing: border-box;
      padding: 12px 14px;
    }
    #prototypeStatusBox {
      position: absolute;
      left: 326px;
      right: 264px;
      bottom: 16px;
      z-index: 1145;
      box-sizing: border-box;
      padding: 7px 12px;
      color: rgba(255, 247, 205, 0.95);
      border-color: rgba(255, 230, 108, 0.28);
      background: rgba(34, 28, 8, 0.82);
      font-size: 11px;
      line-height: 1.2;
      font-weight: 750;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    body:has(#mapLayer.visible) #monitorTopStatus {
      display: none !important;
    }
    .monitor-title {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      font-size: 12px;
      letter-spacing: 0.14em;
      font-weight: 800;
    }
    .mode-pill {
      border: 1px solid rgba(255,255,255,0.16);
      border-radius: 999px;
      padding: 2px 7px;
      color: #ffe8a3;
      font-size: 9px;
      letter-spacing: 0.12em;
      white-space: nowrap;
    }
    .monitor-status-line {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      margin-top: 7px;
      color: var(--monitor-muted);
      font-size: 11px;
    }
    .status-dot {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      white-space: nowrap;
      font-weight: 750;
    }
    .status-dot::before {
      content: '';
      width: 7px;
      height: 7px;
      border-radius: 50%;
      border: 1px solid currentColor;
      background: currentColor;
    }
    .status-online { color: var(--monitor-green); }
    .status-demo { color: #ffe66c; }
    .status-offline { color: rgba(237,245,255,0.48); }
    .status-online::before { box-shadow: 0 0 0 0 rgba(98, 232, 155, 0.55); animation: monitorPulse 1.8s ease-out infinite; }
    #monitorSidebar {
      position: absolute;
      top: 96px;
      left: 16px;
      bottom: 72px;
      z-index: 1130;
      width: 296px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 12px;
      overflow: auto;
      padding: 12px;
      transition: transform 0.28s ease, opacity 0.28s ease;
    }
    #monitorSidebar,
    .hazard-event-list {
      scrollbar-width: thin;
      scrollbar-color: rgba(98, 168, 255, 0.55) rgba(255, 255, 255, 0.06);
    }
    #monitorSidebar::-webkit-scrollbar,
    .hazard-event-list::-webkit-scrollbar {
      width: 8px;
    }
    #monitorSidebar::-webkit-scrollbar-track,
    .hazard-event-list::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 999px;
    }
    #monitorSidebar::-webkit-scrollbar-thumb,
    .hazard-event-list::-webkit-scrollbar-thumb {
      background: linear-gradient(180deg, rgba(98, 168, 255, 0.72), rgba(98, 232, 155, 0.52));
      border: 2px solid rgba(7, 12, 18, 0.82);
      border-radius: 999px;
    }
    #monitorSidebar::-webkit-scrollbar-thumb:hover,
    .hazard-event-list::-webkit-scrollbar-thumb:hover {
      background: linear-gradient(180deg, rgba(125, 187, 255, 0.9), rgba(113, 247, 169, 0.75));
    }
    body.monitor-sidebar-collapsed #monitorSidebar {
      transform: translateX(calc(-100% - 18px));
      opacity: 0;
      pointer-events: none;
    }
    #monitorSidebarToggle, #fullscreenBtn {
      position: absolute;
      z-index: 1160;
      width: 38px;
      height: 38px;
      border: 1px solid var(--monitor-border);
      border-radius: 8px;
      color: var(--monitor-text);
      background: var(--monitor-bg-strong);
      cursor: pointer;
      display: none;
    }
    #monitorSidebarToggle { left: 16px; top: 16px; }
    #fullscreenBtn { right: 16px; top: 72px; }
    body:has(#mapLayer.visible) #monitorSidebarToggle,
    body:has(#mapLayer.visible) #fullscreenBtn { display: block; }
    #analysisPanel.monitor-only,
    #fullscreenBtn.monitor-only { display: block; }
    .monitor-section { border-top: 1px solid rgba(255,255,255,0.08); padding-top: 11px; }
    .monitor-section:first-child { border-top: 0; padding-top: 0; }
    .monitor-section h3 {
      margin: 0 0 9px;
      color: rgba(237,245,255,0.88);
      font-size: 11px;
      letter-spacing: 0.14em;
      font-weight: 800;
    }
    .monitor-help { margin: 7px 0 0; color: rgba(237,245,255,0.55); font-size: 11px; line-height: 1.4; }
    .monitor-check, .monitor-radio {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 26px;
      color: rgba(237,245,255,0.8);
      font-size: 12px;
      cursor: pointer;
    }
    .monitor-check input, .monitor-radio input { accent-color: var(--monitor-accent); }
    .analysis-button {
      width: 100%;
      height: 40px;
      border: 1px solid rgba(98,168,255,0.48);
      border-radius: 7px;
      color: #ffffff;
      background: rgba(98,168,255,0.2);
      cursor: pointer;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.1em;
    }
    .analysis-button.active { border-color: rgba(98,232,155,0.62); background: rgba(98,232,155,0.16); }
    .hazard-count-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 7px; }
    .hazard-count-card {
      border: 1px solid rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.045);
      border-radius: 6px;
      padding: 8px;
      min-height: 58px;
      cursor: pointer;
      text-align: left;
    }
    .hazard-count-card strong { display: block; color: #ffffff; font-size: 20px; line-height: 1; }
    .hazard-count-card span {
      display: block;
      margin-top: 6px;
      color: var(--monitor-muted);
      font-size: 9px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .hazard-event-list { display: grid; gap: 7px; max-height: 190px; overflow: auto; }
    .hazard-event-button {
      text-align: left;
      border: 1px solid rgba(255,255,255,0.08);
      border-left: 3px solid var(--hazard-color);
      background: rgba(255,255,255,0.045);
      color: var(--monitor-text);
      border-radius: 6px;
      padding: 8px;
      cursor: pointer;
    }
    .hazard-event-button strong { display: block; font-size: 12px; }
    .hazard-event-button span { display: block; margin-top: 3px; color: var(--monitor-muted); font-size: 11px; }
    #monitorLegend {
      position: absolute;
      right: 16px;
      bottom: 118px;
      z-index: 1130;
      width: 232px;
      overflow: hidden;
    }
    #monitorLegend summary { list-style: none; cursor: pointer; padding: 10px 12px; font-size: 11px; letter-spacing: 0.14em; font-weight: 800; }
    #monitorLegend summary::-webkit-details-marker { display: none; }
    .monitor-legend-body { padding: 0 12px 12px; display: grid; gap: 7px; color: var(--monitor-muted); font-size: 12px; }
    .legend-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .legend-swatch { width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 6px; }
    #hazardPanel {
      position: absolute;
      top: 0;
      right: 0;
      z-index: 1170;
      width: min(398px, 92vw);
      height: 100%;
      box-sizing: border-box;
      padding: 22px;
      color: var(--monitor-text);
      background: rgba(7, 11, 17, 0.96);
      border-left: 1px solid var(--monitor-border);
      box-shadow: -12px 0 34px rgba(0,0,0,0.32);
      transform: translateX(100%);
      transition: transform 0.32s ease;
      overflow: auto;
    }
    #hazardPanel.visible { transform: translateX(0); }
    #hazardPanelClose {
      position: absolute;
      top: 14px;
      right: 14px;
      width: 30px;
      height: 30px;
      border: 0;
      border-radius: 6px;
      color: var(--monitor-text);
      background: rgba(255,255,255,0.06);
      cursor: pointer;
    }
    .panel-kicker { margin: 18px 0 8px; color: var(--monitor-muted); font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; }
    .panel-title { margin: 0; padding-right: 34px; font-size: 24px; line-height: 1.12; letter-spacing: 0; }
    .panel-subtitle { margin: 8px 0 18px; color: var(--monitor-muted); font-size: 13px; line-height: 1.45; }
    .hazard-severity-bar { height: 9px; background: rgba(255,255,255,0.08); border-radius: 999px; overflow: hidden; }
    .hazard-severity-bar span { display: block; height: 100%; }
    .hazard-severity-label { margin-top: 7px; font-size: 12px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; }
    .detail-row {
      display: grid;
      grid-template-columns: 122px 1fr;
      gap: 10px;
      padding: 10px 0;
      border-top: 1px solid rgba(255,255,255,0.08);
      font-size: 12px;
    }
    .detail-row span { color: var(--monitor-muted); }
    .detail-row strong { color: var(--monitor-text); font-weight: 650; overflow-wrap: anywhere; }
    .panel-action {
      width: 100%;
      height: 38px;
      margin-top: 14px;
      border: 1px solid rgba(98,168,255,0.45);
      border-radius: 7px;
      color: #ffffff;
      background: rgba(98,168,255,0.18);
      cursor: pointer;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.1em;
    }
    #analysisPanel, #satelliteInputPanel {
      position: absolute;
      right: 16px;
      top: 120px;
      z-index: 1125;
      width: 284px;
      box-sizing: border-box;
      padding: 12px;
      font-size: 12px;
      line-height: 1.45;
    }
    #analysisPanel.analysis-warning {
      background: rgba(42, 8, 12, 0.9);
      border-color: rgba(255, 77, 94, 0.58);
      box-shadow: 0 12px 34px rgba(255, 77, 94, 0.14);
    }
    #analysisPanel.analysis-clear {
      background: rgba(6, 31, 20, 0.9);
      border-color: rgba(98, 232, 155, 0.54);
      box-shadow: 0 12px 34px rgba(98, 232, 155, 0.12);
    }
    .analysis-state-title {
      margin: 0 0 8px;
      font-size: 15px;
      font-weight: 850;
      letter-spacing: 0.08em;
    }
    .analysis-warning .analysis-state-title { color: #ff7d8a; }
    .analysis-clear .analysis-state-title { color: #79f2a9; }
    #satelliteInputPanel { top: 290px; }
    .analysis-flow { display: grid; justify-items: center; gap: 2px; margin-top: 10px; color: rgba(237,245,255,0.74); font-size: 10px; letter-spacing: 0.1em; }
    #monitorBottomStatus {
      position: absolute;
      left: 326px;
      right: 264px;
      bottom: 54px;
      z-index: 1120;
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      min-height: 34px;
      box-sizing: border-box;
      padding: 8px 12px;
      color: var(--monitor-muted);
      font-size: 11px;
    }
    #monitorBottomStatus span {
      min-width: 0;
      max-width: 100%;
    }
    #monitorTimeline {
      position: absolute;
      left: 328px;
      right: 264px;
      bottom: 100px;
      z-index: 1120;
      box-sizing: border-box;
      padding: 10px 12px;
    }
    .timeline-track { display: grid; grid-template-columns: auto 1fr auto; gap: 10px; align-items: center; font-size: 11px; color: var(--monitor-muted); }
    .timeline-line { position: relative; height: 2px; background: rgba(255,255,255,0.18); }
    .timeline-line::before {
      content: '';
      position: absolute;
      left: 68%;
      top: -4px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--monitor-green);
      box-shadow: 0 0 14px rgba(98,232,155,0.7);
    }
    .hazard-marker {
      position: relative;
      width: 34px;
      height: 34px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      color: #071019;
      background: var(--hazard-color);
      border: 2px solid rgba(255,255,255,0.92);
      box-shadow: 0 0 0 4px rgba(0,0,0,0.22), 0 8px 20px rgba(0,0,0,0.35);
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 0.04em;
    }
    .hazard-marker[data-active="true"]::before {
      content: '';
      position: absolute;
      inset: -7px;
      border-radius: 50%;
      border: 2px solid var(--hazard-color);
      opacity: 0.55;
      animation: hazardPulse 2s ease-out infinite;
    }
    .hazard-marker[data-severity="low"] { transform: scale(0.86); }
    .hazard-marker[data-severity="moderate"] { transform: scale(0.96); }
    .hazard-marker[data-severity="high"] { transform: scale(1.06); }
    .hazard-marker[data-severity="extreme"] { transform: scale(1.18); }
    .leaflet-interactive.hazard-area-active { animation: hazardStroke 2.4s ease-in-out infinite; }
    .analysis-selection { stroke-dasharray: 8 6; animation: hazardStroke 1.8s ease-in-out infinite; }
    @keyframes monitorPulse { 70% { box-shadow: 0 0 0 9px rgba(98, 232, 155, 0); } 100% { box-shadow: 0 0 0 0 rgba(98, 232, 155, 0); } }
    @keyframes hazardPulse { 100% { transform: scale(1.9); opacity: 0; } }
    @keyframes hazardStroke { 50% { stroke-opacity: 1; } }
    @media (max-width: 980px) {
      #topBar { left: 70px !important; right: 16px !important; top: 64px !important; }
      #monitorSidebar { top: 120px; width: min(320px, calc(100vw - 32px)); bottom: 88px; }
      #monitorTimeline { left: 70px; right: 16px; bottom: 96px; }
      #monitorBottomStatus { left: 70px; right: 16px; bottom: 48px; align-content: center; }
      #prototypeStatusBox { left: 70px; right: 16px; bottom: 12px; }
      #monitorLegend { display: none; }
      #analysisPanel, #satelliteInputPanel { right: 16px; width: min(284px, calc(100vw - 32px)); }
    }
    @media (max-width: 640px) {
      #topBar { left: 12px !important; right: 12px !important; top: 12px !important; }
      #worldBtn { padding-inline: 10px !important; }
      #monitorSidebar { left: 0; right: 0; bottom: 0; top: auto; width: 100%; max-height: 58vh; border-radius: 12px 12px 0 0; }
      body.monitor-sidebar-collapsed #monitorSidebar { transform: translateY(calc(100% + 18px)); }
      #monitorTimeline { display: none !important; }
      #monitorBottomStatus {
        left: 56px;
        right: 8px;
        bottom: 48px;
        gap: 6px 8px;
        min-height: 42px;
        max-height: 78px;
        overflow: hidden;
        padding: 7px 9px;
        font-size: 10px;
        line-height: 1.25;
      }
      #monitorBottomStatus .status-dot::before {
        width: 6px;
        height: 6px;
      }
      #monitorBottomClock {
        flex-basis: 100%;
      }
      #monitorCoords {
        flex-basis: 100%;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      #hazardPanel {
        top: auto;
        bottom: 0;
        width: 100%;
        height: min(72vh, 620px);
        transform: translateY(100%);
        border-left: 0;
        border-top: 1px solid var(--monitor-border);
        border-radius: 12px 12px 0 0;
      }
      #hazardPanel.visible { transform: translateY(0); }
      #fullscreenBtn { top: 122px; right: 12px; }
      #prototypeStatusBox {
        left: 56px;
        right: 8px;
        bottom: 8px;
        padding-inline: 8px;
        font-size: 10px;
      }
      #analysisPanel, #satelliteInputPanel { display: none !important; }
    }
  `;
  document.head.appendChild(style);
}

function createMonitoringMarkup() {
  if (document.getElementById('monitorTopStatus')) return;
  const shell = document.createElement('div');
  shell.innerHTML = `
    <div id="monitorTopStatus" class="monitor-only">
      <div class="monitor-title"><span>LIVE EARTH INTELLIGENCE</span><span class="mode-pill">DEMO MODE</span></div>
      <div class="monitor-status-line"><span class="status-dot status-online">SYSTEM ONLINE</span><span class="status-dot status-demo">HAZARD FEED DEMO</span></div>
      <div class="monitor-status-line"><span class="status-dot status-online">SATELLITE AVAILABLE</span><span class="status-dot status-offline">AI ENGINE NOT CONNECTED</span></div>
      <div class="monitor-status-line" id="monitorTopClock"></div>
    </div>
    <div id="prototypeStatusBox">Disclaimer: This is a prototype and works only with the India map.</div>
    <button id="monitorSidebarToggle" title="Toggle controls">☰</button>
    <button id="fullscreenBtn" class="monitor-only" title="Fullscreen">⛶</button>
    <aside id="monitorSidebar" class="monitor-only">
      <section class="monitor-section">
        <h3>MAP LAYERS</h3>
        <label class="monitor-radio"><input type="radio" name="mapLayerMode" data-base-layer="btnSat" checked> Satellite</label>
        <label class="monitor-radio"><input type="radio" name="mapLayerMode" data-base-layer="btnLabels"> Satellite + Labels</label>
        <label class="monitor-radio"><input type="radio" name="mapLayerMode" data-base-layer="btnStreet"> Streets</label>
        <p class="monitor-help">${escapeHtml(SATELLITE_IMAGERY_STATUS.label)}<br>STATUS: ${escapeHtml(SATELLITE_IMAGERY_STATUS.status)}<br>Imagery date: ${escapeHtml(SATELLITE_IMAGERY_STATUS.imageryDate)}</p>
      </section>
      <section class="monitor-section">
        <h3>BOUNDARIES</h3>
        <div id="monitorBoundaryControls"></div>
        <p class="monitor-help">Prepared for real GeoJSON/vector boundary data. No fabricated boundaries are shown.</p>
      </section>
      <section class="monitor-section"><h3>HAZARD MONITORING</h3><div id="hazardFilters"></div></section>
      <section class="monitor-section">
        <h3>ANALYZE AREA</h3>
        <button id="analyzeAreaBtn" class="analysis-button">ANALYZE AREA</button>
        <p class="monitor-help">Select a point on the satellite map to capture the current geographic region for future AI analysis.</p>
      </section>
      <section class="monitor-section"><h3>DASHBOARD COUNTERS</h3><div id="hazardCounters" class="hazard-count-grid"></div></section>
      <section class="monitor-section"><h3>EVENT QUEUE</h3><div id="hazardEventList" class="hazard-event-list"></div></section>
      <section class="monitor-section">
        <h3>FUTURE INPUT LAYERS</h3>
        <div id="futureOverlayList"></div>
        <p class="monitor-help">Optional overlays are marked as DEMO WEATHER DATA until real providers are connected.</p>
      </section>
    </aside>
    <details id="monitorLegend" class="monitor-only" open><summary>LEGEND</summary><div class="monitor-legend-body" id="monitorLegendBody"></div></details>
    <aside id="hazardPanel"><button id="hazardPanelClose" aria-label="Close">×</button><div id="hazardPanelBody"></div></aside>
    <div id="analysisPanel" class="monitor-only"></div>
    <div id="satelliteInputPanel" class="monitor-only"></div>
    <div id="monitorTimeline" class="monitor-only"><div class="timeline-track"><strong>PAST</strong><div class="timeline-line"></div><strong>NOW</strong></div></div>
    <div id="monitorBottomStatus" class="monitor-only">
      <span class="status-dot status-online">SYSTEM ONLINE</span>
      <span class="status-dot status-online">SATELLITE AVAILABLE</span>
      <span class="status-dot status-offline">AI ENGINE NOT CONNECTED</span>
      <span class="status-dot status-demo">DEMO MODE</span>
      <span id="monitorBottomClock"></span>
      <span id="monitorCoords">LAT -- LON -- ZOOM --</span>
    </div>
  `;
  document.body.append(...Array.from(shell.children));
}

function detailRows(rows) {
  return rows
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([label, value]) => `<div class="detail-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`)
    .join('');
}

function syncBoundaryControls() {
  const destination = document.getElementById('monitorBoundaryControls');
  if (!destination) return;
  destination.innerHTML = '';
  const sourceInputs = document.querySelectorAll('#boundaryToggle input[data-boundary-level]');
  if (sourceInputs.length === 0) {
    ['Country', 'State', 'District', 'Taluka / Tehsil', 'Village', 'Locality'].forEach((label) => {
      const row = document.createElement('label');
      row.className = 'monitor-check';
      row.innerHTML = `<input type="checkbox" disabled> ${escapeHtml(label)}`;
      destination.appendChild(row);
    });
    return;
  }
  sourceInputs.forEach((input) => {
    const label = input.parentElement?.textContent?.trim() || input.dataset.boundaryLevel;
    const row = document.createElement('label');
    row.className = 'monitor-check';
    row.innerHTML = `<input type="checkbox" data-boundary-proxy="${escapeHtml(input.dataset.boundaryLevel)}" ${input.checked ? 'checked' : ''}> ${escapeHtml(label)}`;
    destination.appendChild(row);
  });
}

function renderFilters(activeFilter) {
  const container = document.getElementById('hazardFilters');
  if (!container) return;
  container.innerHTML = Object.entries(HAZARD_TYPES)
    .map(([key, meta]) => `<label class="monitor-radio"><input type="radio" name="hazardFilter" value="${key}" ${key === activeFilter ? 'checked' : ''}> ${escapeHtml(meta.label)}</label>`)
    .join('');
}

function renderFutureLayers() {
  const container = document.getElementById('futureOverlayList');
  if (!container) return;
  container.innerHTML = DEMO_OVERLAY_LAYERS
    .map((label) => `<label class="monitor-check"><input type="checkbox" data-demo-overlay="${escapeHtml(label)}"> ${escapeHtml(label)}</label>`)
    .join('');
}

function renderLegend() {
  const body = document.getElementById('monitorLegendBody');
  if (!body) return;
  const severityRows = Object.entries(SEVERITY)
    .map(([, value]) => `<div class="legend-row"><span><i class="legend-swatch" style="background:${value.color}"></i>${value.label}</span><span>Severity</span></div>`)
    .join('');
  const hazardRows = Object.entries(HAZARD_TYPES)
    .filter(([key]) => key !== 'all')
    .map(([, value]) => `<div class="legend-row"><span><i class="legend-swatch" style="background:${value.color}"></i>${value.label}</span><span>${value.short}</span></div>`)
    .join('');
  body.innerHTML = `${severityRows}<div style="height:1px;background:rgba(255,255,255,0.08);"></div>${hazardRows}`;
}

function makeMarkerIcon(hazard) {
  const type = HAZARD_TYPES[hazard.type] || HAZARD_TYPES.all;
  return window.L.divIcon({
    className: '',
    html: `<div class="hazard-marker" data-active="${hazard.status === 'active'}" data-severity="${escapeHtml(hazard.severity)}" style="--hazard-color:${type.color}">${escapeHtml(type.short)}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

function createPanes(map) {
  [['rainfallPane', 430], ['analysisPane', 535], ['hazardAreaPane', 540], ['hazardMarkerPane', 650]].forEach(([name, zIndex]) => {
    if (!map.getPane(name)) {
      map.createPane(name);
      map.getPane(name).style.zIndex = zIndex;
    }
  });
}

function severityBar(hazard) {
  const severity = SEVERITY[hazard.severity];
  return `<div class="hazard-severity-bar"><span style="width:${severity.score}%; background:${severity.color}"></span></div><div class="hazard-severity-label" style="color:${severity.color}">${severity.label}</div>`;
}

function renderPanel(hazard) {
  const panel = document.getElementById('hazardPanel');
  const body = document.getElementById('hazardPanelBody');
  const type = HAZARD_TYPES[hazard.type] || HAZARD_TYPES.all;
  if (!panel || !body) return;
  body.innerHTML = `
    <div class="panel-kicker">HAZARD DETECTED - DEMO DATA</div>
    <h2 class="panel-title">${escapeHtml(type.label.toUpperCase())}</h2>
    <div class="panel-subtitle">${escapeHtml(hazard.name)}${hazard.district ? ` · ${escapeHtml(hazard.district)}` : ''}${hazard.state ? `, ${escapeHtml(hazard.state)}` : ''}</div>
    <div class="panel-kicker">SEVERITY</div>
    ${severityBar(hazard)}
    <div class="panel-kicker">EVENT DETAILS</div>
    ${detailRows([
      ['Type', type.label.toUpperCase()],
      ['Location', hazard.location],
      ['District', hazard.district || 'Example District'],
      ['State', hazard.state || 'Example State'],
      ['AI Confidence', hazard.confidence ? `${hazard.confidence.toFixed(1)}%` : 'Pending backend'],
      ['Affected Area', hazard.affectedArea ? `${hazard.affectedArea.toFixed(1)} km2` : 'Pending backend'],
      ['Detection Time', formatTimestamp(hazard.timestamp)],
      ['Status', hazard.status?.toUpperCase()],
      ['Source', hazard.source || 'AI / ML Analysis'],
    ])}
    <button class="panel-action" data-view-hazard="${escapeHtml(hazard.id)}">VIEW ON SATELLITE</button>
  `;
  panel.classList.add('visible');
}

function renderSatelliteInput(areaData) {
  const panel = document.getElementById('satelliteInputPanel');
  if (!panel) return;
  if (!areaData) {
    panel.innerHTML = '<div class="panel-kicker" style="margin-top:0">SATELLITE VISUAL INPUT</div><div>STATUS: WAITING FOR AREA SELECTION</div>';
    return;
  }
  panel.innerHTML = `
    <div class="panel-kicker" style="margin-top:0">SATELLITE VISUAL INPUT</div>
    ${detailRows([
      ['Latitude', areaData.latitude.toFixed(5)],
      ['Longitude', areaData.longitude.toFixed(5)],
      ['Zoom', areaData.zoom.toFixed(1)],
      ['Bounding Box', `N: ${areaData.bbox.north.toFixed(4)} S: ${areaData.bbox.south.toFixed(4)} E: ${areaData.bbox.east.toFixed(4)} W: ${areaData.bbox.west.toFixed(4)}`],
      ['Imagery', 'SATELLITE'],
      ['Status', 'READY FOR AI ANALYSIS'],
    ])}
  `;
}

function renderAnalysisState(hazards) {
  const panel = document.getElementById('analysisPanel');
  if (!panel) return;
  const activeHazards = hazards.filter((hazard) => hazard.status === 'active');
  const hasActiveHazards = activeHazards.length > 0;
  panel.classList.toggle('analysis-warning', hasActiveHazards);
  panel.classList.toggle('analysis-clear', !hasActiveHazards);
  panel.innerHTML = hasActiveHazards
    ? `
      <div class="panel-kicker" style="margin-top:0">SYSTEM WARNING</div>
      <h3 class="analysis-state-title">ACTIVE HAZARDS DETECTED</h3>
      <div>${activeHazards.length} active demo hazard${activeHazards.length === 1 ? '' : 's'} currently visible in the monitoring feed.</div>
      <div class="analysis-flow"><span>AI / ML HAZARD RESULT</span><span>↓</span><span>MAP WARNING LAYER</span></div>
    `
    : `
      <div class="panel-kicker" style="margin-top:0">SYSTEM STATUS</div>
      <h3 class="analysis-state-title">EVERYTHING IS ALL RIGHT</h3>
      <div>No active hazards are currently present in the monitoring feed.</div>
      <div class="analysis-flow"><span>SATELLITE VISUAL DATA</span><span>↓</span><span>READY FOR ANALYSIS</span></div>
    `;
}

function updateClocks() {
  const now = `LAST UPDATE ${formatClock()}`;
  const top = document.getElementById('monitorTopClock');
  const bottom = document.getElementById('monitorBottomClock');
  if (top) top.textContent = now;
  if (bottom) bottom.textContent = now;
}

function updateMapStatus(map, latLng) {
  const coordsEl = document.getElementById('monitorCoords');
  if (!coordsEl) return;
  const point = latLng || map.getCenter();
  coordsEl.textContent = `LAT ${point.lat.toFixed(4)} LON ${point.lng.toFixed(4)} ZOOM ${map.getZoom().toFixed(1)}`;
}

function captureAnalysisRequest(map, latLng) {
  const bounds = map.getBounds();
  return {
    latitude: latLng.lat,
    longitude: latLng.lng,
    zoom: map.getZoom(),
    bbox: {
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    },
    timestamp: new Date().toISOString(),
  };
}

export function initDisasterMonitoring() {
  const api = window.__earthGlobeApi;
  if (!window.L || !api?.getMap) return;

  const map = api.getMap();
  if (!map || map.__disasterMonitoringReady) return;
  map.__disasterMonitoringReady = true;

  addMonitoringStyles();
  createMonitoringMarkup();
  createPanes(map);

  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.placeholder = 'Search village, locality, district, state or coordinates...';

  renderLegend();
  renderFilters('all');
  renderFutureLayers();
  renderSatelliteInput(null);
  renderAnalysisState([]);

  const store = createHazardStore();
  const hazardLayer = window.L.layerGroup([], { pane: 'hazardMarkerPane' }).addTo(map);
  const hazardAreaLayer = window.L.layerGroup([], { pane: 'hazardAreaPane' }).addTo(map);
  const rainfallLayer = window.L.layerGroup([], { pane: 'rainfallPane' });
  const analysisLayer = window.L.layerGroup([], { pane: 'analysisPane' }).addTo(map);
  let hazards = [];
  let activeFilter = 'all';
  let analysisMode = false;
  let latestAnalysisRequest = null;
  let tick = 0;

  function visibleHazards() {
    return hazards.filter((hazard) => hazardMatchesFilter(hazard, activeFilter));
  }

  function findHazard(id) {
    return hazards.find((hazard) => hazard.id === id);
  }

  function flyToHazard(hazard) {
    map.flyTo([hazard.latitude, hazard.longitude], Math.max(map.getZoom(), 11.5), { duration: 1.1 });
    renderPanel(hazard);
  }

  function renderCounters() {
    const container = document.getElementById('hazardCounters');
    if (!container) return;
    const active = hazards.filter((hazard) => hazard.status === 'active');
    const highSeverity = hazards.filter((hazard) => ['high', 'extreme'].includes(hazard.severity));
    const areasMonitored = new Set(hazards.map((hazard) => hazard.district || hazard.location || hazard.id)).size;
    const cards = [
      ['all', active.length, 'Active Hazards'],
      ['', highSeverity.length, 'High Severity'],
      ['', areasMonitored, 'Areas Monitored'],
      ['', formatClock(), 'Last Update'],
    ];
    container.innerHTML = cards
      .map(([filter, value, label]) => `<button class="hazard-count-card" data-count-filter="${filter}"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></button>`)
      .join('');
  }

  function renderEventList() {
    const container = document.getElementById('hazardEventList');
    if (!container) return;
    container.innerHTML = visibleHazards()
      .map((hazard) => {
        const meta = HAZARD_TYPES[hazard.type] || HAZARD_TYPES.all;
        const severity = SEVERITY[hazard.severity];
        return `
          <button class="hazard-event-button" data-hazard-id="${escapeHtml(hazard.id)}" style="--hazard-color:${meta.color}">
            <strong>${escapeHtml(hazard.name)}</strong>
            <span>${escapeHtml(meta.label)} · ${escapeHtml(severity.label)} · ${escapeHtml(hazard.status)}</span>
          </button>
        `;
      })
      .join('');
  }

  function renderRainfall(show) {
    rainfallLayer.clearLayers();
    if (!show) {
      if (map.hasLayer(rainfallLayer)) map.removeLayer(rainfallLayer);
      return;
    }
    MOCK_RAINFALL_ZONES.forEach((zone) => {
      const style = RAINFALL_STYLES[zone.level] || RAINFALL_STYLES.moderate;
      window.L.polygon(zone.polygon, { ...style, pane: 'rainfallPane', interactive: false })
        .bindTooltip(zone.label, { sticky: true })
        .addTo(rainfallLayer);
    });
    if (!map.hasLayer(rainfallLayer)) rainfallLayer.addTo(map);
  }

  function renderHazards() {
    hazardLayer.clearLayers();
    hazardAreaLayer.clearLayers();
    visibleHazards().forEach((hazard) => {
      const meta = HAZARD_TYPES[hazard.type] || HAZARD_TYPES.all;
      const severity = SEVERITY[hazard.severity];
      if (hazard.polygon?.length) {
        const area = window.L.polygon(polygonLatLngs(hazard), {
          pane: 'hazardAreaPane',
          color: severity.color,
          fillColor: meta.color,
          fillOpacity: 0.14,
          opacity: 0.84,
          weight: hazard.severity === 'extreme' ? 2 : 1.4,
          className: hazard.status === 'active' ? 'hazard-area-active' : '',
        }).addTo(hazardAreaLayer);
        area.bindTooltip(`${meta.label}: ${hazard.name}<br>Severity: ${severity.label}`, { sticky: true });
        area.on('click', () => renderPanel(hazard));
      }

      const marker = window.L.marker([hazard.latitude, hazard.longitude], {
        icon: makeMarkerIcon(hazard),
        pane: 'hazardMarkerPane',
        keyboard: true,
        title: hazard.name,
      }).addTo(hazardLayer);
      marker.bindTooltip(`${meta.label}: ${hazard.name}<br>Severity: ${severity.label}`, { sticky: true });
      marker.on('click', () => renderPanel(hazard));
    });
    renderCounters();
    renderEventList();
    renderAnalysisState(hazards);
  }

  store.subscribe((nextHazards) => {
    hazards = nextHazards;
    renderHazards();
  });

  async function refreshHazards() {
    const rawHazards = await fetchHazards();
    store.setHazards(rawHazards.map((hazard) => normalizeHazard(hazard, tick)));
  }

  function setAnalysisMode(enabled) {
    analysisMode = enabled;
    document.getElementById('analyzeAreaBtn')?.classList.toggle('active', analysisMode);
    map.getContainer().style.cursor = analysisMode ? 'crosshair' : '';
  }

  async function handleAnalysisSelection(event) {
    if (!analysisMode) return;
    latestAnalysisRequest = captureAnalysisRequest(map, event.latlng);
    analysisLayer.clearLayers();
    window.L.rectangle(map.getBounds(), {
      pane: 'analysisPane',
      color: '#62e89b',
      fillColor: '#62e89b',
      fillOpacity: 0.05,
      weight: 1.5,
      className: 'analysis-selection',
    }).addTo(analysisLayer);
    window.L.circleMarker(event.latlng, {
      pane: 'analysisPane',
      radius: 7,
      color: '#62e89b',
      weight: 2,
      fillColor: '#62e89b',
      fillOpacity: 0.42,
    }).addTo(analysisLayer);
    renderSatelliteInput(latestAnalysisRequest);
    await analyzeArea(latestAnalysisRequest);
    setAnalysisMode(false);
  }

  document.addEventListener('change', (event) => {
    const input = event.target;
    if (!input) return;
    if (input.name === 'hazardFilter') {
      activeFilter = input.value;
      renderHazards();
    }
    if (input.name === 'mapLayerMode' && input.dataset?.baseLayer) {
      document.getElementById(input.dataset.baseLayer)?.click();
    }
    if (input.dataset?.boundaryProxy) {
      const boundaryInput = Array.from(document.querySelectorAll('#boundaryToggle input[data-boundary-level]'))
        .find((item) => item.dataset.boundaryLevel === input.dataset.boundaryProxy);
      if (boundaryInput && boundaryInput.checked !== input.checked) {
        boundaryInput.checked = input.checked;
        boundaryInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    if (input.dataset?.demoOverlay) {
      renderRainfall(input.checked && input.dataset.demoOverlay === 'Rainfall');
    }
  });

  document.addEventListener('click', (event) => {
    const countButton = event.target.closest?.('[data-count-filter]');
    if (countButton?.dataset.countFilter) {
      activeFilter = countButton.dataset.countFilter;
      renderFilters(activeFilter);
      renderHazards();
      const first = visibleHazards()[0];
      if (first) flyToHazard(first);
      return;
    }

    const eventButton = event.target.closest?.('[data-hazard-id]');
    if (eventButton) {
      const hazard = findHazard(eventButton.dataset.hazardId);
      if (hazard) flyToHazard(hazard);
      return;
    }

    const viewButton = event.target.closest?.('[data-view-hazard]');
    if (viewButton) {
      const hazard = findHazard(viewButton.dataset.viewHazard);
      if (hazard?.polygon?.length) {
        map.fitBounds(window.L.latLngBounds(polygonLatLngs(hazard)), { padding: [34, 34], maxZoom: 13 });
      } else if (hazard) {
        map.flyTo([hazard.latitude, hazard.longitude], Math.max(map.getZoom(), 13), { duration: 1 });
      }
      return;
    }

    if (event.target.id === 'hazardPanelClose') document.getElementById('hazardPanel')?.classList.remove('visible');
    if (event.target.id === 'monitorSidebarToggle') document.body.classList.toggle('monitor-sidebar-collapsed');
    if (event.target.id === 'analyzeAreaBtn') setAnalysisMode(!analysisMode);
    if (event.target.id === 'fullscreenBtn') {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  });

  document.addEventListener('fullscreenchange', () => {
    setTimeout(() => map.invalidateSize(), 80);
  });

  map.on('mousemove', (event) => updateMapStatus(map, event.latlng));
  map.on('move zoomend moveend', () => updateMapStatus(map));
  map.on('click', handleAnalysisSelection);

  updateMapStatus(map);
  updateClocks();
  syncBoundaryControls();
  setTimeout(syncBoundaryControls, 500);
  refreshHazards();

  setInterval(() => {
    tick += 1;
    updateClocks();
    refreshHazards();
  }, 5000);

  window.__hazardMonitoring = {
    mode: 'SIMULATION MODE',
    setHazards: store.setHazards,
    addHazard: store.addHazard,
    updateHazard: store.updateHazard,
    removeHazard: store.removeHazard,
    clearHazards: store.clearHazards,
    renderHazard: (hazard) => upsertHazard(hazard, store),
    refresh: refreshHazards,
    setFilter(filter) {
      activeFilter = HAZARD_TYPES[filter] ? filter : 'all';
      renderFilters(activeFilter);
      renderHazards();
    },
    getAnalysisRequest: () => latestAnalysisRequest,
  };
}

export { fetchHazards };
