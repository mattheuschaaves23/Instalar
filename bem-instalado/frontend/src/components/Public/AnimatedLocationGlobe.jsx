import { geoGraticule10, geoOrthographic, geoPath } from 'd3-geo';
import { useEffect, useRef, useState } from 'react';
import { feature, mesh } from 'topojson-client';
import worldAtlas from 'world-atlas/countries-110m.json';

const topology = worldAtlas;
const countries = feature(topology, topology.objects.countries);
const countryBorders = mesh(topology, topology.objects.countries, (left, right) => left !== right);
const graticule = geoGraticule10();
const sphere = { type: 'Sphere' };

function easeInOut(progress) {
  return (1 - Math.cos(Math.PI * progress)) / 2;
}

function isValidTarget(target) {
  return Number.isFinite(Number(target?.latitude)) && Number.isFinite(Number(target?.longitude));
}

function getTargetTitle(target) {
  return target?.city || target?.state || target?.label || 'sua região';
}

export default function AnimatedLocationGlobe({ locating = false, resolving = false, target = null }) {
  const canvasRef = useRef(null);
  const targetRef = useRef(target);
  const reducedMotionRef = useRef(false);
  const animationRef = useRef({
    viewLongitude: -24,
    viewLatitude: 8,
    viewZoom: 1,
    fromLongitude: -24,
    fromLatitude: 8,
    toLongitude: -24,
    toLatitude: 8,
    phaseStarted: 0,
    phase: 'idle',
    targetKey: '',
  });
  const [visualStage, setVisualStage] = useState('idle');

  useEffect(() => {
    const animation = animationRef.current;
    targetRef.current = target;

    if (isValidTarget(target)) {
      const targetKey = `${Number(target.latitude).toFixed(5)}:${Number(target.longitude).toFixed(5)}`;
      if (targetKey === animation.targetKey) {
        return;
      }

      animation.targetKey = targetKey;
      animation.toLongitude = Number(target.longitude);
      animation.toLatitude = Number(target.latitude);
      animation.fromLongitude = animation.viewLongitude;
      animation.fromLatitude = animation.viewLatitude;
      animation.phaseStarted = performance.now();

      if (reducedMotionRef.current) {
        animation.viewLongitude = animation.toLongitude;
        animation.viewLatitude = animation.toLatitude;
        animation.viewZoom = 1.62;
        animation.phase = 'focused';
        setVisualStage('complete');
      } else {
        animation.phase = 'spin-up';
        setVisualStage('spinning');
      }
      return;
    }

    animation.targetKey = '';
    animation.phase = locating || resolving ? 'scanning' : 'idle';
    setVisualStage(locating ? 'locating' : resolving ? 'resolving' : 'idle');
  }, [locating, resolving, target]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return undefined;
    }

    reducedMotionRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let frame = 0;
    let previousFrame = performance.now();
    let size = 440;

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      size = Math.max(220, bounds.width || 440);
      canvas.width = Math.round(size * pixelRatio);
      canvas.height = Math.round(size * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    observer?.observe(canvas);
    window.addEventListener('resize', resize);
    resize();

    const draw = (now) => {
      const elapsed = Math.min(now - previousFrame, 40);
      previousFrame = now;
      const animation = animationRef.current;

      if (animation.phase === 'spin-up') {
        const progress = Math.min((now - animation.phaseStarted) / 1050, 1);
        animation.viewLongitude = (animation.viewLongitude + elapsed * 0.075) % 360;
        animation.viewLatitude += (8 - animation.viewLatitude) * 0.022;
        animation.viewZoom += (1 - animation.viewZoom) * 0.04;

        if (progress >= 1) {
          animation.fromLongitude = animation.viewLongitude;
          animation.fromLatitude = animation.viewLatitude;
          animation.phaseStarted = now;
          animation.phase = 'traveling';
          setVisualStage('traveling');
        }
      } else if (animation.phase === 'traveling') {
        const progress = Math.min((now - animation.phaseStarted) / 1550, 1);
        const eased = easeInOut(progress);
        const longitudeDistance =
          ((animation.toLongitude - animation.fromLongitude + 540) % 360) - 180;
        animation.viewLongitude = animation.fromLongitude + longitudeDistance * eased;
        animation.viewLatitude =
          animation.fromLatitude + (animation.toLatitude - animation.fromLatitude) * eased;
        animation.viewZoom = 1;

        if (progress >= 1) {
          animation.viewLongitude = animation.toLongitude;
          animation.viewLatitude = animation.toLatitude;
          animation.phaseStarted = now;
          animation.phase = 'focusing';
          setVisualStage('focusing');
        }
      } else if (animation.phase === 'focusing') {
        const progress = Math.min((now - animation.phaseStarted) / 1450, 1);
        animation.viewLongitude = animation.toLongitude;
        animation.viewLatitude = animation.toLatitude;
        animation.viewZoom = 1 + 0.62 * easeInOut(progress);

        if (progress >= 1) {
          animation.viewZoom = 1.62;
          animation.phase = 'focused';
          setVisualStage('complete');
        }
      } else if (animation.phase === 'focused') {
        animation.viewLongitude += (animation.toLongitude - animation.viewLongitude) * 0.04;
        animation.viewLatitude += (animation.toLatitude - animation.viewLatitude) * 0.04;
        animation.viewZoom += (1.62 - animation.viewZoom) * 0.04;
      } else {
        const speed = animation.phase === 'scanning' ? 0.035 : 0.0055;
        animation.viewLongitude = (animation.viewLongitude + elapsed * speed) % 360;
        animation.viewLatitude += (8 - animation.viewLatitude) * 0.018;
        animation.viewZoom += (1 - animation.viewZoom) * 0.025;
      }

      context.clearRect(0, 0, size, size);

      const centerX = size / 2;
      const centerY = size / 2;
      const radius = size * 0.34 * animation.viewZoom;
      const projection = geoOrthographic()
        .translate([centerX, centerY])
        .scale(radius)
        .clipAngle(90)
        .precision(0.4)
        .rotate([-animation.viewLongitude, -animation.viewLatitude, 0]);
      const path = geoPath(projection, context);

      const halo = context.createRadialGradient(
        centerX,
        centerY,
        radius * 0.65,
        centerX,
        centerY,
        radius * 1.42
      );
      halo.addColorStop(0, 'rgba(81, 164, 135, 0.26)');
      halo.addColorStop(0.6, 'rgba(36, 111, 88, 0.12)');
      halo.addColorStop(1, 'rgba(13, 45, 36, 0)');
      context.beginPath();
      context.arc(centerX, centerY, radius * 1.42, 0, Math.PI * 2);
      context.fillStyle = halo;
      context.fill();

      const ocean = context.createRadialGradient(
        centerX - radius * 0.34,
        centerY - radius * 0.42,
        radius * 0.06,
        centerX,
        centerY,
        radius * 1.16
      );
      ocean.addColorStop(0, '#56a48f');
      ocean.addColorStop(0.5, '#236858');
      ocean.addColorStop(1, '#082b24');
      context.beginPath();
      path(sphere);
      context.fillStyle = ocean;
      context.fill();

      context.beginPath();
      path(graticule);
      context.strokeStyle = 'rgba(231, 242, 216, 0.13)';
      context.lineWidth = 0.65;
      context.stroke();

      context.save();
      context.shadowColor = 'rgba(2, 20, 15, 0.38)';
      context.shadowBlur = 6;
      context.beginPath();
      path(countries);
      context.fillStyle = '#a8c982';
      context.fill();
      context.restore();

      context.beginPath();
      path(countryBorders);
      context.strokeStyle = 'rgba(246, 244, 215, 0.48)';
      context.lineWidth = 0.65;
      context.stroke();

      context.save();
      context.beginPath();
      path(sphere);
      context.clip();
      const shade = context.createLinearGradient(
        centerX - radius,
        centerY - radius,
        centerX + radius,
        centerY + radius
      );
      shade.addColorStop(0, 'rgba(255, 255, 225, 0.18)');
      shade.addColorStop(0.48, 'rgba(255, 255, 255, 0)');
      shade.addColorStop(1, 'rgba(0, 15, 11, 0.46)');
      context.fillStyle = shade;
      context.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
      context.restore();

      const currentTarget = targetRef.current;
      if (
        isValidTarget(currentTarget) &&
        (animation.phase === 'focusing' || animation.phase === 'focused')
      ) {
        const projected = projection([
          Number(currentTarget.longitude),
          Number(currentTarget.latitude),
        ]);
        if (projected) {
          const pulse = 13 + Math.sin(now / 220) * 4;
          context.beginPath();
          context.arc(projected[0], projected[1], pulse, 0, Math.PI * 2);
          context.strokeStyle = 'rgba(244, 190, 73, 0.62)';
          context.lineWidth = 2;
          context.stroke();

          context.beginPath();
          context.arc(projected[0], projected[1], 7, 0, Math.PI * 2);
          context.fillStyle = '#f2c84b';
          context.shadowColor = 'rgba(242, 200, 75, 0.95)';
          context.shadowBlur = 14;
          context.fill();
          context.shadowBlur = 0;

          context.beginPath();
          context.arc(projected[0], projected[1], 2.4, 0, Math.PI * 2);
          context.fillStyle = '#fff7d6';
          context.fill();
        }
      }

      context.beginPath();
      path(sphere);
      context.strokeStyle = 'rgba(213, 235, 198, 0.46)';
      context.lineWidth = 1.5;
      context.stroke();

      frame = window.requestAnimationFrame(draw);
    };

    frame = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, []);

  const activeStage = locating ? 'locating' : resolving ? 'resolving' : visualStage;
  const stageLabel =
    activeStage === 'locating'
      ? 'Buscando sua localização'
      : activeStage === 'resolving'
        ? 'Confirmando o endereço'
        : activeStage === 'spinning'
          ? 'Girando o globo'
          : activeStage === 'traveling'
            ? `Viajando até ${getTargetTitle(target)}`
            : activeStage === 'focusing'
              ? `Aproximando de ${getTargetTitle(target)}`
              : activeStage === 'complete'
                ? 'Região encontrada'
                : 'Globo ao vivo';

  return (
    <div
      className={`client-app-geo-globe is-${activeStage}`}
      data-testid="guided-location-globe"
    >
      <span className="client-app-geo-orbit client-app-geo-orbit--one" aria-hidden="true" />
      <span className="client-app-geo-orbit client-app-geo-orbit--two" aria-hidden="true" />
      <canvas
        aria-label={
          isValidTarget(target)
            ? `Globo animado mostrando ${getTargetTitle(target)}`
            : 'Globo terrestre girando'
        }
        className="client-app-geo-globe-canvas"
        ref={canvasRef}
        role="img"
      />
      <div className="client-app-geo-status" aria-live="polite" role="status">
        <i aria-hidden="true" />
        <span>{stageLabel}</span>
      </div>
      {isValidTarget(target) && activeStage === 'complete' ? (
        <div className="client-app-geo-location">
          <i aria-hidden="true" />
          <span>
            <strong>{target.label || target.city}</strong>
            <small>{[target.neighborhood, target.city, target.state].filter(Boolean).join(' · ')}</small>
          </span>
        </div>
      ) : null}
    </div>
  );
}
