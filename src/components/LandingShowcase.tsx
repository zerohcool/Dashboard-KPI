import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import {
  ArrowUp, BellRing, Calculator, CalendarRange, ChartGantt, CircleCheck, CircleX,
  Cloud, FileDown, Scale, ShieldCheck, X
} from 'lucide-react';
import logoBlanca from '../Logo Enaex Letra Blanca.png';
import logoGris from '../Logo Enaex Letra Gris.png';
import imgFlota from '../assets/landing/flota.webp';
import imgMaterias from '../assets/landing/materias.webp';
import imgDotacion from '../assets/landing/dotacion.webp';
import imgEvaluacion from '../assets/landing/evaluacion.webp';
import imgDetalle from '../assets/landing/detalle.webp';
import './LandingShowcase.css';

gsap.registerPlugin(ScrollTrigger);

const features = [
  {
    img: imgMaterias,
    eyebrow: 'Materias primas',
    title: 'Stock de nitrato y matriz, día a día',
    text: 'Registro diario de insumos comparado contra el mínimo contractual de 170 t, con la tendencia del período y el cumplimiento global de stock.',
    alt: 'Gráfico de evolución diaria de stock de nitrato y matriz'
  },
  {
    img: imgDotacion,
    eyebrow: 'Dotación',
    title: 'Asistencia por cargo con alertas automáticas',
    text: 'Dotación semanal de miércoles a martes, con rosters 4x3 y 7x7 calculados solos y alerta inmediata cuando un cargo cae bajo lo contratado.',
    alt: 'Gráfico de porcentaje de asistencia promedio por cargo'
  },
  {
    img: imgEvaluacion,
    eyebrow: 'Estado de Pago',
    title: 'La nota del contrato, calculada cada día',
    text: 'Nota final ponderada y multiplicador MDC del Estado de Pago, con un simulador de facturación en USD al dólar del día.',
    alt: 'Panel de nota final de contrato y multiplicador del Estado de Pago'
  },
  {
    img: imgDetalle,
    eyebrow: 'Trazabilidad',
    title: 'Cada punto respaldado ante el mandante',
    text: 'Detalle de cada KPI con su ponderación, meta y valor real. Exportable a PDF y Excel para el cierre del EDP.',
    alt: 'Tabla de evaluación ponderada de disponibilidad y calidad de servicio'
  }
];

const pillars = [
  { value: 31, label: 'Flota y materias primas', tone: 'p1' },
  { value: 49, label: 'Calidad de servicio', tone: 'p2' },
  { value: 10, label: 'Seguridad', tone: 'p3' },
  { value: 10, label: 'Dotación semanal', tone: 'p4' }
];

const capabilities = [
  { icon: ChartGantt, title: 'Carta Gantt horaria', text: 'Estado hora a hora de cada equipo, en vista continua de 5 semanas.' },
  { icon: BellRing, title: 'Alertas automáticas', text: 'Déficit de dotación y días sin registro, detectados al instante.' },
  { icon: Calculator, title: 'Simulador de EDP', text: 'Proyecta el pago en USD con el dólar del día y el tramo MDC.' },
  { icon: FileDown, title: 'PDF y Excel', text: 'Reportes listos para respaldar el Estado de Pago.' },
  { icon: CalendarRange, title: 'Período comercial', text: 'Filtros por EDP (21 al 20), 7 o 15 días y mes en curso.' },
  { icon: ShieldCheck, title: 'Roles y accesos', text: 'Perfiles Administrador y Usuario con permisos diferenciados.' },
  { icon: Cloud, title: 'Datos en la nube', text: 'Base centralizada, acceso web desde faena u oficina.' },
  { icon: Scale, title: 'Reglas del contrato', text: 'Metas, ponderaciones y rosters configurables sin programar.' }
];

const benefits = [
  ['KPI dispersos en planillas separadas', 'Una plataforma única con todos los KPI'],
  ['Nota calculada a mano al cierre', 'Nota ponderada automática cada día'],
  ['Desvíos detectados tarde', 'Alertas tempranas antes del día 20'],
  ['Respaldo disperso ante el mandante', 'Trazabilidad diaria y reportes exportables']
];

