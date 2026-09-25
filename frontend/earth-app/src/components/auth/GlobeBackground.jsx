import React, { useEffect, useRef } from 'react';

/**
 * GlobeBackground — Renders a realistic 3D rotating Earth with atmospheric glow
 * and starry space backdrop for the Login screen.
 */
export default function GlobeBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Generate static stars
    const stars = Array.from({ length: 180 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 1.5 + 0.5,
      alpha: Math.random() * 0.8 + 0.2,
      flickerSpeed: Math.random() * 0.02 + 0.005,
    }));

    // Continents coordinates approximation for rotating sphere
    // [lat, lon, radius, shapeFactor]
    const landmasses = [
      // India & South Asia
      { lat: 20, lon: 78, r: 18 },
      { lat: 25, lon: 82, r: 24 },
      { lat: 12, lon: 77, r: 14 },
      // East Asia / China
      { lat: 35, lon: 105, r: 35 },
      { lat: 45, lon: 115, r: 30 },
      // Europe
      { lat: 50, lon: 15, r: 28 },
      { lat: 40, lon: 5, r: 20 },
      // Africa
      { lat: 5, lon: 22, r: 40 },
      { lat: -15, lon: 25, r: 32 },
      { lat: -25, lon: 28, r: 22 },
      // Middle East
      { lat: 28, lon: 45, r: 20 },
      // Australia / Pacific
      { lat: -25, lon: 135, r: 28 },
      // Americas (backside)
      { lat: 40, lon: -100, r: 40 },
      { lat: -15, lon: -60, r: 38 },
    ];

    let rotationAngle = 0;

    const render = () => {
      ctx.fillStyle = '#02050e';
      ctx.fillRect(0, 0, width, height);

      // 1. Draw Space Stars
      stars.forEach(star => {
        star.alpha += Math.sin(Date.now() * star.flickerSpeed) * 0.01;
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.2, Math.min(1, star.alpha))})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      const centerX = width / 2;
      const centerY = height / 2;
      const globeRadius = Math.min(width, height) * 0.38;

      // 2. Outer Atmospheric Glow
      const glowGrad = ctx.createRadialGradient(
        centerX,
        centerY,
        globeRadius * 0.95,
        centerX,
        centerY,
        globeRadius * 1.25
      );
      glowGrad.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
      glowGrad.addColorStop(0.5, 'rgba(30, 64, 175, 0.2)');
      glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, globeRadius * 1.25, 0, Math.PI * 2);
      ctx.fill();

      // 3. Globe Ocean Base Sphere
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, globeRadius, 0, Math.PI * 2);
      ctx.clip();

      // Ocean 3D shading
      const oceanGrad = ctx.createRadialGradient(
        centerX - globeRadius * 0.35,
        centerY - globeRadius * 0.35,
        globeRadius * 0.1,
        centerX,
        centerY,
        globeRadius
      );
      oceanGrad.addColorStop(0, '#1d4ed8');
      oceanGrad.addColorStop(0.4, '#1e3a8a');
      oceanGrad.addColorStop(0.8, '#0f172a');
      oceanGrad.addColorStop(1, '#020617');

      ctx.fillStyle = oceanGrad;
      ctx.fillRect(centerX - globeRadius, centerY - globeRadius, globeRadius * 2, globeRadius * 2);

      // 4. Rotating Continents
      rotationAngle += 0.0035;

      landmasses.forEach(land => {
        const currentLon = (land.lon + (rotationAngle * 180) / Math.PI) % 360;
        // Normalize lon to -180 .. 180
        const normLon = ((currentLon + 180) % 360) - 180;

        // Only draw visible hemisphere
        if (normLon > -90 && normLon < 90) {
          const latRad = (land.lat * Math.PI) / 180;
          const lonRad = (normLon * Math.PI) / 180;

          // Spherical orthographic projection
          const x = centerX + globeRadius * Math.cos(latRad) * Math.sin(lonRad);
          const y = centerY - globeRadius * Math.sin(latRad);
          const distFromCenter = Math.hypot(x - centerX, y - centerY);

          if (distFromCenter < globeRadius) {
            // Foreshortening factor near edge
            const depth = Math.cos(latRad) * Math.cos(lonRad);
            const radius = (land.r * (globeRadius / 200)) * Math.max(0.3, depth);

            const landGrad = ctx.createRadialGradient(x, y, 0, x, y, radius);
            landGrad.addColorStop(0, '#34d399');
            landGrad.addColorStop(0.6, '#059669');
            landGrad.addColorStop(1, '#064e3b');

            ctx.fillStyle = landGrad;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      });

      // 5. Cloud Bands Overlay
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.beginPath();
      ctx.arc(centerX + Math.sin(rotationAngle * 0.7) * 40, centerY - 20, globeRadius * 0.7, 0, Math.PI * 2);
      ctx.fill();

      // 6. Day/Night Shadow terminator across the globe
      const shadowGrad = ctx.createLinearGradient(
        centerX - globeRadius,
        centerY - globeRadius,
        centerX + globeRadius,
        centerY + globeRadius
      );
      shadowGrad.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
      shadowGrad.addColorStop(0.45, 'rgba(0, 0, 0, 0)');
      shadowGrad.addColorStop(0.75, 'rgba(0, 0, 0, 0.65)');
      shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0.92)');

      ctx.fillStyle = shadowGrad;
      ctx.fillRect(centerX - globeRadius, centerY - globeRadius, globeRadius * 2, globeRadius * 2);

      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 4900,
        display: 'block',
        pointerEvents: 'none',
      }}
    />
  );
}
