import React, { useEffect, useState } from 'react';

export default function LoadingScreen({ onComplete }) {
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState('Connecting to Suraksha ML backend…');

  useEffect(() => {
    const steps = [
      [15, 'Connecting to FastAPI backend (localhost:8001)…'],
      [30, 'Initializing TensorFlow neural network models…'],
      [50, 'Loading multi-hazard models (Flood, Landslide, Cloudburst, Erosion)…'],
      [70, 'Pre-computing Vadodara 680-village risk scores…'],
      [85, 'Rendering subdistrict hazard choropleth zones…'],
      [95, 'Finalizing disaster mitigation & routing system…'],
      [100, 'Welcome to Project Suraksha!'],
    ];

    let i = 0;
    const interval = setInterval(() => {
      if (i < steps.length) {
        setProgress(steps[i][0]);
        setStatusMsg(steps[i][1]);
        i++;
      } else {
        clearInterval(interval);
        if (onComplete) {
          setTimeout(onComplete, 400);
        }
      }
    }, 450);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#020817',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Grid Pattern Background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.04,
          backgroundImage:
            'linear-gradient(#3b82f6 1px, transparent 1px), linear-gradient(90deg, #3b82f6 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Animated Shield Logo */}
      <div
        style={{
          width: 84,
          height: 84,
          borderRadius: 22,
          background: 'linear-gradient(135deg, #1d4ed8, #0f172a)',
          border: '2px solid #334155',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 42,
          boxShadow: '0 0 50px rgba(59,130,246,0.35)',
          animation: 'shieldPulse 2s ease-in-out infinite',
          marginBottom: 24,
          position: 'relative',
        }}
      >
        🛡️
      </div>

      <h1
        style={{
          color: '#f1f5f9',
          fontSize: 26,
          fontWeight: 800,
          letterSpacing: '-0.5px',
          margin: 0,
        }}
      >
        Project Suraksha
      </h1>
      <p
        style={{
          color: '#64748b',
          fontSize: 13,
          marginTop: 6,
          marginBottom: 36,
        }}
      >
        SIH26191 · Vadodara Multi-Hazard Risk Assessment & Mitigation System
      </p>

      {/* Progress Bar Container */}
      <div
        style={{
          width: 320,
          background: '#1e293b',
          borderRadius: 8,
          height: 6,
          overflow: 'hidden',
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5)',
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: 6,
            borderRadius: 8,
            background: 'linear-gradient(90deg, #1d4ed8, #3b82f6)',
            transition: 'width 0.4s ease',
            boxShadow: '0 0 10px rgba(59,130,246,0.6)',
          }}
        />
      </div>

      <p style={{ color: '#3b82f6', fontSize: 13, fontWeight: 700, marginTop: 12 }}>
        {progress}%
      </p>
      <p style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>
        {statusMsg}
      </p>

      {/* Animated Activity Dots */}
      <div style={{ display: 'flex', gap: 8, marginTop: 28 }}>
        {[0, 1, 2].map(idx => (
          <div
            key={idx}
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: '#3b82f6',
              animation: `pulseDot 1.2s ${idx * 0.2}s ease-in-out infinite`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes shieldPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 50px rgba(59,130,246,0.35); }
          50% { transform: scale(1.05); box-shadow: 0 0 70px rgba(59,130,246,0.65); }
        }
        @keyframes pulseDot {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.5); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