const splitWords = (text: string) =>
  text.split(' ').map((w, i) => (
    <span className="lp-word" key={i}><span className="lp-word-inner">{w}</span></span>
  ));

interface LandingShowcaseProps {
  scrollTargetId: string;
  theme: 'light' | 'dark';
}

interface ZoomState {
  src: string;
  alt: string;
  source: HTMLElement;
}

// Caja final del visor: imagen completa centrada, respetando su proporción
const targetBox = (img: HTMLImageElement) => {
  const ratio = (img.naturalWidth || 16) / (img.naturalHeight || 10);
  const maxW = window.innerWidth * 0.92;
  const maxH = window.innerHeight * 0.86;
  let w = maxW;
  let h = w / ratio;
  if (h > maxH) { h = maxH; w = h * ratio; }
  return { left: (window.innerWidth - w) / 2, top: (window.innerHeight - h) / 2, width: w, height: h };
};

export const LandingShowcase: React.FC<LandingShowcaseProps> = ({ scrollTargetId, theme }) => {
  const root = useRef<HTMLDivElement>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const [zoom, setZoom] = useState<ZoomState | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);

  const openZoom = (e: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => {
    const host = e.currentTarget;
    const img = host.querySelector('img');
    if (!img) return;
    closingRef.current = false;
    setZoom({ src: img.currentSrc || img.src, alt: img.alt, source: host });
  };

  const zoomKey = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openZoom(e); }
  };

  // Animación de apertura: desde la posición de la miniatura hasta el centro
  useLayoutEffect(() => {
    if (!zoom || !boxRef.current) return;
    lenisRef.current?.stop();
    const box = boxRef.current;
    const img = box.querySelector('img') as HTMLImageElement;
    const from = zoom.source.getBoundingClientRect();
    const run = () => {
      const to = targetBox(img);
      gsap.set(box, { left: from.left, top: from.top, width: from.width, height: from.height, borderRadius: 18 });
      gsap.to(box, { ...to, borderRadius: 12, duration: 0.75, ease: 'expo.inOut' });
      gsap.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power2.out' });
      gsap.fromTo('.lp-zoom-close', { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.4, delay: 0.45, ease: 'back.out(2)' });
    };
    gsap.set(box, { left: from.left, top: from.top, width: from.width, height: from.height });
    if (img.complete) run(); else img.onload = run;
  }, [zoom]);

  const closeZoom = useCallback(() => {
    if (!zoom || !boxRef.current || closingRef.current) return;
    closingRef.current = true;
    const to = zoom.source.getBoundingClientRect();
    gsap.to('.lp-zoom-close', { opacity: 0, duration: 0.15 });
    gsap.to(backdropRef.current, { opacity: 0, duration: 0.5, delay: 0.1, ease: 'power2.in' });
    gsap.to(boxRef.current, {
      left: to.left, top: to.top, width: to.width, height: to.height, borderRadius: 18,
      duration: 0.6, ease: 'expo.inOut',
      onComplete: () => {
        setZoom(null);
        lenisRef.current?.start();
        zoom.source.focus({ preventScroll: true });
      }
    });
  }, [zoom]);

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeZoom(); };
    const onResize = () => { if (boxRef.current) gsap.set(boxRef.current, targetBox(boxRef.current.querySelector('img') as HTMLImageElement)); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('resize', onResize); };
  }, [zoom, closeZoom]);

  useLayoutEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Smooth scroll cinemático (Lenis) sincronizado con ScrollTrigger
    let tick: ((t: number) => void) | null = null;
    if (!reduce) {
      const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, anchors: { duration: 1.6 } });
      lenisRef.current = lenis;
      lenis.on('scroll', ScrollTrigger.update);
      tick = (t: number) => lenis.raf(t * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
    }

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        // Intro: palabras que suben
        gsap.from('.lp-intro .lp-word-inner', {
          yPercent: 110,
          duration: 1.1,
          ease: 'expo.out',
          stagger: 0.04,
          scrollTrigger: { trigger: '.lp-intro', start: 'top 75%' }
        });
        gsap.from('.lp-intro .lp-fade', {
          y: 30, opacity: 0, duration: 1, ease: 'power3.out', stagger: 0.12,
          scrollTrigger: { trigger: '.lp-intro', start: 'top 65%' }
        });

        // Escena cinemática: la imagen se expande al hacer scroll
        const cinema = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: '.lp-cinema',
            start: 'top top',
            end: '+=170%',
            scrub: 1,
            pin: true,
            anticipatePin: 1
          }
        });
        cinema
          .fromTo('.lp-cinema-frame', { scale: 0.42, borderRadius: 32 }, { scale: 1, borderRadius: 14, duration: 1 }, 0)
          .fromTo('.lp-cinema-frame img', { scale: 1.35, yPercent: 6 }, { scale: 1, yPercent: 0, duration: 1 }, 0)
          .to('.lp-cinema-word.left', { yPercent: -160, opacity: 0, duration: 0.6 }, 0)
          .to('.lp-cinema-word.right', { yPercent: 160, opacity: 0, duration: 0.6 }, 0)
          .fromTo('.lp-cinema-caption', { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.25 }, 0.8);

        // Filas de funcionalidades: revelado + parallax interno
        gsap.utils.toArray<HTMLElement>('.lp-feature').forEach((row) => {
          const media = row.querySelector('.lp-media');
          const img = row.querySelector('.lp-media img');
          const copy = row.querySelectorAll('.lp-copy > *');

          gsap.fromTo(media,
            { clipPath: 'inset(18% 12% 18% 12% round 28px)' },
            {
              clipPath: 'inset(0% 0% 0% 0% round 18px)',
              ease: 'none',
              scrollTrigger: { trigger: row, start: 'top 90%', end: 'center 55%', scrub: 1 }
            });
          gsap.fromTo(img,
            { scale: 1.3, yPercent: -8 },
            {
              scale: 1.04, yPercent: 8,
              ease: 'none',
              scrollTrigger: { trigger: row, start: 'top bottom', end: 'bottom top', scrub: true }
            });
          gsap.from(copy, {
            y: 50, opacity: 0, duration: 1, ease: 'power3.out', stagger: 0.1,
            scrollTrigger: { trigger: row, start: 'top 70%' }
          });
        });

        // Pilares ponderados: barra + contadores (se repite cada vez que se entra a la sección)
        const pillarsTl = gsap.timeline({ paused: true });
        pillarsTl
          .fromTo('.lp-bar-seg', { scaleX: 0 }, { scaleX: 1, transformOrigin: 'left center', duration: 1.2, ease: 'expo.out', stagger: 0.12 }, 0)
          .fromTo('.lp-pillar', { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: 'power3.out', stagger: 0.1 }, 0.1);
        gsap.utils.toArray<HTMLElement>('.lp-count').forEach((el, i) => {
          const target = Number(el.dataset.value);
          const obj = { v: 0 };
          pillarsTl.fromTo(obj, { v: 0 }, {
            v: target, duration: 1.6, ease: 'power2.out',
            onUpdate: () => { el.textContent = `${Math.round(obj.v)}%`; }
          }, 0.1 + i * 0.1);
        });
        ScrollTrigger.create({
          trigger: '.lp-pillars',
          start: 'top 70%',
          end: 'bottom 30%',
          onEnter: () => pillarsTl.restart(),
          onEnterBack: () => pillarsTl.restart(),
          onLeave: () => pillarsTl.pause(0),
          onLeaveBack: () => pillarsTl.pause(0)
        });

        // Capacidades: las tarjetas se arman con el scroll (scrub), cada columna a distinto ritmo
        gsap.utils.toArray<HTMLElement>('.lp-cap').forEach((card, i) => {
          const col = i % 4;
          gsap.fromTo(card,
            { y: 140 + col * 50, opacity: 0, rotateX: -35, scale: 0.88 },
            {
              y: 0, opacity: 1, rotateX: 0, scale: 1, ease: 'power2.out',
              scrollTrigger: { trigger: '.lp-caps', start: `top ${95 - col * 4}%`, end: `top ${45 - col * 4}%`, scrub: 1 }
            });
          gsap.fromTo(card.querySelector('.lp-cap-icon'),
            { rotate: -90, scale: 0.4 },
            {
              rotate: 0, scale: 1, ease: 'back.out(1.6)',
              scrollTrigger: { trigger: card, start: 'top 95%', end: 'top 60%', scrub: 1 }
            });
        });

        // Beneficios: columnas desde los lados
        gsap.from('.lp-col.before', {
          x: -80, opacity: 0, duration: 1.1, ease: 'expo.out',
          scrollTrigger: { trigger: '.lp-benefits', start: 'top 70%' }
        });
        gsap.from('.lp-col.after', {
          x: 80, opacity: 0, duration: 1.1, ease: 'expo.out', delay: 0.1,
          scrollTrigger: { trigger: '.lp-benefits', start: 'top 70%' }
        });

        // Cierre: titular con zoom suave
        gsap.fromTo('.lp-cta-title', { scale: 0.85, opacity: 0.2 }, {
          scale: 1, opacity: 1, ease: 'none',
          scrollTrigger: { trigger: '.lp-cta', start: 'top bottom', end: 'center center', scrub: 1 }
        });

        // Logo Enaex: se revela de izquierda a derecha con desenfoque al hacer scroll
        gsap.timeline({
          scrollTrigger: { trigger: '.lp-cta-logo', start: 'top 95%', end: 'top 55%', scrub: 1 }
        })
          .fromTo('.lp-cta-logo', { clipPath: 'inset(0% 100% 0% 0%)', filter: 'blur(14px)', scale: 0.7, opacity: 0 },
            { clipPath: 'inset(0% 0% 0% 0%)', filter: 'blur(0px)', scale: 1, opacity: 1, ease: 'power2.out' })
          .fromTo('.lp-cta-btn', { y: 30, opacity: 0 }, { y: 0, opacity: 1, ease: 'power2.out' }, 0.5);

        // Glows de fondo con parallax lento
        gsap.to('.lp-orb.a', { yPercent: -60, ease: 'none', scrollTrigger: { trigger: root.current, start: 'top bottom', end: 'bottom top', scrub: true } });
        gsap.to('.lp-orb.b', { yPercent: 50, ease: 'none', scrollTrigger: { trigger: root.current, start: 'top bottom', end: 'bottom top', scrub: true } });
      });
    }, root);

    // Recalcular cuando cargan las imágenes
    const onLoad = () => ScrollTrigger.refresh();
    window.addEventListener('load', onLoad);

    return () => {
      window.removeEventListener('load', onLoad);
      ctx.revert();
      if (tick) gsap.ticker.remove(tick);
      lenisRef.current?.destroy();
      lenisRef.current = null;
    };
  }, []);

  const scrollToLogin = () => {
    const el = document.getElementById(scrollTargetId);
    if (lenisRef.current) lenisRef.current.scrollTo(0, { duration: 1.8 });
    else el?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="lp" ref={root}>
      <div className="lp-orb a" aria-hidden="true" />
      <div className="lp-orb b" aria-hidden="true" />

      {/* Intro */}
      <section className="lp-intro" id="lp-intro">
        <p className="lp-eyebrow lp-fade">Dashboard KPI de Contrato · Planta Sierra Gorda</p>
        <h2 className="lp-h1">
          <span className="lp-line">{splitWords('Todos los KPI del contrato,')}</span>
          <span className="lp-line">{splitWords('en una sola plataforma.')}</span>
        </h2>
        <p className="lp-lead lp-fade">
          Flota, materias primas, dotación, calidad y seguridad registrados a diario. La nota del
          contrato y su efecto en el Estado de Pago, siempre al día.
        </p>
        <div className="lp-meta lp-fade">
          <span><strong>6</strong> módulos</span>
          <span><strong>4</strong> pilares de evaluación</span>
          <span><strong>12 h</strong> turno contractual</span>
        </div>
      </section>

      {/* Escena cinemática */}
      <section className="lp-cinema">
        <div className="lp-cinema-words" aria-hidden="true">
          <span className="lp-cinema-word left">Visibilidad</span>
          <span className="lp-cinema-word right">diaria</span>
        </div>
        <div
          className="lp-cinema-frame lp-zoomable"
          role="button"
          tabIndex={0}
          aria-label="Ampliar imagen: Dashboard de disponibilidad de flota"
          onClick={openZoom}
          onKeyDown={zoomKey}
        >
          <img src={imgFlota} alt="Dashboard de disponibilidad de flota" />
          <div className="lp-cinema-caption">
            <span className="lp-chip">Disponibilidad de flota</span>
            <p><strong>99,4%</strong> de disponibilidad · 3.577 de 3.600 h entregadas en el EDP de octubre</p>
          </div>
        </div>
      </section>

      {/* Funcionalidades */}
      <section className="lp-features">
        {features.map((f, i) => (
          <article className={`lp-feature ${i % 2 ? 'rev' : ''}`} key={f.title}>
            <div
              className="lp-media lp-zoomable"
              role="button"
              tabIndex={0}
              aria-label={`Ampliar imagen: ${f.alt}`}
              onClick={openZoom}
              onKeyDown={zoomKey}
            >
              <img src={f.img} alt={f.alt} loading="lazy" />
            </div>
            <div className="lp-copy">
              <span className="lp-index">{String(i + 1).padStart(2, '0')}</span>
              <p className="lp-eyebrow">{f.eyebrow}</p>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          </article>
        ))}
      </section>

      {/* Modelo ponderado */}
      <section className="lp-pillars">
        <p className="lp-eyebrow">Modelo de evaluación</p>
        <h2 className="lp-h2">Cuatro pilares definen la nota final</h2>
        <div className="lp-bar" role="img" aria-label="Ponderación: 31% flota y materias primas, 49% calidad de servicio, 10% seguridad, 10% dotación">
          {pillars.map((p) => (
            <div key={p.label} className={`lp-bar-seg ${p.tone}`} style={{ flexGrow: p.value }} />
          ))}
        </div>
        <div className="lp-pillar-grid">
          {pillars.map((p) => (
            <div className="lp-pillar" key={p.label}>
              <span className={`lp-dot ${p.tone}`} />
              <span className="lp-count" data-value={p.value}>{p.value}%</span>
              <span className="lp-pillar-label">{p.label}</span>
            </div>
          ))}
        </div>
        <p className="lp-note">
          La nota define el multiplicador MDC del Estado de Pago: 100%, 98%, 96% o 94% según el tramo.
        </p>
      </section>

      {/* Capacidades */}
      <section className="lp-caps-wrap">
        <p className="lp-eyebrow">Características</p>
        <h2 className="lp-h2">Pensada para la operación en faena</h2>
        <div className="lp-caps">
          {capabilities.map(({ icon: Icon, title, text }) => (
            <div className="lp-cap" key={title}>
              <span className="lp-cap-icon"><Icon size={20} /></span>
              <h4>{title}</h4>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Beneficios */}
      <section className="lp-benefits">
        <p className="lp-eyebrow">Beneficios</p>
        <h2 className="lp-h2">De planillas dispersas a decisiones a tiempo</h2>
        <div className="lp-compare">
          <div className="lp-col before">
            <h4>Antes</h4>
            {benefits.map(([b]) => (
              <p key={b}><CircleX size={18} /> {b}</p>
            ))}
          </div>
          <div className="lp-col after">
            <h4>Con el Dashboard KPI</h4>
            {benefits.map(([, a]) => (
              <p key={a}><CircleCheck size={18} /> {a}</p>
            ))}
          </div>
        </div>
      </section>

      {/* Cierre */}
      <section className="lp-cta">
        <h2 className="lp-cta-title">Datos al día,<br />decisiones a tiempo.</h2>
        <img
          className="lp-cta-logo"
          src={theme === 'dark' ? logoBlanca : logoGris}
          alt="Enaex"
        />
        <button className="btn btn-primary lp-cta-btn" onClick={scrollToLogin}>
          <ArrowUp size={18} />
          <span>Ir al inicio de sesión</span>
        </button>
        <p className="lp-foot">Enaex · Planta Sierra Gorda · Desarrollo interno de Administración de Contrato</p>
      </section>

      {/* Visor de imágenes ampliadas */}
      {zoom && (
        <div className="lp-zoom" role="dialog" aria-modal="true" aria-label={zoom.alt}>
          <div className="lp-zoom-backdrop" ref={backdropRef} onClick={closeZoom} />
          <div className="lp-zoom-box" ref={boxRef} onClick={closeZoom}>
            <img src={zoom.src} alt={zoom.alt} />
          </div>
          <button className="lp-zoom-close" onClick={closeZoom} aria-label="Cerrar imagen" autoFocus>
            <X size={22} />
          </button>
        </div>
      )}
    </div>
  );
};
