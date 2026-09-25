import React, { useState, useEffect, useRef, useCallback } from 'react';
import EarthGlobe from './components/earth-globe';
import LoginOverlay from './components/auth/LoginOverlay';
import LoadingScreen from './components/LoadingScreen';
import './App.css';

/* ─── Constants & Configurations ─────────────────────────────────────────────── */
const API = import.meta.env.VITE_API_URL || 'http://localhost:8001';
const MAP_CTR = [22.31, 73.18]; // Vadodara district center
const MAP_ZOOM = 9;

/* ─── API Helpers ───────────────────────────────────────────────────────────── */
async function apiFetch(path, opts = {}) {
  try {
    const r = await fetch(API + path, {
      headers: { 'Content-Type': 'application/json' },
      ...opts,
    });
    return r.ok ? r.json() : null;
  } catch {
    return null;
  }
}

function riskColor(s) {
  if (s >= 0.75) return '#ef4444';
  if (s >= 0.60) return '#f97316';
  if (s >= 0.40) return '#eab308';
  return '#22c55e';
}

function tierInfo(s) {
  if (s >= 0.75) return { label: 'Evacuate', bg: '#ef4444', tier: 1 };
  if (s >= 0.60) return { label: 'Relocate', bg: '#f97316', tier: 2 };
  if (s >= 0.40) return { label: 'Mitigate', bg: '#eab308', tier: 3 };
  return { label: 'Monitor', bg: '#22c55e', tier: 4 };
}

/* ─── Score Bar Component ───────────────────────────────────────────────────── */
function ScoreBar({ label, value = 0 }) {
  const pct = (value * 100).toFixed(1);
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', marginBottom: 3 }}>
        <span>{label}</span>
        <span style={{ color: riskColor(value), fontWeight: 600 }}>{pct}%</span>
      </div>
      <div style={{ background: '#1e293b', borderRadius: 3, height: 6 }}>
        <div style={{ width: `${Math.min(100, Math.max(0, value * 100))}%`, height: 6, borderRadius: 3, background: riskColor(value), transition: 'width .5s ease' }} />
      </div>
    </div>
  );
}

/* ─── Chat Bubble Component ─────────────────────────────────────────────────── */
function Bubble({ role, content }) {
  const user = role === 'user';
  return (
    <div style={{ display: 'flex', justifyContent: user ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
      {!user && (
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 8, flexShrink: 0, fontSize: 13 }}>
          🛡️
        </div>
      )}
      <div
        style={{
          maxWidth: '74%',
          padding: '9px 13px',
          borderRadius: user ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          background: user ? '#1d4ed8' : '#1e293b',
          color: '#f1f5f9',
          fontSize: 13,
          lineHeight: 1.55,
          wordBreak: 'break-word',
        }}
        dangerouslySetInnerHTML={{
          __html: content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>'),
        }}
      />
    </div>
  );
}

