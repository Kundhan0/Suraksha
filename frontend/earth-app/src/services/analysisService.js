const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8001';

export async function analyzeArea(areaData) {
  const res = await fetch(`${API_BASE}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(areaData),
  });
  if (!res.ok) throw new Error(`Analysis error: ${res.status}`);
  return res.json();
}