/* ─── Globe Intro Screen ────────────────────────────────────────────────────── */
function GlobeIntro({ onComplete }) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 3500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      onClick={onComplete}
      style={{
        position: 'fixed',
        inset: 0,
        background: '#020817',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        cursor: 'pointer',
      }}
    >
      <div style={{ position: 'relative', width: 220, height: 220, marginBottom: 28 }}>
        <div
          style={{
            width: 220,
            height: 220,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 35%, #1d4ed8, #0f172a 80%)',
            boxShadow: '0 0 60px rgba(37,99,235,0.4), inset -25px -25px 40px rgba(0,0,0,0.8)',
            animation: 'spinGlobe 8s linear infinite',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '46%',
              left: '54%',
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: '#ef4444',
              boxShadow: '0 0 15px #ef4444',
            }}
          />
        </div>
      </div>
      <h1 style={{ color: '#f1f5f9', fontSize: 28, fontWeight: 800 }}>🛡️ Project Suraksha</h1>
      <p style={{ color: '#64748b', fontSize: 13, marginTop: 6 }}>SIH26191 · Multi-Hazard Risk Assessment</p>
      <p style={{ color: '#3b82f6', fontSize: 12, marginTop: 18 }}>Zooming into Vadodara District (Click to skip)…</p>
      <style>{`@keyframes spinGlobe { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/* ─── Leaflet Map Component ─────────────────────────────────────────────────── */
function VadodaraMap({ selected, onSelect, mapLayer, villages }) {
  const divRef = useRef(null);
  const mapRef = useRef(null);
  const tileLayerRef = useRef(null);
  const zonesLayerRef = useRef(null);
  const markerRef = useRef(null);

  // Initialize Map
  useEffect(() => {
    if (!document.getElementById('lf-css')) {
      const l = document.createElement('link');
      l.id = 'lf-css';
      l.rel = 'stylesheet';
      l.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(l);
    }

    function init() {
      if (!divRef.current || mapRef.current) return;
      const L = window.L;
      const map = L.map(divRef.current, {
        center: MAP_CTR,
        zoom: MAP_ZOOM,
        maxBounds: [[20.0, 68.0], [24.7, 74.5]],
        minZoom: 7,
        maxZoom: 18,
      });
      mapRef.current = map;

      // Base tile layer
      tileLayerRef.current = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
      }).addTo(map);

      // Title control
      const info = L.control({ position: 'topleft' });
      info.onAdd = () => {
        const d = L.DomUtil.create('div');
        d.style.cssText = 'background:rgba(15,23,42,.92);color:#f1f5f9;padding:7px 12px;border-radius:8px;font-size:11px;font-weight:600;border:1px solid #334155;pointer-events:none';
        d.innerHTML = '🛡️ Vadodara Hazard Zones<br/><span style="font-size:10px;font-weight:400;color:#94a3b8">Subdistrict Risk Choropleth</span>';
        return d;
      };
      info.addTo(map);

      // Legend
      const leg = L.control({ position: 'bottomright' });
      leg.onAdd = () => {
        const d = L.DomUtil.create('div');
        d.style.cssText = 'background:rgba(15,23,42,.92);color:#f1f5f9;padding:9px 13px;border-radius:8px;font-size:10px;border:1px solid #334155;line-height:1.8';
        d.innerHTML = '<b>Zone Hazard Level</b><br/>🔴 Tier 1: Evacuate (&gt;75%)<br/>🟠 Tier 2: Relocate (60–75%)<br/>🟡 Tier 3: Mitigate (40–60%)<br/>🟢 Tier 4: Monitor (&lt;40%)';
        return d;
      };
      leg.addTo(map);
    }

    if (window.L) init();
    else {
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      s.onload = init;
      document.head.appendChild(s);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update Basemap Layer
  useEffect(() => {
    if (!mapRef.current || !window.L) return;
    const L = window.L;
    if (tileLayerRef.current) {
      tileLayerRef.current.remove();
      tileLayerRef.current = null;
    }

    if (mapLayer === 'satellite') {
      tileLayerRef.current = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri',
      }).addTo(mapRef.current);
    } else if (mapLayer === 'sat-labels') {
      tileLayerRef.current = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri',
      }).addTo(mapRef.current);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { opacity: 0.35 }).addTo(mapRef.current);
    } else if (mapLayer === 'street') {
      tileLayerRef.current = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
      }).addTo(mapRef.current);
    }
    // 'zones' keeps background clean/blank
  }, [mapLayer]);

  // Render Subdistrict Choropleth Zones (No individual overlapping dots!)
  useEffect(() => {
    if (!mapRef.current || !window.L || !villages.length) return;
    const L = window.L;

    if (zonesLayerRef.current) {
      zonesLayerRef.current.remove();
    }

    // Group by subdistrict to compute bounding zones
    const subdistricts = {};
    villages.forEach(v => {
      const s = v.subdistrict || 'Unknown';
      if (!subdistricts[s]) subdistricts[s] = { lats: [], lons: [], scores: [] };
      subdistricts[s].lats.push(v.latitude);
      subdistricts[s].lons.push(v.longitude);
      subdistricts[s].scores.push(v.composite_risk_score || 0);
    });

    const zoneFeatures = Object.entries(subdistricts).map(([name, data]) => {
      const avgRisk = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
      const minLat = Math.min(...data.lats) - 0.02;
      const maxLat = Math.max(...data.lats) + 0.02;
      const minLon = Math.min(...data.lons) - 0.02;
      const maxLon = Math.max(...data.lons) + 0.02;
      const coords = [
        [minLon, minLat],
        [maxLon, minLat],
        [maxLon, maxLat],
        [minLon, maxLat],
        [minLon, minLat],
      ];
      return {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [coords] },
        properties: { name, avgRisk, count: data.scores.length, colour: riskColor(avgRisk) },
      };
    });

    zonesLayerRef.current = L.geoJSON(
      { type: 'FeatureCollection', features: zoneFeatures },
      {
        style: f => ({
          fillColor: f.properties.colour,
          color: f.properties.colour,
          weight: 2,
          fillOpacity: 0.35,
          opacity: 0.8,
        }),
        onEachFeature: (f, layer) => {
          const p = f.properties;
          layer.bindPopup(
            `<b>${p.name} Subdistrict</b><br/>Avg Risk: <b style="color:${p.colour}">${(p.avgRisk * 100).toFixed(1)}%</b><br/>Monitored Villages: ${p.count}`
          );
        },
      }
    ).addTo(mapRef.current);
  }, [villages]);

  // Highlight SINGLE point marker only when a village is searched/selected
  useEffect(() => {
    if (!mapRef.current || !window.L) return;
    const L = window.L;

    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }

    if (selected && selected.latitude && selected.longitude) {
      const col = riskColor(selected.composite_risk_score || 0);
      markerRef.current = L.circleMarker([selected.latitude, selected.longitude], {
        radius: 12,
        fillColor: col,
        color: '#ffffff',
        weight: 3,
        opacity: 1,
        fillOpacity: 0.9,
      })
        .addTo(mapRef.current)
        .bindPopup(
          `<b>${selected.village_name}</b><br/>${selected.subdistrict}<br/>Risk: <b style="color:${col}">${((selected.composite_risk_score || 0) * 100).toFixed(1)}%</b>`
        )
        .openPopup();

      mapRef.current.flyTo([selected.latitude, selected.longitude], 13, { duration: 1.2 });
    }
  }, [selected]);

  return <div ref={divRef} style={{ width: '100%', height: '100%' }} />;
}

/* ─── Main Application Component ────────────────────────────────────────────── */
export default function App() {
  // Authentication state (shows login page with rotating 3D Earth globe if not logged in)
  const [userAuth, setUserAuth] = useState(() => {
    try {
      const stored = sessionStorage.getItem('suraksha_auth');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [loginExiting, setLoginExiting] = useState(false);

  // The reference login scene includes dashboard controls behind the frosted
  // card. Keep those controls off-screen until authentication is complete.
  useEffect(() => {
    document.body.classList.toggle('pre-login', !userAuth && !loginExiting);
    return () => document.body.classList.remove('pre-login');
  }, [userAuth, loginExiting]);

  const [isLoading, setIsLoading] = useState(false);
  const [showGlobe, setShowGlobe] = useState(false);
  const [tab, setTab] = useState('map'); // 'map' | 'chat' | 'ranking' | 'relocation'
  const [mapLayer, setMapLayer] = useState('street'); // 'satellite' | 'sat-labels' | 'street' | 'zones'
  const [villages, setVillages] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [apiStatus, setApiStatus] = useState('checking');

  // Relocation Page State
  const [relocationOrigin, setRelocationOrigin] = useState('');
  const [relocationCandidates, setRelocationCandidates] = useState([]);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [routeData, setRouteData] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);

  // Chat State
  const [messages, setMessages] = useState([
    {
      role: 'ai',
      content:
        '🛡️ **Welcome to Project Suraksha**\n\nI monitor disaster risk across 680 villages in Vadodara district using trained ML models.\n\nTry asking:\n• "What is the flood risk in Alampura?"\n• "Should we relocate Kanabha village?"\n• "Show safe relocation sites near Karjan"',
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);
  const sessionId = useRef(
    localStorage.getItem('suraksha_session') ||
    (() => {
      const id = 'suraksha_' + Date.now();
      localStorage.setItem('suraksha_session', id);
      return id;
    })()
  );

  // Disaster history data
  const [disasterHistory, setDisasterHistory] = useState({});

  // Select Village
  const selectVillage = useCallback(async v => {
    setSelected(v);
    setDetail(null);
    setRelocationOrigin(v.village_name);

    // Fetch deep report if available
    const d = await apiFetch(`/api/village/${encodeURIComponent(v.village_name)}`);
    setDetail(d && !d.error ? d : v);

    // Fetch relocation candidates for this village
    if (v.village_code) {
      const c = await apiFetch(`/api/relocation/candidates/${v.village_code}`);
      if (c?.candidates?.length) {
        setRelocationCandidates(c.candidates);
        setSelectedDestination(c.candidates[0]);
      }
    }
  }, []);

  // 1. Initial Data Fetch & Health Check
  useEffect(() => {
    (async () => {
      const h = await apiFetch('/health');
      setApiStatus(h ? 'online' : 'offline');

      // Load static cached JSON
      try {
        const r = await fetch('/vadodara_villages.json');
        const d = await r.json();
        const list = Array.isArray(d) ? d : (d.villages || []);
        if (list.length) {
          setVillages(list);
          setLoading(false);
          const defaultVillage = list.find(v => v.village_name?.toLowerCase() === 'alampura') || list[0];
          if (defaultVillage) {
            selectVillage(defaultVillage);
          }
        }
      } catch (err) {
        console.error('Failed to load vadodara_villages.json:', err);
        const fallback = await apiFetch('/api/villages/ranking');
        const fallbackList = Array.isArray(fallback) ? fallback : (fallback?.villages || []);
        if (fallbackList.length) {
          setVillages(fallbackList);
          const defaultVillage = fallbackList.find(v => v.village_name?.toLowerCase() === 'alampura') || fallbackList[0];
          if (defaultVillage) {
            selectVillage(defaultVillage);
          }
        }
        setLoading(false);
      }

      // Load disaster history
      try {
        const dh = await fetch('/disaster_history.json');
        const dhJson = await dh.json();
        setDisasterHistory(dhJson);
      } catch {}
    })();
  }, [selectVillage]);

  // 2. Load Chat History
  useEffect(() => {
    apiFetch(`/api/chat/history/${sessionId.current}`)
      .then(d => {
        if (d?.messages?.length) {
          const past = d.messages.slice(-30).map(m => ({
            role: m.role === 'user' ? 'user' : 'ai',
            content: m.message,
          }));
          setMessages(prev => [...past, ...prev.slice(-1)]);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send Chat
  const sendChat = async () => {
    const txt = chatInput.trim();
    if (!txt || chatLoading) return;
    setChatInput('');
    setChatLoading(true);
    setMessages(p => [...p, { role: 'user', content: txt }]);

    const r = await apiFetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message: txt, session_id: sessionId.current }),
    });

    setMessages(p => [
      ...p,
      {
        role: 'ai',
        content: r?.response || '⚠️ AI backend offline. Please verify API is running at http://localhost:8001.',
      },
    ]);
    setChatLoading(false);
  };

  // Calculate Evacuation Route
  const calculateEvacuationRoute = async () => {
    if (!selectedDestination) return;
    setRouteLoading(true);
    const payload = {
      from_village: relocationOrigin || selected?.village_name || 'Alampura',
      to_village: selectedDestination.site_name,
      to_lat: selectedDestination.latitude,
      to_lon: selectedDestination.longitude,
    };
    const r = await apiFetch('/api/route', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (r) setRouteData(r);
    setRouteLoading(false);
  };

  // PDF Export
  const downloadPDFReport = () => {
    const v = detail || selected;
    if (!v) return;
    const w = window.open('', '_blank');
    w.document.write(`
      <html><head><title>Relocation Report — ${v.village_name}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #1e293b; }
        h1 { color: #1d4ed8; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; margin-top: 14px; }
        th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
        th { background: #f1f5f9; }
      </style></head>
      <body>
        <h1>🛡️ Project Suraksha — Relocation & Hazard Report</h1>
        <h3>${v.village_name} (${v.subdistrict} Subdistrict, Vadodara)</h3>
        <p><strong>Composite Risk Score:</strong> ${((v.composite_risk_score || 0) * 100).toFixed(1)}% (${tierInfo(v.composite_risk_score || 0).label})</p>
        <p><strong>Total Population:</strong> ${(v.total_population || 0).toLocaleString()} residents</p>
        <table>
          <tr><th>Hazard Type</th><th>Score</th><th>Proximity / Value</th></tr>
          <tr><td>Flood Hazard</td><td>${((v.flood_hazard_score || 0) * 100).toFixed(1)}%</td><td>River Dist: ${v.distance_to_river_km || '—'} km</td></tr>
          <tr><td>Cloudburst Probability</td><td>${((v.cloudburst_probability || 0) * 100).toFixed(1)}%</td><td>High Monsoon Zone</td></tr>
          <tr><td>Landslide Susceptibility</td><td>${((v.landslide_susceptibility || 0) * 100).toFixed(1)}%</td><td>Soil Erodibility: Moderate</td></tr>
          <tr><td>Soil Erosion Risk</td><td>${((v.erosion_risk || 0) * 100).toFixed(1)}%</td><td>Surface Drainage Active</td></tr>
        </table>
        ${
          selectedDestination
            ? `<h3>Designated Relocation Destination</h3>
               <p><strong>Site:</strong> ${selectedDestination.site_name} (${selectedDestination.subdistrict})</p>
               <p><strong>Capacity:</strong> ${(selectedDestination.population_capacity || 0).toLocaleString()} people</p>
               <p><strong>Suitability:</strong> ${((selectedDestination.suitability_score || 0) * 100).toFixed(1)}%</p>`
            : ''
        }
      </body></html>
    `);
    w.document.close();
    w.print();
  };

  // Google Translate Helper
  const changeLanguage = code => {
    const el = document.querySelector('.goog-te-combo');
    if (el) {
      el.value = code;
      el.dispatchEvent(new Event('change'));
    }
  };

  // Filtered villages list
  const filtered = villages.filter(v => {
    const s = v.composite_risk_score || 0;
    const matchSearch =
      !search ||
      v.village_name?.toLowerCase().includes(search.toLowerCase()) ||
      v.subdistrict?.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === 'all' ||
      (filter === 'tier1' && s >= 0.75) ||
      (filter === 'tier2' && s >= 0.60 && s < 0.75) ||
      (filter === 'tier3' && s >= 0.40 && s < 0.60) ||
      (filter === 'tier4' && s < 0.40);
    return matchSearch && matchFilter;
  });

  const t1 = villages.filter(v => (v.composite_risk_score || 0) >= 0.75).length;
  const t2 = villages.filter(v => (v.composite_risk_score || 0) >= 0.60 && (v.composite_risk_score || 0) < 0.75).length;
  const t3 = villages.filter(v => (v.composite_risk_score || 0) >= 0.40 && (v.composite_risk_score || 0) < 0.60).length;
  const t4 = villages.filter(v => (v.composite_risk_score || 0) < 0.40).length;

  // 1. Render Login Gate (Space with 3D Rotating Earth Globe)
  if (!userAuth) {
    return (
      <>
        <EarthGlobe />
        <LoginOverlay
          onExitStart={() => setLoginExiting(true)}
          onSuccess={data => {
            sessionStorage.setItem('suraksha_auth', JSON.stringify(data));
            setUserAuth(data);
            setIsLoading(true);
          }}
        />
      </>
    );
  }

  // 2. Render Themed Loading Screen
  if (isLoading) {
    return <LoadingScreen onComplete={() => setIsLoading(false)} />;
  }

  // 3. Render Rotating Globe Intro if requested
  if (showGlobe) {
    return <GlobeIntro onComplete={() => setShowGlobe(false)} />;
  }

  return (
    <div className="app-root">
      {/* ──────── Header ──────── */}
      <header className="hdr">
        <div className="hdr-left">
          <span className="hdr-logo">🛡️ Project Suraksha</span>
          <span className="hdr-sub">SIH26191 · Multi-Hazard Risk Assessment · Vadodara District</span>
        </div>
        <div className="hdr-right">
          <span className={`dot ${apiStatus === 'online' ? 'green' : 'red'}`} />
          <span className="hdr-api">API {apiStatus}</span>

          {/* Language Selector */}
          <select
            onChange={e => changeLanguage(e.target.value)}
            style={{ background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', borderRadius: 4, padding: '3px 7px', fontSize: 11, cursor: 'pointer' }}
          >
            <option value="en">English</option>
            <option value="hi">हिंदी (Hindi)</option>
            <option value="gu">ગુજરાતી (Gujarati)</option>
            <option value="te">తెలుగు (Telugu)</option>
          </select>

          <span className="badge" style={{ background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440' }}>🔴 {t1} Evacuate</span>
          <span className="badge" style={{ background: '#f9731620', color: '#f97316', border: '1px solid #f9731640' }}>🟠 {t2} Relocate</span>
          <span className="badge" style={{ background: '#eab30820', color: '#eab308', border: '1px solid #eab30840' }}>🟡 {t3} Mitigate</span>

          {/* User & Logout */}
          <button
            onClick={() => {
              sessionStorage.removeItem('suraksha_auth');
              setUserAuth(null);
            }}
            style={{ background: '#ef444422', border: '1px solid #ef444455', color: '#ef4444', borderRadius: 6, padding: '4px 9px', fontSize: 11, cursor: 'pointer', marginLeft: 8 }}
          >
            Logout
          </button>
        </div>
      </header>

      {/* ──────── Tabs Bar ──────── */}
      <nav className="tabbar">
        {[
          ['map', '🗺️ Risk Map'],
          ['chat', '💬 AI Chat'],
          ['ranking', '📊 Village Ranking'],
          ['relocation', '🏗️ Relocation Plan'],
        ].map(([id, lbl]) => (
          <button key={id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
            {lbl}
          </button>
        ))}
      </nav>

      {/* ──────── Body Container ──────── */}
      <div className="body">
        {/* ══ MAP TAB ══ */}
        {tab === 'map' && (
          <div className="map-layout">
            {/* Sidebar */}
            <aside className="sidebar">
              <div className="sb-search">
                <input
                  placeholder="Search village or subdistrict…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="sb-input"
                />
              </div>

              {/* Filter Row */}
              <div className="filter-row">
                {[
                  ['all', 'All', '#64748b'],
                  ['tier1', '🔴 T1', '#ef4444'],
                  ['tier2', '🟠 T2', '#f97316'],
                  ['tier3', '🟡 T3', '#eab308'],
                  ['tier4', '🟢 T4', '#22c55e'],
                ].map(([id, lbl, col]) => (
                  <button
                    key={id}
                    onClick={() => setFilter(id)}
                    className="filter-btn"
                    style={{
                      color: filter === id ? col : '#475569',
                      borderColor: filter === id ? col : 'transparent',
                      background: filter === id ? col + '22' : 'transparent',
                    }}
                  >
                    {lbl}
                  </button>
                ))}
              </div>

              {/* Village List */}
              <div className="village-list">
                {loading ? (
                  <p className="loading-txt">Loading villages…</p>
                ) : (
                  filtered.map(v => {
                    const s = v.composite_risk_score || 0;
                    const ti = tierInfo(s);
                    const isSel = selected?.village_name === v.village_name;
                    return (
                      <div
                        key={v.village_code || v.village_name}
                        onClick={() => selectVillage(v)}
                        className={`village-card ${isSel ? 'selected' : ''}`}
                        style={{ borderColor: isSel ? ti.bg : 'transparent' }}
                      >
                        <div className="vc-top">
                          <div>
                            <div className="vc-name">{v.village_name}</div>
                            <div className="vc-sub">{v.subdistrict}</div>
                          </div>
                          <div className="vc-badge" style={{ background: ti.bg + '22', color: ti.bg, border: `1px solid ${ti.bg}44` }}>
                            {(s * 100).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </aside>

            {/* Map Area */}
            <div className="map-area" style={{ position: 'relative' }}>
              {/* Map Layer Switcher (Satellite, Sat+Labels, Street, Zones) */}
              <div
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  zIndex: 1000,
                  display: 'flex',
                  gap: 4,
                  background: 'rgba(15,23,42,0.85)',
                  padding: 4,
                  borderRadius: 8,
                  border: '1px solid #334155',
                }}
              >
                {[
                  ['street', '🗺️ Street'],
                  ['satellite', '🛰️ Satellite'],
                  ['sat-labels', '🛰️+🏷️ Labels'],
                  ['zones', '🎨 Zones'],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setMapLayer(id)}
                    style={{
                      background: mapLayer === id ? '#1d4ed8' : 'transparent',
                      color: mapLayer === id ? '#fff' : '#94a3b8',
                      border: 'none',
                      borderRadius: 6,
                      padding: '5px 9px',
                      fontSize: 11,
                      cursor: 'pointer',
                      fontWeight: mapLayer === id ? 600 : 400,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <VadodaraMap selected={selected} onSelect={selectVillage} mapLayer={mapLayer} villages={villages} />
            </div>

            {/* Detail Panel */}
            {selected && (
              <aside className="detail-panel">
                <div className="dp-header">
                  <div>
                    <div className="dp-name">{selected.village_name}</div>
                    <div className="dp-sub">{selected.subdistrict} · Vadodara</div>
                  </div>
                  <button className="dp-close" onClick={() => setSelected(null)}>
                    ×
                  </button>
                </div>

                {(() => {
                  const s = (detail || selected).composite_risk_score || 0;
                  const ti = tierInfo(s);
                  return (
                    <div className="tier-badge" style={{ background: ti.bg + '22', border: `1px solid ${ti.bg}44` }}>
                      <div style={{ color: ti.bg, fontWeight: 700, fontSize: 13 }}>
                        Tier {ti.tier} — {ti.label}
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>Composite Risk: {(s * 100).toFixed(1)}%</div>
                    </div>
                  );
                })()}

                {/* Hazard Scores */}
                <div className="dp-section-title">Hazard Scores</div>
                <ScoreBar label="🌊 Flood Hazard" value={(detail || selected).flood_hazard_score || 0} />
                <ScoreBar label="🌧️ Cloudburst" value={(detail || selected).cloudburst_probability || 0} />
                <ScoreBar label="⛰️ Landslide" value={(detail || selected).landslide_susceptibility || 0} />
                <ScoreBar label="🏜️ Soil Erosion" value={(detail || selected).erosion_risk || 0} />

                {/* Water Body Proximity */}
                <div className="dp-section-title" style={{ marginTop: 14 }}>
                  🌊 Water Bodies & Proximity
                </div>
                <div style={{ background: '#1e293b', borderRadius: 8, padding: '10px 12px', fontSize: 12, marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ color: '#94a3b8' }}>Distance to river</span>
                    <span style={{ color: (detail || selected).distance_to_river_km < 5 ? '#ef4444' : '#22c55e', fontWeight: 600 }}>
                      {(detail || selected).distance_to_river_km ? `${(detail || selected).distance_to_river_km} km` : '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ color: '#94a3b8' }}>River / Canal Present</span>
                    <span>{(detail || selected).river_canal_present ? '✅ Yes' : '❌ No'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>Surface Water Exposure</span>
                    <span style={{ color: (detail || selected).surface_water_exposure ? '#f97316' : '#22c55e' }}>
                      {(detail || selected).surface_water_exposure ? '⚠️ Exposed' : '✅ Protected'}
                    </span>
                  </div>
                </div>

                {/* Population & Households */}
                <div className="pop-grid" style={{ marginBottom: 12 }}>
                  <div className="pop-item">
                    <div className="pop-num">{((detail || selected).total_population || 0).toLocaleString()}</div>
                    <div className="pop-lbl">Population</div>
                  </div>
                  <div className="pop-item">
                    <div className="pop-num">
                      {(detail || selected).total_households > 0 ? (detail || selected).total_households.toLocaleString() : '—'}
                    </div>
                    <div className="pop-lbl">Households</div>
                  </div>
                </div>

                {/* Google Maps Link */}
                <a
                  href={`https://www.google.com/maps/search/${encodeURIComponent(
                    selected.village_name + ' village ' + selected.subdistrict + ' Vadodara Gujarat'
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    padding: '8px 0',
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: 8,
                    color: '#3b82f6',
                    fontSize: 12,
                    textDecoration: 'none',
                    marginBottom: 10,
                  }}
                >
                  🗺️ Open in Google Maps
                </a>

                {/* Actions */}
                <button
                  className="dp-chat-btn"
                  onClick={() => {
                    setTab('relocation');
                  }}
                  style={{ background: '#f97316', marginBottom: 8 }}
                >
                  🏗️ View Relocation Plan →
                </button>
                <button
                  className="dp-chat-btn"
                  onClick={() => {
                    setTab('chat');
                    setChatInput(`What is the risk assessment and evacuation plan for ${selected.village_name}?`);
                  }}
                >
                  💬 Ask AI About Village
                </button>
              </aside>
            )}
          </div>
        )}

        {/* ══ RELOCATION PLAN TAB ══ */}
        {tab === 'relocation' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 24, maxWidth: 960, margin: '0 auto', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 800 }}>
                  🏗️ Relocation Planning — {selected ? selected.village_name : 'Vadodara District'}
                </h2>
                <p style={{ color: '#64748b', fontSize: 13 }}>
                  Multi-criteria safe site selection, population capacity & evacuation routing
                </p>
              </div>
              <button
                onClick={downloadPDFReport}
                disabled={!selected}
                style={{
                  background: '#1d4ed8',
                  border: 'none',
                  borderRadius: 8,
                  padding: '9px 16px',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  opacity: selected ? 1 : 0.5,
                }}
              >
                📥 Download PDF Report
              </button>
            </div>

            {/* Interactive Origin/Destination Routing Bar */}
            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: 16, marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 12 }}>
                🚦 Evacuation Route & Turn-by-Turn Navigation
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'center' }}>
                <div>
                  <label style={{ fontSize: 11, color: '#64748b' }}>Current Location (Origin)</label>
                  <input
                    value={relocationOrigin}
                    onChange={e => setRelocationOrigin(e.target.value)}
                    placeholder="Enter current village name"
                    style={{
                      width: '100%',
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: 6,
                      padding: '8px 10px',
                      color: '#f1f5f9',
                      fontSize: 13,
                      marginTop: 4,
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#64748b' }}>Designated Relocation Destination</label>
                  <select
                    value={selectedDestination?.site_name || ''}
                    onChange={e => {
                      const found = relocationCandidates.find(c => c.site_name === e.target.value);
                      if (found) setSelectedDestination(found);
                    }}
                    style={{
                      width: '100%',
                      background: '#1e293b',
                      border: '1px solid #334155',
                      color: '#f1f5f9',
                      borderRadius: 6,
                      padding: '8px 10px',
                      fontSize: 13,
                      marginTop: 4,
                    }}
                  >
                    {relocationCandidates.length ? (
                      relocationCandidates.map((c, i) => (
                        <option key={i} value={c.site_name}>
                          {c.site_name} (Cap: {(c.population_capacity || 0).toLocaleString()} people, {c.distance_km} km)
                        </option>
                      ))
                    ) : (
                      <option>Select a candidate site</option>
                    )}
                  </select>
                </div>
                <button
                  onClick={calculateEvacuationRoute}
                  disabled={routeLoading || !relocationCandidates.length}
                  style={{
                    background: '#22c55e',
                    border: 'none',
                    borderRadius: 6,
                    padding: '10px 18px',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                    marginTop: 18,
                  }}
                >
                  {routeLoading ? 'Calculating…' : '🚀 Calculate Route'}
                </button>
              </div>

              {/* Route Summary */}
              {routeData && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #1e293b' }}>
                  <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
                    <div>
                      🛣️ Distance: <strong>{routeData.distance_km} km</strong>
                    </div>
                    <div>
                      ⏱️ Estimated Time: <strong>{routeData.estimated_time_minutes} mins</strong>
                    </div>
                    <div>
                      🚩 Waypoints: <strong>{routeData.waypoints?.length || 0} safe points</strong>
                    </div>
                  </div>
                  {/* Step by step directions */}
                  <div style={{ marginTop: 10, background: '#1e293b', padding: 12, borderRadius: 6, fontSize: 12, color: '#94a3b8' }}>
                    <div style={{ fontWeight: 600, color: '#f1f5f9', marginBottom: 4 }}>Turn-by-Turn Safe Directions:</div>
                    <div>1. Depart from {routeData.route?.from?.name || relocationOrigin} taking the primary rural access road.</div>
                    <div>2. Proceed along high-elevation corridor towards State Highway via Waypoint coordinates.</div>
                    <div>3. Pass bypass checkpoint avoiding local water body runoff buffer.</div>
                    <div>4. Arrive at designated relief site at {routeData.route?.to?.name || selectedDestination?.site_name}.</div>
                  </div>
                </div>
              )}
            </div>

            {/* Candidate Sites with Capacity */}
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Top Candidate Relocation Sites</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 24 }}>
              {relocationCandidates.map((site, i) => (
                <div
                  key={i}
                  onClick={() => setSelectedDestination(site)}
                  style={{
                    background: selectedDestination?.site_name === site.site_name ? '#1e3a5f' : '#0f172a',
                    border: `1px solid ${selectedDestination?.site_name === site.site_name ? '#3b82f6' : '#1e293b'}`,
                    borderRadius: 8,
                    padding: 14,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{site.site_name}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{site.subdistrict} Subdistrict</div>
                    </div>
                    <span style={{ background: '#22c55e22', color: '#22c55e', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                      {((site.suitability_score || 0) * 100).toFixed(0)}% Match
                    </span>
                  </div>

                  <div style={{ marginTop: 12, fontSize: 12, color: '#94a3b8' }}>
                    <div>
                      👥 Population Capacity: <strong style={{ color: '#f1f5f9' }}>{(site.population_capacity || 0).toLocaleString()} people</strong>
                    </div>
                    <div>
                      📏 Distance from Village: <strong>{site.distance_km || '—'} km</strong>
                    </div>
                    <div>
                      🏗️ Buildable Area: <strong>{site.buildable_area_ha || '—'} ha</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ CHAT TAB ══ */}
        {tab === 'chat' && (
          <div className="chat-layout">
            <div className="chat-messages">
              {messages.map((m, i) => (
                <Bubble key={i} role={m.role} content={m.content} />
              ))}
              {chatLoading && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
                    🛡️
                  </div>
                  <div style={{ background: '#1e293b', borderRadius: '16px 16px 16px 4px', padding: '9px 13px', color: '#64748b', fontSize: 13 }}>
                    Analyzing hazard models…
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Suggestions */}
            <div className="chat-suggestions">
              {['Risk in Alampura?', 'Relocate Kanabha?', 'Highest risk villages in Karjan?', 'Flood warning areas'].map(s => (
                <button key={s} className="sug-btn" onClick={() => setChatInput(s)}>
                  {s}
                </button>
              ))}
            </div>

            <div className="chat-input-row">
              <input
                className="chat-input"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendChat()}
                placeholder="Ask about any village, hazard or evacuation plan…"
                disabled={chatLoading}
              />
              <button className="chat-send" onClick={sendChat} disabled={chatLoading || !chatInput.trim()}>
                Send
              </button>
            </div>
          </div>
        )}

        {/* ══ RANKING TAB ══ */}
        {tab === 'ranking' && (
          <div className="ranking-layout">
            <h2 className="rk-title">Village Risk Ranking</h2>
            <p className="rk-sub">All 680 Vadodara villages ranked by multi-hazard composite risk score</p>

            <div className="rk-table-wrap">
              <table className="rk-table">
                <thead>
                  <tr>
                    {['#', 'Village', 'Subdistrict', 'Composite Risk', 'Flood', 'Erosion', 'Cloudburst', 'Landslide', 'Vulnerability', 'Disasters', 'Tier'].map(h => (
                      <th key={h} className="th">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {villages.slice(0, 150).map((v, i) => {
                    const s = v.composite_risk_score || 0;
                    const ti = tierInfo(s);
                    return (
                      <tr
                        key={v.village_code || i}
                        className="tr"
                        onClick={() => {
                          selectVillage(v);
                          setTab('map');
                        }}
                      >
                        <td className="td" style={{ color: '#475569' }}>
                          {i + 1}
                        </td>
                        <td className="td" style={{ fontWeight: 600, color: '#f1f5f9' }}>
                          {v.village_name}
                        </td>
                        <td className="td">{v.subdistrict}</td>
                        <td className="td" style={{ color: riskColor(s), fontWeight: 700 }}>
                          {(s * 100).toFixed(1)}%
                        </td>
                        <td className="td">{((v.flood_hazard_score || 0) * 100).toFixed(1)}%</td>
                        <td className="td">{((v.erosion_risk || 0) * 100).toFixed(1)}%</td>
                        <td className="td">{((v.cloudburst_probability || 0) * 100).toFixed(1)}%</td>
                        <td className="td">{((v.landslide_susceptibility || 0) * 100).toFixed(1)}%</td>
                        <td className="td" style={{ color: riskColor(v.vulnerability_score || 0) }}>
                          {((v.vulnerability_score || 0) * 100).toFixed(0)}%
                        </td>
                        <td className="td">
                          {disasterHistory[v.village_name]?.length ? (
                            <span style={{ color: '#ef4444' }}>⚠️ Recorded</span>
                          ) : (
                            <span style={{ color: '#475569' }}>—</span>
                          )}
                        </td>
                        <td className="td">
                          <span style={{ background: ti.bg + '22', color: ti.bg, border: `1px solid ${ti.bg}44`, borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>
                            {ti.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
