import React, { Suspense, useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, PerspectiveCamera, useGLTF } from '@react-three/drei'
import { EffectComposer, Bloom, Noise, Vignette, BrightnessContrast, ChromaticAberration } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import * as THREE from 'three'
import { Vector2 } from 'three'
import Scene from './Scene'

const N = '#39ff14'
const V = '#9d00ff'
const W = 'rgba(235,242,235,0.92)'

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Barlow+Condensed:ital,wght@0,200;0,300;0,400;0,600;0,700;1,300&display=swap');
  :root { --n:${N};--v:${V};--w:${W};--bg:#010202; }
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  html,body{width:100%;height:100%;overflow:hidden;background:#010202;}
  @keyframes char-in    {from{transform:translateY(108%) skewX(-6deg);opacity:0}to{transform:translateY(0) skewX(0);opacity:1}}
  @keyframes fade-up    {from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fade-in    {from{opacity:0}to{opacity:1}}
  @keyframes slide-l    {from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:translateX(0)}}
  @keyframes blink      {0%,49%{opacity:1}50%,100%{opacity:0}}
  @keyframes scroll-d   {0%{top:-5px;opacity:0}20%{opacity:1}100%{top:42px;opacity:0}}
  @keyframes scan       {from{background-position:0 0}to{background-position:0 4px}}
  @keyframes pulse-dot  {0%,100%{transform:scale(1);opacity:1}50%{transform:scale(0.4);opacity:0.15}}
  @keyframes mq         {from{transform:translateX(0)}to{transform:translateX(-50%)}}
  @keyframes sweep-up   {from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}
  @keyframes counter-in {from{transform:translateY(40px) skewY(3deg);opacity:0}to{transform:translateY(0) skewY(0);opacity:1}}
  @keyframes blink-g    {0%,49%{opacity:1}50%,100%{opacity:0}}
  @keyframes pulse-ring {0%{transform:scale(0.1);opacity:0.7}100%{transform:scale(4.5);opacity:0}}
  @keyframes gallery-in {from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
  @keyframes acquire-pulse {0%,100%{box-shadow:0 0 16px rgba(57,255,20,0.06),inset 0 0 0px rgba(57,255,20,0)}50%{box-shadow:0 0 28px rgba(57,255,20,0.18),inset 0 0 12px rgba(57,255,20,0.04)}}
  .mag{position:relative;cursor:none;transition:color .25s,opacity .25s;}
  .mag::after{content:'';position:absolute;bottom:-3px;left:0;right:0;height:1px;background:${N};box-shadow:0 0 8px ${N};transform:scaleX(0);transform-origin:right;transition:transform .36s cubic-bezier(.16,1,.3,1);}
  .mag:hover{color:${N}!important;opacity:1!important;}
  .mag:hover::after{transform:scaleX(1);transform-origin:left;}
`

// ── MOBILE DETECT ─────────────────────────────────────────────
function useIsMobile() {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' &&
    (window.innerWidth < 768 || /Android|iPhone|iPad|iPod|IEMobile/i.test(navigator.userAgent))
  )
  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 768)
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return mobile
}

// ── PROCEDURAL AUDIO ──────────────────────────────────────────
function useAudio() {
  const ctx = useRef(null)
  const get = () => {
    if (!ctx.current) ctx.current = new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.current.state === 'suspended') ctx.current.resume()
    return ctx.current
  }
  const playTick = useCallback(() => {
    try {
      const ac = get(), now = ac.currentTime
      const o = ac.createOscillator(), g = ac.createGain()
      o.connect(g); g.connect(ac.destination)
      o.frequency.setValueAtTime(1200 + Math.random() * 400, now)
      o.frequency.exponentialRampToValueAtTime(800, now + 0.04)
      g.gain.setValueAtTime(0.04, now)
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.05)
      o.start(now); o.stop(now + 0.05)
    } catch(e) {}
  }, [])
  const playExplode = useCallback(() => {
    try {
      const ac = get(), now = ac.currentTime
      const o1 = ac.createOscillator(), g1 = ac.createGain()
      o1.connect(g1); g1.connect(ac.destination)
      o1.frequency.setValueAtTime(80, now)
      o1.frequency.exponentialRampToValueAtTime(20, now + 0.3)
      g1.gain.setValueAtTime(0.5, now)
      g1.gain.exponentialRampToValueAtTime(0.001, now + 0.35)
      o1.start(now); o1.stop(now + 0.35)
      const buf = ac.createBuffer(1, ac.sampleRate * 0.18, ac.sampleRate)
      const d = buf.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = (Math.random()*2-1) * Math.pow(1 - i/d.length, 2.5)
      const ns = ac.createBufferSource(), ng = ac.createGain(), hp = ac.createBiquadFilter()
      hp.type = 'highpass'; hp.frequency.value = 2400
      ns.buffer = buf; ns.connect(hp); hp.connect(ng); ng.connect(ac.destination)
      ng.gain.setValueAtTime(0.32, now); ng.gain.exponentialRampToValueAtTime(0.001, now + 0.18)
      ns.start(now)
    } catch(e) {}
  }, [])
  const playReassemble = useCallback(() => {
    try {
      const ac = get(), now = ac.currentTime, dur = 2.4
      const o = ac.createOscillator(), g = ac.createGain()
      o.connect(g); g.connect(ac.destination)
      o.frequency.setValueAtTime(180, now)
      o.frequency.exponentialRampToValueAtTime(520, now + dur * 0.7)
      o.frequency.exponentialRampToValueAtTime(440, now + dur)
      g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.1, now + dur * 0.3)
      g.gain.exponentialRampToValueAtTime(0.001, now + dur)
      o.start(now); o.stop(now + dur)
      const o2 = ac.createOscillator(), g2 = ac.createGain()
      o2.connect(g2); g2.connect(ac.destination)
      o2.frequency.setValueAtTime(880, now + 0.3)
      o2.frequency.exponentialRampToValueAtTime(1320, now + dur * 0.8)
      g2.gain.setValueAtTime(0, now); g2.gain.linearRampToValueAtTime(0.05, now + 0.5)
      g2.gain.exponentialRampToValueAtTime(0.001, now + dur)
      o2.start(now + 0.3); o2.stop(now + dur)
    } catch(e) {}
  }, [])
  return { playExplode, playReassemble, playTick }
}

// ── NEON FLICKER ──────────────────────────────────────────────
function useFlicker() {
  const [v, setV] = useState(1)
  useEffect(() => {
    let tid
    const loop = () => {
      tid = setTimeout(() => {
        setV(0.12)
        setTimeout(() => { setV(1); setTimeout(() => { setV(0.4); setTimeout(() => { setV(1); loop() }, 55) }, 50) }, 45)
      }, 4000 + Math.random() * 9000)
    }
    loop()
    return () => clearTimeout(tid)
  }, [])
  return v
}

// ── MAGNETIC BUTTON ───────────────────────────────────────────
function MagneticButton({ children, style = {}, strength = 0.38, onClick, className, onHoverSound }) {
  const ref  = useRef()
  const pos  = useRef({ x: 0, y: 0 })
  const cur  = useRef({ x: 0, y: 0 })
  const rafR = useRef()

  const onMove = useCallback((e) => {
    const rect = ref.current.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    pos.current = { x: (e.clientX - cx) * strength, y: (e.clientY - cy) * strength }
  }, [strength])

  const onLeave = useCallback(() => { pos.current = { x: 0, y: 0 } }, [])
  const onEnter = useCallback(() => { if (onHoverSound) onHoverSound() }, [onHoverSound])

  useEffect(() => {
    const tick = () => {
      cur.current.x += (pos.current.x - cur.current.x) * 0.12
      cur.current.y += (pos.current.y - cur.current.y) * 0.12
      if (ref.current) ref.current.style.transform = `translate(${cur.current.x}px,${cur.current.y}px)`
      rafR.current = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(rafR.current)
  }, [])

  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave} onMouseEnter={onEnter} onClick={onClick}
      className={className}
      style={{ display: 'inline-block', cursor: 'none', ...style }}>
      {children}
    </div>
  )
}

// ── PULSE RINGS ───────────────────────────────────────────────
function PulseRings({ stage }) {
  const [rings, setRings] = useState([])
  useEffect(() => {
    if (stage !== 'explode' && stage !== 'reassemble') return
    const color = stage === 'explode' ? '57,255,20' : '157,0,255'
    const count = stage === 'explode' ? 4 : 3
    const newRings = Array.from({ length: count }, (_, i) => ({
      id: Math.random(),
      delay: i * 0.14,
      color,
    }))
    setRings(r => [...r, ...newRings])
    const tid = setTimeout(() => setRings([]), 2400)
    return () => clearTimeout(tid)
  }, [stage])

  return (
    <div style={{ position:'fixed',inset:0,zIndex:15,pointerEvents:'none',display:'flex',alignItems:'center',justifyContent:'center' }}>
      {rings.map(r => (
        <div key={r.id} style={{
          position:'absolute', width:200, height:200, borderRadius:'50%',
          border:`1px solid rgba(${r.color},0.6)`,
          boxShadow:`0 0 24px rgba(${r.color},0.2),inset 0 0 24px rgba(${r.color},0.05)`,
          animation:`pulse-ring 1.9s cubic-bezier(0,.5,.5,1) ${r.delay}s forwards`,
        }} />
      ))}
    </div>
  )
}


// ── HORIZONTAL GALLERY ────────────────────────────────────────
const DROPS = [
  { num: '001', name: 'Void Chrome',  status: 'SOLD',     price: '—',   col: N },
  { num: '002', name: 'Bone White',   status: 'UPCOMING', price: 'TBA', col: W },
  { num: '003', name: 'Abyss Black',  status: 'UPCOMING', price: 'TBA', col: W },
  { num: '004', name: 'Lunar Haze',   status: 'UPCOMING', price: 'TBA', col: W },
]

function HorizontalGallery({ visible, onClose, playTick }) {
  const trackRef  = useRef()
  const targetX   = useRef(0)
  const currentX  = useRef(0)
  const rafRef    = useRef()
  const [progress, setProgress] = useState(0)
  const [activeIdx, setActiveIdx] = useState(0)
  const maxScroll = (DROPS.length - 1) * (typeof window !== 'undefined' ? window.innerWidth * 0.65 : 800)

  useEffect(() => {
    if (!visible) { targetX.current = 0; currentX.current = 0; setActiveIdx(0) }
  }, [visible])

  useEffect(() => {
    if (!visible) return
    const onWheel = (e) => {
      e.preventDefault()
      targetX.current = Math.max(0, Math.min(targetX.current + e.deltaY * 1.4, maxScroll))
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => window.removeEventListener('wheel', onWheel)
  }, [visible, maxScroll])

  useEffect(() => {
    const tick = () => {
      currentX.current += (targetX.current - currentX.current) * 0.075
      if (trackRef.current) trackRef.current.style.transform = `translateX(${-currentX.current}px)`
      const p = maxScroll > 0 ? currentX.current / maxScroll : 0
      setProgress(p)
      setActiveIdx(Math.round(p * (DROPS.length - 1)))
      rafRef.current = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(rafRef.current)
  }, [maxScroll])

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:60,
      opacity:visible?1:0, pointerEvents:visible?'all':'none',
      transition:'opacity 0.7s cubic-bezier(.16,1,.3,1)',
      background:'#010202', overflow:'hidden',
    }}>
      {/* Scanlines */}
      <div style={{ position:'fixed',inset:0,pointerEvents:'none',backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.06) 2px,rgba(0,0,0,0.06) 4px)',animation:'scan 0.08s linear infinite',opacity:0.65,zIndex:1 }} />

      {/* Top bar */}
      <div style={{ position:'absolute',top:0,left:0,right:0,padding:'22px 42px',display:'flex',justifyContent:'space-between',alignItems:'center',zIndex:5 }}>
        <MagneticButton onClick={onClose} className="mag" style={{ pointerEvents:'all' }}>
          <div style={{ display:'flex',alignItems:'center',gap:10 }}>
            <div style={{ width:18,height:1,background:N,boxShadow:`0 0 6px ${N}` }} />
            <span style={{ fontFamily:'"Space Mono",monospace',fontSize:7,letterSpacing:'0.44em',color:'rgba(57,255,20,0.45)',textTransform:'uppercase' }}>Back</span>
          </div>
        </MagneticButton>
        <div style={{ fontFamily:'"Space Mono",monospace',fontSize:7,letterSpacing:'0.5em',color:'rgba(57,255,20,0.18)',textTransform:'uppercase' }}>
          Drop Archive — {String(activeIdx + 1).padStart(2,'0')} / {String(DROPS.length).padStart(2,'0')}
        </div>
        <div style={{ fontFamily:'"Space Mono",monospace',fontSize:7,letterSpacing:'0.4em',color:'rgba(57,255,20,0.18)',textTransform:'uppercase' }}>
          Scroll →
        </div>
      </div>

      {/* Horizontal line */}
      <div style={{ position:'absolute',top:62,left:0,right:0,height:1,background:`linear-gradient(to right,transparent,rgba(57,255,20,0.08) 20%,rgba(57,255,20,0.08) 80%,transparent)`,zIndex:5 }} />

      {/* Cards track */}
      <div ref={trackRef} style={{ display:'flex',alignItems:'stretch',height:'100%',willChange:'transform' }}>
        {DROPS.map((drop, i) => (
          <div key={i} style={{
            minWidth:'65vw', height:'100%',
            display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
            borderRight:'1px solid rgba(57,255,20,0.05)',
            padding:'0 80px', position:'relative', overflow:'hidden',
          }}>
            {/* Watermark number */}
            <div style={{ position:'absolute',fontSize:'55vw',fontFamily:'"Bebas Neue",sans-serif',color:'rgba(57,255,20,0.016)',lineHeight:1,userSelect:'none',pointerEvents:'none',right:'-10%',bottom:'-5%' }}>
              {drop.num}
            </div>

            {/* Vertical rule */}
            <div style={{ position:'absolute',left:0,top:'15%',bottom:'15%',width:1,background:'linear-gradient(to bottom,transparent,rgba(57,255,20,0.08) 30%,rgba(57,255,20,0.08) 70%,transparent)' }} />

            <div style={{ animation:visible?`gallery-in 0.8s cubic-bezier(.16,1,.3,1) ${i*0.08}s both`:'none', textAlign:'center' }}>
              <div style={{ fontFamily:'"Space Mono",monospace',fontSize:7,letterSpacing:'0.55em',color:'rgba(57,255,20,0.22)',marginBottom:18,textTransform:'uppercase' }}>
                — Drop {drop.num} —
              </div>
              <div style={{ fontFamily:'"Bebas Neue",sans-serif',fontSize:'clamp(64px,9vw,130px)',letterSpacing:'0.06em',color:drop.status==='SOLD'?W:'rgba(160,200,155,0.28)',lineHeight:1 }}>
                {drop.name}
              </div>
              <div style={{ marginTop:28,display:'flex',alignItems:'center',justifyContent:'center',gap:16 }}>
                <div style={{
                  padding:'5px 18px',
                  border:`1px solid ${drop.status==='SOLD'?'rgba(255,30,60,0.3)':'rgba(57,255,20,0.14)'}`,
                  fontFamily:'"Space Mono",monospace',fontSize:7,letterSpacing:'0.42em',
                  color:drop.status==='SOLD'?'rgba(255,30,60,0.7)':'rgba(57,255,20,0.35)',
                  textTransform:'uppercase',
                }}>
                  {drop.status}
                </div>
                <div style={{ fontFamily:'"Bebas Neue",sans-serif',fontSize:32,color:'rgba(57,255,20,0.25)',letterSpacing:'0.1em' }}>
                  {drop.price}
                </div>
              </div>
              {drop.status === 'SOLD' && (
                <div style={{ marginTop:20,fontFamily:'"Barlow Condensed",sans-serif',fontWeight:200,fontSize:13,letterSpacing:'0.22em',color:'rgba(160,200,155,0.22)',textTransform:'uppercase' }}>
                  This piece found its home.
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div style={{ position:'absolute',bottom:0,left:0,right:0,height:1,background:'rgba(57,255,20,0.05)',zIndex:5 }}>
        <div style={{ height:'100%',background:N,boxShadow:`0 0 8px ${N}`,width:`${progress*100}%`,transition:'none' }} />
      </div>

      {/* Dot indicators */}
      <div style={{ position:'absolute',bottom:28,left:'50%',transform:'translateX(-50%)',display:'flex',gap:10,zIndex:5 }}>
        {DROPS.map((_,i) => (
          <div key={i} style={{
            width:i===activeIdx?20:5, height:1,
            background:i===activeIdx?N:'rgba(57,255,20,0.2)',
            boxShadow:i===activeIdx?`0 0 6px ${N}`:'none',
            transition:'width 0.4s cubic-bezier(.16,1,.3,1)',
          }} />
        ))}
      </div>
    </div>
  )
}

// ── PARALLAX TITLE ────────────────────────────────────────────
function ParallaxTitle({ visible, mouseX, mouseY, delay = 0.05 }) {
  const line1Ref = useRef()
  const line2Ref = useRef()

  useEffect(() => {
    let raf
    const tick = () => {
      const mx = mouseX?.current ?? 0
      const my = mouseY?.current ?? 0
      if (line1Ref.current) line1Ref.current.style.transform = `translateX(${mx * 9}px) translateY(${my * 4}px)`
      if (line2Ref.current) line2Ref.current.style.transform = `translateX(${mx * -15}px) translateY(${my * -7}px)`
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [mouseX, mouseY])

  return (
    <div style={{ fontFamily:'"Bebas Neue",sans-serif',fontSize:'clamp(92px,15vw,198px)',fontWeight:400,letterSpacing:'0.08em',color:W,textTransform:'uppercase',lineHeight:0.87 }}>
      <div ref={line1Ref} style={{ display:'block',overflow:'hidden',willChange:'transform' }}>
        {'MOON'.split('').map((ch,ci) => (
          <span key={ci} style={{ display:'inline-block',animation:visible?`char-in 0.9s cubic-bezier(.16,1,.3,1) ${delay+ci*0.015}s forwards`:'none',opacity:visible?undefined:0 }}>{ch}</span>
        ))}
      </div>
      <div ref={line2Ref} style={{ display:'block',overflow:'hidden',willChange:'transform' }}>
        {'VIILLAIN'.split('').map((ch,ci) => (
          <span key={ci} style={{ display:'inline-block',animation:visible?`char-in 0.9s cubic-bezier(.16,1,.3,1) ${delay+0.08+ci*0.015}s forwards`:'none',opacity:visible?undefined:0 }}>{ch}</span>
        ))}
      </div>
    </div>
  )
}

// ── CURSOR TRAIL ──────────────────────────────────────────────
function CursorTrail({ loaded }) {
  const canvasRef = useRef()
  const mouseRef  = useRef({ x: -200, y: -200 })
  const pointsRef = useRef([])

  useEffect(() => {
    const onMove = e => { mouseRef.current = { x: e.clientX, y: e.clientY } }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  useEffect(() => {
    if (!loaded) return
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width  = window.innerWidth
    canvas.height = window.innerHeight
    const ctx = canvas.getContext('2d')
    let raf

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      pointsRef.current.push({ ...mouseRef.current, age: 0 })
      if (pointsRef.current.length > 28) pointsRef.current.shift()
      pointsRef.current.forEach((p) => {
        p.age++
        const life = 1 - p.age / 28
        if (life <= 0) return
        const size = life * 2.2
        const alpha = life * 0.22
        ctx.beginPath()
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(57,255,20,${alpha})`
        ctx.fill()
      })
      pointsRef.current = pointsRef.current.filter(p => (1 - p.age / 28) > 0)
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [loaded])

  return (
    <canvas ref={canvasRef} style={{
      position: 'fixed', inset: 0, zIndex: 9997, pointerEvents: 'none',
      opacity: loaded ? 1 : 0, transition: 'opacity 1s ease',
      mixBlendMode: 'screen',
    }} />
  )
}

// ── LIVE CLOCK ────────────────────────────────────────────────
function LiveClock({ visible }) {
  const [time, setTime] = useState('')
  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const h = String(now.getHours()).padStart(2,'0')
      const m = String(now.getMinutes()).padStart(2,'0')
      const s = String(now.getSeconds()).padStart(2,'0')
      setTime(`${h}:${m}:${s}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <div style={{
      fontFamily: '"Space Mono",monospace',
      fontSize: 7,
      letterSpacing: '0.36em',
      color: 'rgba(57,255,20,0.22)',
      textTransform: 'uppercase',
      opacity: visible ? 1 : 0,
      transition: 'opacity 2s ease 1.4s',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    }}>
      <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#39ff14', boxShadow: '0 0 6px #39ff14', animation: 'blink-g 1s step-end infinite' }} />
      {time} UTC
    </div>
  )
}

// ── BURST FLASH ───────────────────────────────────────────────
function BurstFlash({ stage }) {
  const ref = useRef()
  const op  = useRef(0)
  useEffect(() => { if (stage === 'explode') op.current = 1 }, [stage])
  useEffect(() => {
    let raf
    const tick = () => {
      op.current = Math.max(0, op.current - 0.055)
      if (ref.current) ref.current.style.opacity = op.current
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <div ref={ref} style={{
      position:'fixed',inset:0,zIndex:50,pointerEvents:'none',opacity:0,
      background:'radial-gradient(ellipse 70% 70% at 50% 50%,rgba(255,255,255,0.18) 0%,rgba(57,255,20,0.08) 50%,transparent 100%)',
    }} />
  )
}

// ── GLITCH LINES ──────────────────────────────────────────────
function GlitchLines({ stage }) {
  const [lines, setLines] = useState([])
  useEffect(() => {
    if (stage !== 'explode') return
    const count = 6 + Math.floor(Math.random() * 5)
    setLines(Array.from({ length: count }, () => ({
      id: Math.random(),
      top: Math.random() * 100,
      height: 1 + Math.random() * 3,
      width: 20 + Math.random() * 60,
      left: Math.random() * 40,
      opacity: 0.4 + Math.random() * 0.5,
      green: Math.random() > 0.3,
    })))
    const tid = setTimeout(() => setLines([]), 320)
    return () => clearTimeout(tid)
  }, [stage])
  return (
    <div style={{ position:'fixed',inset:0,zIndex:45,pointerEvents:'none' }}>
      {lines.map(l => (
        <div key={l.id} style={{
          position:'absolute',top:`${l.top}%`,left:`${l.left}%`,
          width:`${l.width}%`,height:l.height,mixBlendMode:'screen',
          background:l.green?`rgba(57,255,20,${l.opacity})`:`rgba(255,255,255,${l.opacity})`,
        }} />
      ))}
    </div>
  )
}

// ── MOBILE SCENE — lightweight, touch-responsive ─────────────
function MobileScene() {
  const { scene }  = useGLTF('/Untitled-v1.glb')
  const groupRef   = useRef()
  const centered   = useRef(false)
  const meshes     = useRef([])
  const rot        = useRef({ x: 0, y: 0 })
  const targetRot  = useRef({ x: 0, y: 0 })
  const touchRef   = useRef(null)
  const introP     = useRef(0)

  // Shared uniforms — simplified subset (no burst, no glitch)
  const uniforms = useRef({
    uTime:         { value: 0 },
    uBreath:       { value: 0 },
    uGlitchTime:   { value: 0 },
    uGlitchAmount: { value: 0 },
    uFragmentBurst:{ value: 0 },
    uReassemble:   { value: 0 },
    uSeed:         { value: Math.random() * 100 },
  })

  useLayoutEffect(() => {
    meshes.current = []
    const u = uniforms.current
    scene.traverse(obj => {
      if (!obj.isMesh) return
      obj.material.color                     = new THREE.Color('#978585')
      obj.material.metalness                 = 0.45
      obj.material.roughness                 = 0.28
      obj.material.iridescence               = 1.0
      obj.material.iridescenceIOR            = 3.2
      obj.material.iridescenceThicknessRange = [120, 900]
      obj.material.clearcoat                 = 1.0
      obj.material.clearcoatRoughness        = 0.04
      obj.material.envMapIntensity           = 2.8
      obj.material.transparent               = true
      obj.material.opacity                   = 0
      obj.material.needsUpdate               = true

      obj.material.onBeforeCompile = shader => {
        shader.uniforms.uTime          = u.uTime
        shader.uniforms.uBreath        = u.uBreath
        shader.uniforms.uGlitchTime    = u.uGlitchTime
        shader.uniforms.uGlitchAmount  = u.uGlitchAmount
        shader.uniforms.uFragmentBurst = u.uFragmentBurst
        shader.uniforms.uReassemble    = u.uReassemble
        shader.uniforms.uSeed          = u.uSeed

        shader.vertexShader = shader.vertexShader.replace('#include <common>',
          `#include <common>
          uniform float uTime; uniform float uBreath; uniform float uGlitchTime;
          uniform float uGlitchAmount; uniform float uFragmentBurst; uniform float uReassemble; uniform float uSeed;
          float hash(float n){ return fract(sin(n)*43758.5453123); }
          vec3 hash3(float n){ return vec3(hash(n),hash(n+1.0),hash(n+2.0))*2.0-1.0; }
          float noise(vec3 p){ vec3 i=floor(p);vec3 f=fract(p);f=f*f*(3.0-2.0*f);
            return mix(mix(mix(hash(dot(i,vec3(1,57,113))),hash(dot(i+vec3(1,0,0),vec3(1,57,113))),f.x),
              mix(hash(dot(i+vec3(0,1,0),vec3(1,57,113))),hash(dot(i+vec3(1,1,0),vec3(1,57,113))),f.x),f.y),
              mix(mix(hash(dot(i+vec3(0,0,1),vec3(1,57,113))),hash(dot(i+vec3(1,0,1),vec3(1,57,113))),f.x),
              mix(hash(dot(i+vec3(0,1,1),vec3(1,57,113))),hash(dot(i+vec3(1,1,1),vec3(1,57,113))),f.x),f.y),f.z); }`
        )
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
          `#include <begin_vertex>
          float breathNoise = noise(position*1.8+uTime*0.14);
          float microPulse = sin(uTime*1.6+position.y*12.0+breathNoise*4.0)*0.006*uBreath;
          transformed += normal*microPulse;`
        )
      }
      obj.material.needsUpdate = true
      meshes.current.push(obj)
    })
  }, [scene])

  // Touch drag
  useEffect(() => {
    const onStart = e => { touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, rx: targetRot.current.x, ry: targetRot.current.y } }
    const onMove  = e => {
      if (!touchRef.current) return
      const dx = e.touches[0].clientX - touchRef.current.x
      const dy = e.touches[0].clientY - touchRef.current.y
      targetRot.current.y = touchRef.current.ry + dx * 0.012
      targetRot.current.x = Math.max(-0.5, Math.min(0.5, touchRef.current.rx + dy * 0.008))
    }
    const onEnd = () => { touchRef.current = null }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove',  onMove,  { passive: true })
    window.addEventListener('touchend',   onEnd)
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove',  onMove)
      window.removeEventListener('touchend',   onEnd)
    }
  }, [])

  const { camera } = useThree()

  useFrame((state, delta) => {
    const t  = state.clock.getElapsedTime()
    const u  = uniforms.current

    // Intro camera pull-in
    introP.current = Math.min(introP.current + delta * 0.28, 1)
    const eased = 1 - Math.pow(1 - introP.current, 4)
    camera.position.z = THREE.MathUtils.lerp(38, 11, eased)
    camera.lookAt(0, 0, 0)

    // Center once
    if (!centered.current) {
      const box = new THREE.Box3().setFromObject(scene)
      if (box.min.x !== Infinity) {
        const c = new THREE.Vector3(); box.getCenter(c); scene.position.sub(c)
        centered.current = true
      }
    }

    u.uTime.value   = t
    u.uBreath.value = THREE.MathUtils.clamp((introP.current - 0.75) / 0.25, 0, 1)

    // Smooth rotation toward target (touch) + idle drift
    rot.current.y += (targetRot.current.y - rot.current.y) * 0.06
    rot.current.x += (targetRot.current.x - rot.current.x) * 0.06
    if (!touchRef.current) targetRot.current.y += delta * 0.18 // auto-rotate when idle

    if (groupRef.current) {
      groupRef.current.rotation.y = rot.current.y
      groupRef.current.rotation.x = rot.current.x + Math.sin(t * 0.4) * 0.04
      groupRef.current.position.y = Math.sin(t * 0.44) * 0.04
    }

    // Opacity fade-in
    const op = THREE.MathUtils.clamp((introP.current - 0.3) / 0.5, 0, 1)
    meshes.current.forEach(obj => { obj.material.opacity = op })
  })

  return (
    <>
      {/* Neon key light follows slow orbit */}
      <pointLight position={[4, 3, 6]}  intensity={6}   distance={18} decay={2} color="#39ff14" />
      <pointLight position={[-5, -2, 4]} intensity={4}   distance={16} decay={2} color="#00ffaa" />
      <pointLight position={[0, 6, -8]}  intensity={5}   distance={20} decay={2} color="#7700ff" />
      <pointLight position={[0, -4, 0]}  intensity={2}   distance={12} decay={2} color="#00ff44" />
      <ambientLight intensity={0.012} color="#001200" />
      <group ref={groupRef}>
        <primitive object={scene} scale={1.22} />
      </group>
    </>
  )
}

// ── MOBILE GATE ───────────────────────────────────────────────
function MobileGate() {
  const [vis, setVis] = useState(false)
  const [tin, setTin] = useState(false)
  const flicker = useFlicker()
  useEffect(() => {
    setTimeout(() => setVis(true), 100)
    setTimeout(() => setTin(true), 800)
  }, [])

  return (
    <div style={{ width:'100vw', height:'100vh', overflow:'hidden', background:'#010202', position:'relative', opacity:vis?1:0, transition:'opacity 1s ease' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400&family=Barlow+Condensed:wght@200;300&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        html,body{width:100%;height:100%;overflow:hidden;background:#010202;}
        @keyframes blink-g{0%,49%{opacity:1}50%,100%{opacity:0}}
        @keyframes scan-m{from{background-position:0 0}to{background-position:0 4px}}
        @keyframes mob-sweep{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* ── 3D canvas — full bleed behind everything ── */}
      <div style={{ position:'absolute', inset:0, zIndex:0 }}>
        <Canvas
          dpr={[1, 1.5]}
          gl={{ antialias:true, toneMapping:4, toneMappingExposure:0.72, alpha:true, powerPreference:'low-power' }}
          style={{ background:'transparent' }}
        >
          <PerspectiveCamera makeDefault position={[0, 0, 38]} fov={24} />
          <Suspense fallback={null}>
            <Environment preset="night" environmentIntensity={0.25} rotation={[0, Math.PI * 0.85, 0]} />
            <MobileScene />
          </Suspense>
        </Canvas>
      </div>

      {/* ── Gradient overlay — heavy vignette so text reads cleanly ── */}
      <div style={{
        position:'absolute', inset:0, zIndex:1, pointerEvents:'none',
        background:`
          radial-gradient(ellipse 85% 85% at 50% 50%, transparent 15%, rgba(1,2,2,0.55) 65%, rgba(1,2,2,0.96) 100%),
          linear-gradient(to bottom, rgba(1,2,2,0.7) 0%, rgba(1,2,2,0.1) 28%, rgba(1,2,2,0.1) 62%, rgba(1,2,2,0.85) 100%)
        `,
      }} />

      {/* ── Scanlines ── */}
      <div style={{ position:'absolute',inset:0,zIndex:2,pointerEvents:'none',backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.055) 2px,rgba(0,0,0,0.055) 4px)',animation:'scan-m 0.08s linear infinite',opacity:0.7 }} />

      {/* ── Corner brackets ── */}
      {[
        {top:16,left:16,  borderTop:`1px solid rgba(57,255,20,0.16)`,borderLeft:`1px solid rgba(57,255,20,0.16)`},
        {top:16,right:16, borderTop:`1px solid rgba(57,255,20,0.16)`,borderRight:`1px solid rgba(57,255,20,0.16)`},
        {bottom:16,left:16, borderBottom:`1px solid rgba(57,255,20,0.16)`,borderLeft:`1px solid rgba(57,255,20,0.16)`},
        {bottom:16,right:16,borderBottom:`1px solid rgba(57,255,20,0.16)`,borderRight:`1px solid rgba(57,255,20,0.16)`},
      ].map((s,i) => <div key={i} style={{ position:'absolute',width:20,height:20,zIndex:3,opacity:tin?1:0,transition:`opacity 1s ease ${0.1+i*0.1}s`,...s }} />)}

      {/* ── Top brand bar ── */}
      <div style={{ position:'absolute',top:0,left:0,right:0,padding:'20px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',zIndex:3,opacity:tin?1:0,transition:'opacity 1s ease 0.2s' }}>
        <div style={{ display:'flex',alignItems:'center',gap:8 }}>
          <div style={{ width:5,height:5,background:N,boxShadow:`0 0 10px ${N}`,opacity:flicker,transition:'opacity 0.04s' }} />
          <span style={{ fontFamily:'"Bebas Neue",sans-serif',fontSize:16,letterSpacing:'0.22em',color:W }}>MOONVIILLAIN</span>
        </div>
        <div style={{ fontFamily:'"Space Mono",monospace',fontSize:6.5,letterSpacing:'0.38em',color:'rgba(57,255,20,0.3)',textTransform:'uppercase' }}>SS25</div>
      </div>

      {/* ── Top rule ── */}
      <div style={{ position:'absolute',top:56,left:0,right:0,height:1,background:`linear-gradient(to right,transparent,rgba(57,255,20,0.07) 20%,rgba(57,255,20,0.07) 80%,transparent)`,zIndex:3,opacity:tin?1:0,transition:'opacity 1.5s ease 0.4s' }} />

      {/* ── Main message — lower third so model breathes above ── */}
      <div style={{
        position:'absolute', bottom:0, left:0, right:0,
        padding:'0 28px 52px',
        zIndex:3,
        display:'flex', flexDirection:'column', alignItems:'center',
      }}>
        {/* Eyebrow */}
        <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:14,opacity:tin?1:0,animation:tin?'mob-sweep 0.9s cubic-bezier(.16,1,.3,1) 0.3s both':'none' }}>
          <div style={{ width:20,height:1,background:N,boxShadow:`0 0 5px ${N}`,opacity:flicker,transition:'opacity 0.04s' }} />
          <span style={{ fontFamily:'"Space Mono",monospace',fontSize:6.5,letterSpacing:'0.44em',color:'rgba(57,255,20,0.45)',textTransform:'uppercase' }}>Sector Zero — Drop 001</span>
          <div style={{ width:20,height:1,background:N,boxShadow:`0 0 5px ${N}`,opacity:flicker,transition:'opacity 0.04s' }} />
        </div>

        {/* Headline */}
        <div style={{ fontFamily:'"Bebas Neue",sans-serif',fontSize:'clamp(52px,16vw,78px)',lineHeight:0.86,letterSpacing:'0.07em',color:W,textAlign:'center',opacity:tin?1:0,animation:tin?'mob-sweep 1s cubic-bezier(.16,1,.3,1) 0.45s both':'none' }}>
          BEST<br/>VIEWED ON<br/>DESKTOP
        </div>

        {/* Divider */}
        <div style={{ width:1,height:28,background:`linear-gradient(to bottom,rgba(57,255,20,0.3),transparent)`,margin:'16px 0',opacity:tin?1:0,transition:'opacity 1s ease 0.8s' }} />

        {/* Sub */}
        <div style={{ fontFamily:'"Barlow Condensed",sans-serif',fontWeight:200,fontSize:'clamp(12px,3.8vw,15px)',letterSpacing:'0.2em',textTransform:'uppercase',color:'rgba(160,200,155,0.36)',textAlign:'center',lineHeight:1.85,opacity:tin?1:0,animation:tin?'mob-sweep 1s cubic-bezier(.16,1,.3,1) 0.6s both':'none' }}>
          The full experience was crafted<br/>for a larger screen.<br/>Drag to preview the model.
        </div>

        {/* Badge */}
        <div style={{ marginTop:20,display:'flex',alignItems:'center',gap:8,border:`1px solid rgba(57,255,20,0.14)`,padding:'6px 16px',opacity:tin?1:0,transition:'opacity 1s ease 1s' }}>
          <div style={{ width:4,height:4,background:N,boxShadow:`0 0 8px ${N}`,animation:'blink-g 1.4s step-end infinite' }} />
          <span style={{ fontFamily:'"Space Mono",monospace',fontSize:6.5,letterSpacing:'0.38em',color:'rgba(57,255,20,0.45)',textTransform:'uppercase' }}>1 of 1</span>
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{ position:'absolute',bottom:20,left:'50%',transform:'translateX(-50%)',zIndex:3,fontFamily:'"Space Mono",monospace',fontSize:6,letterSpacing:'0.42em',color:'rgba(57,255,20,0.12)',textTransform:'uppercase',whiteSpace:'nowrap',opacity:tin?1:0,transition:'opacity 1s ease 1.1s' }}>
        © 2025 Moonviillain
      </div>
    </div>
  )
}

// ── ATMOSPHERE ────────────────────────────────────────────────
function Atmosphere({ visible }) {
  const ref = useRef()
  useEffect(() => {
    if (!ref.current) return
    let raf, t = 0
    const tick = () => {
      t += 0.00026
      if (ref.current) {
        const x1=50+Math.sin(t*.32)*20, y1=46+Math.cos(t*.24)*15
        const x2=18+Math.cos(t*.26)*14, y2=62+Math.sin(t*.20)*17
        const x3=78+Math.sin(t*.18)*10, y3=28+Math.cos(t*.14)*13
        ref.current.style.background =
          `radial-gradient(ellipse 60% 52% at ${x1}% ${y1}%,rgba(4,18,4,.98) 0%,transparent 68%),`+
          `radial-gradient(ellipse 30% 28% at ${x2}% ${y2}%,rgba(57,255,20,.03) 0%,transparent 55%),`+
          `radial-gradient(ellipse 28% 26% at ${x3}% ${y3}%,rgba(120,0,255,.025) 0%,transparent 50%),`+
          `#010202`
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [])
  return <div ref={ref} style={{ position:'fixed',inset:0,zIndex:0,opacity:visible?1:0,transition:'opacity 4s ease' }} />
}

// ── CINEMATIC PARTICLES ───────────────────────────────────────
function CinematicParticles({ visible }) {
  const canvasRef = useRef()
  const mouseRef  = useRef({ x:0.5,y:0.5 })
  useEffect(() => {
    const onMove = e => { mouseRef.current = { x:e.clientX/window.innerWidth,y:e.clientY/window.innerHeight } }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])
  useEffect(() => {
    if (!visible) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    const LAYERS = [
      { count:280,sizeRange:[0.4,0.9], speedY:[0.04,0.10],drift:0.012,alpha:[0.04,0.10],col:'57,255,20', parallax:0.008 },
      { count:160,sizeRange:[0.8,1.6], speedY:[0.08,0.18],drift:0.022,alpha:[0.08,0.20],col:'57,255,20', parallax:0.022 },
      { count:60, sizeRange:[1.4,2.8], speedY:[0.14,0.30],drift:0.038,alpha:[0.14,0.38],col:'120,255,80',parallax:0.048 },
      { count:28, sizeRange:[0.6,1.2], speedY:[0.05,0.13],drift:0.016,alpha:[0.05,0.14],col:'157,0,255', parallax:0.018 },
    ]
    const particles = []
    LAYERS.forEach(layer => {
      for (let i = 0; i < layer.count; i++) {
        particles.push({
          x:Math.random()*canvas.width,y:Math.random()*canvas.height,
          size:layer.sizeRange[0]+Math.random()*(layer.sizeRange[1]-layer.sizeRange[0]),
          vy:-(layer.speedY[0]+Math.random()*(layer.speedY[1]-layer.speedY[0])),
          vx:(Math.random()-0.5)*0.04,
          alpha:layer.alpha[0]+Math.random()*(layer.alpha[1]-layer.alpha[0]),
          col:layer.col,parallax:layer.parallax,drift:layer.drift,
          phase:Math.random()*Math.PI*2,
          twinkleSpeed:0.3+Math.random()*1.2,twinklePhase:Math.random()*Math.PI*2,
        })
      }
    })
    let raf
    const draw = () => {
      ctx.clearRect(0,0,canvas.width,canvas.height)
      const t=Date.now()*0.001,mx=mouseRef.current.x,my=mouseRef.current.y
      particles.forEach(p => {
        p.y += p.vy; p.x += p.vx + Math.sin(t*0.22+p.phase)*p.drift
        if(p.y < -8){ p.y=canvas.height+8; p.x=Math.random()*canvas.width }
        if(p.y > canvas.height+8) p.y = -8
        const offX=(mx-0.5)*canvas.width*p.parallax
        const offY=(my-0.5)*canvas.height*p.parallax*0.5
        const a=p.alpha*(0.65+Math.sin(t*p.twinkleSpeed+p.twinklePhase)*0.35)
        const px=p.x+offX,py=p.y+offY
        if(p.size > 1.8){
          const g=ctx.createRadialGradient(px,py,0,px,py,p.size*5)
          g.addColorStop(0,`rgba(${p.col},${a*0.5})`); g.addColorStop(1,`rgba(${p.col},0)`)
          ctx.beginPath();ctx.arc(px,py,p.size*5,0,Math.PI*2);ctx.fillStyle=g;ctx.fill()
        }
        ctx.beginPath();ctx.arc(px,py,p.size,0,Math.PI*2)
        ctx.fillStyle=`rgba(${p.col},${a})`;ctx.fill()
      })
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [visible])
  return <canvas ref={canvasRef} style={{ position:'fixed',inset:0,zIndex:5,pointerEvents:'none',opacity:visible?1:0,transition:'opacity 3s ease',mixBlendMode:'screen' }} />
}

// ── DEPTH FOG ─────────────────────────────────────────────────
function DepthFog({ visible }) {
  return (
    <div style={{
      position:'fixed',inset:0,zIndex:8,pointerEvents:'none',
      opacity:visible?1:0,transition:'opacity 3s ease',
      background:`radial-gradient(ellipse 55% 55% at 50% 50%,transparent 30%,rgba(1,2,2,0.55) 70%,rgba(1,2,2,0.92) 100%),linear-gradient(to bottom,rgba(1,2,2,0.45) 0%,transparent 18%,transparent 82%,rgba(1,2,2,0.55) 100%),linear-gradient(to right,rgba(1,2,2,0.38) 0%,transparent 15%,transparent 85%,rgba(1,2,2,0.38) 100%)`,
    }} />
  )
}

// ── SCAN BEAM ─────────────────────────────────────────────────
function ScanBeam({ visible }) {
  const ref = useRef()
  useEffect(() => {
    if (!visible) return
    let raf, y = -2
    const tick = () => {
      y += 0.28
      if (ref.current) {
        ref.current.style.top = `${y}px`
        ref.current.style.opacity = y > window.innerHeight ? 0 : 0.12
        if (y > window.innerHeight + 20) y = -2
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [visible])
  return (
    <div ref={ref} style={{
      position:'fixed',left:0,right:0,zIndex:38,height:1,pointerEvents:'none',top:'-2px',
      background:`linear-gradient(to right,transparent,${N} 30%,rgba(57,255,20,0.6) 50%,${N} 70%,transparent)`,
      boxShadow:`0 0 12px rgba(57,255,20,0.4),0 0 30px rgba(57,255,20,0.15)`,
    }} />
  )
}

// ── CORNER FLARES ─────────────────────────────────────────────
function CornerFlares({ visible }) {
  const corners = [
    { top:0,left:0,    background:`radial-gradient(ellipse 120px 80px at 0% 0%,rgba(57,255,20,0.07) 0%,transparent 100%)` },
    { top:0,right:0,   background:`radial-gradient(ellipse 120px 80px at 100% 0%,rgba(157,0,255,0.05) 0%,transparent 100%)` },
    { bottom:0,left:0, background:`radial-gradient(ellipse 120px 80px at 0% 100%,rgba(157,0,255,0.05) 0%,transparent 100%)` },
    { bottom:0,right:0,background:`radial-gradient(ellipse 120px 80px at 100% 100%,rgba(57,255,20,0.06) 0%,transparent 100%)` },
  ]
  return (
    <>
      {corners.map((c,i) => (
        <div key={i} style={{ position:'fixed',width:200,height:150,zIndex:4,pointerEvents:'none',...c,opacity:visible?1:0,transition:`opacity 2s ease ${i*0.2}s` }} />
      ))}
    </>
  )
}

// ── FILM GRAIN ────────────────────────────────────────────────
function FilmGrain() {
  const ref = useRef()
  useEffect(() => {
    const c=ref.current,ctx=c.getContext('2d')
    c.width=c.height=256; let raf
    const draw = () => {
      const img=ctx.createImageData(256,256)
      for(let i=0;i<img.data.length;i+=4){const v=Math.random()*18;img.data[i]=img.data[i+1]=img.data[i+2]=v;img.data[i+3]=14}
      ctx.putImageData(img,0,0);raf=requestAnimationFrame(draw)
    }
    draw();return ()=>cancelAnimationFrame(raf)
  },[])
  return <canvas ref={ref} style={{ position:'fixed',inset:0,zIndex:36,width:'100%',height:'100%',pointerEvents:'none',opacity:0.55,mixBlendMode:'overlay',imageRendering:'pixelated' }} />
}

// ── SCANLINES ─────────────────────────────────────────────────
function Scanlines() {
  return <div style={{ position:'fixed',inset:0,zIndex:37,pointerEvents:'none',backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.06) 2px,rgba(0,0,0,0.06) 4px)',animation:'scan 0.08s linear infinite',opacity:0.65 }} />
}

// ── CURSOR ────────────────────────────────────────────────────
function Cursor({ loaded }) {
  const dot=useRef(),ring=useRef()
  const pos=useRef({x:-200,y:-200}),rPos=useRef({x:-200,y:-200}),dn=useRef(false)
  useEffect(() => {
    const mv=e=>{pos.current={x:e.clientX,y:e.clientY}}
    const md=()=>{dn.current=true},mu=()=>{dn.current=false}
    window.addEventListener('mousemove',mv);window.addEventListener('mousedown',md);window.addEventListener('mouseup',mu)
    return ()=>{ window.removeEventListener('mousemove',mv);window.removeEventListener('mousedown',md);window.removeEventListener('mouseup',mu) }
  },[])
  useEffect(() => {
    let raf
    const tick = () => {
      const{x,y}=pos.current
      if(dot.current) dot.current.style.transform=`translate(${x-3}px,${y-3}px)`
      rPos.current.x+=(x-rPos.current.x)*0.085;rPos.current.y+=(y-rPos.current.y)*0.085
      if(ring.current){const s=dn.current?0.32:1;ring.current.style.transform=`translate(${rPos.current.x-23}px,${rPos.current.y-23}px) scale(${s})`}
      raf=requestAnimationFrame(tick)
    }
    tick();return ()=>cancelAnimationFrame(raf)
  },[])
  return (
    <>
      <div ref={dot} style={{ position:'fixed',top:0,left:0,zIndex:9999,pointerEvents:'none',width:6,height:6,borderRadius:'50%',background:N,boxShadow:`0 0 14px ${N},0 0 28px rgba(57,255,20,0.35)`,willChange:'transform',opacity:loaded?1:0,transition:'opacity 0.5s' }} />
      <div ref={ring} style={{ position:'fixed',top:0,left:0,zIndex:9998,pointerEvents:'none',width:46,height:46,borderRadius:'50%',border:`1px solid rgba(57,255,20,0.25)`,boxShadow:`0 0 10px rgba(57,255,20,0.1)`,willChange:'transform',transition:'transform 0.1s linear',opacity:loaded?0.9:0 }}>
        {[0,90,180,270].map(d=><div key={d} style={{ position:'absolute',width:6,height:1,background:'rgba(57,255,20,0.45)',top:'50%',left:'50%',transformOrigin:'0 0',transform:`rotate(${d}deg) translateX(21px)` }}/>)}
      </div>
    </>
  )
}

// ── LOADER ────────────────────────────────────────────────────
function Loader({ onComplete }) {
  const [phase,setPhase]=useState(0)
  const numRef=useRef(),barRef=useRef()
  useEffect(() => {
    let p=0,raf
    const spd=()=>p<60?.8:p<85?.4:p<98?.15:.8
    const tick=()=>{
      p=Math.min(p+spd(),100)
      if(numRef.current) numRef.current.textContent=String(Math.floor(p)).padStart(3,'0')
      if(barRef.current) barRef.current.style.width=`${p}%`
      if(p<100){ raf=requestAnimationFrame(tick) }
      else { setTimeout(()=>{ setPhase(1);setTimeout(()=>{ setPhase(2);onComplete() },550) },280) }
    }
    setTimeout(()=>{ raf=requestAnimationFrame(tick) },200)
    return ()=>cancelAnimationFrame(raf)
  },[]) // eslint-disable-line
  if(phase===2) return null
  const fl=phase===1
  return (
    <div style={{ position:'fixed',inset:0,zIndex:1000,background:fl?N:'#010202',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',transition:fl?'background 0.12s':'none' }}>
      <div style={{ position:'absolute',width:1,height:'30vh',background:fl?'rgba(1,2,2,0.15)':'rgba(57,255,20,0.05)',top:'50%',left:'50%',transform:'translate(-50%,-50%)' }} />
      <div style={{ position:'absolute',height:1,width:'30vw',background:fl?'rgba(1,2,2,0.15)':'rgba(57,255,20,0.05)',top:'50%',left:'50%',transform:'translate(-50%,-50%)' }} />
      <div ref={numRef} style={{ fontFamily:'"Bebas Neue",sans-serif',fontSize:'clamp(130px,25vw,340px)',fontWeight:400,lineHeight:0.82,color:fl?'#010202':N,letterSpacing:'0.04em',userSelect:'none',textShadow:fl?'none':`0 0 60px rgba(57,255,20,0.5),0 0 120px rgba(57,255,20,0.25)`,transition:'color 0.12s',animation:'counter-in 0.6s cubic-bezier(.16,1,.3,1) .3s both' }}>000</div>
      <div style={{ fontFamily:'"Space Mono",monospace',fontSize:7,letterSpacing:'0.55em',color:fl?'rgba(1,2,2,0.45)':'rgba(57,255,20,0.35)',textTransform:'uppercase',marginTop:20,marginBottom:28,transition:'color 0.12s' }}>System Boot</div>
      <div style={{ width:220,height:1,background:fl?'rgba(1,2,2,0.2)':'rgba(57,255,20,0.08)',position:'relative' }}>
        <div ref={barRef} style={{ position:'absolute',top:0,left:0,height:'100%',width:'0%',background:fl?'#010202':N,boxShadow:fl?'none':`0 0 12px ${N}` }} />
        {[25,50,75].map(p=><div key={p} style={{ position:'absolute',top:-3,left:`${p}%`,width:1,height:7,background:fl?'rgba(1,2,2,0.15)':'rgba(57,255,20,0.12)' }} />)}
      </div>
      <div style={{ position:'absolute',bottom:30,left:'50%',transform:'translateX(-50%)',fontFamily:'"Space Mono",monospace',fontSize:6.5,letterSpacing:'0.5em',color:fl?'rgba(1,2,2,0.25)':'rgba(57,255,20,0.18)',textTransform:'uppercase',whiteSpace:'nowrap' }}>MOONVIILLAIN — SS25 — DROP 001</div>
      {[{top:20,left:20,bT:1,bL:1},{top:20,right:20,bT:1,bR:1},{bottom:20,left:20,bB:1,bL:1},{bottom:20,right:20,bB:1,bR:1}].map((c,i)=>{
        const col=fl?'rgba(1,2,2,0.15)':'rgba(57,255,20,0.15)'
        return <div key={i} style={{ position:'absolute',width:20,height:20,...(c.bT?{borderTop:`1px solid ${col}`}:{}),...(c.bL?{borderLeft:`1px solid ${col}`}:{}),...(c.bR?{borderRight:`1px solid ${col}`}:{}),...(c.bB?{borderBottom:`1px solid ${col}`}:{}),top:c.top,left:c.left,right:c.right,bottom:c.bottom }} />
      })}
    </div>
  )
}

// ── TYPEWRITER ────────────────────────────────────────────────
function useTypewriter(lines, trigger, speed=18) {
  const [disp,setDisp]=useState(()=>lines.map(()=>''))
  const ref=useRef(lines)
  useEffect(() => {
    const L=ref.current;setDisp(L.map(()=>''))
    if(!trigger) return
    let li=0,ci=0
    const id=setInterval(() => {
      if(li>=L.length){clearInterval(id);return}
      const line=L[li];if(!line){clearInterval(id);return}
      setDisp(prev=>{ const n=[...prev];n[li]=line.slice(0,ci+1);return n })
      ci++;if(ci>=line.length){li++;ci=0}
    },speed)
    return ()=>clearInterval(id)
  },[trigger]) // eslint-disable-line
  return disp
}

// ── GLITCH TEXT ───────────────────────────────────────────────
function GlitchText({ text, active, style={} }) {
  const [d,setD]=useState(text)
  const C='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!#$%&@░▒▓█▄▀'
  useEffect(() => {
    if(!active){setD(text);return}
    let f=0
    const id=setInterval(() => {
      if(f>16){setD(text);clearInterval(id);return}
      setD(text.split('').map(c=>c===' '?c:Math.random()>.52?C[Math.floor(Math.random()*C.length)]:c).join(''))
      f++
    },32);return ()=>clearInterval(id)
  },[active,text])
  return <span style={style}>{d}</span>
}

// ── TICKER ────────────────────────────────────────────────────
function Ticker({ items, visible }) {
  const [idx,setIdx]=useState(0)
  useEffect(() => {
    if(!visible) return
    const id=setInterval(()=>setIdx(i=>(i+1)%items.length),2400)
    return ()=>clearInterval(id)
  },[visible,items.length])
  return (
    <div style={{ overflow:'hidden',height:13,position:'relative' }}>
      {items.map((item,i) => {
        const on=i===idx,gone=i<idx||(idx===0&&i===items.length-1)
        return <div key={i} style={{ position:'absolute',width:'100%',fontFamily:'"Space Mono",monospace',fontSize:7,letterSpacing:'0.36em',color:'rgba(57,255,20,0.45)',textTransform:'uppercase',transition:'transform .5s cubic-bezier(.76,0,.24,1),opacity .5s',transform:on?'translateY(0)':gone?'translateY(-110%)':'translateY(110%)',opacity:on?1:0 }}>{item}</div>
      })}
    </div>
  )
}

// ── MAIN APP ──────────────────────────────────────────────────
export default function App() {
  const isMobile = useIsMobile()
  if (isMobile) return <MobileGate />
  return <DesktopApp />
}

function DesktopApp() {
  const introProgress = useRef(0)
  const [loaded,setLoaded]         = useState(false)
  const [atm,setAtm]               = useState(false)
  const [titleIn,setTitleIn]       = useState(false)
  const [uiIn,setUiIn]             = useState(false)
  const [dataIn,setDataIn]         = useState(false)
  const [glitch,setGlitch]         = useState(false)
  const [fxIn,setFxIn]             = useState(false)
  const [burstStage,setBurstStage] = useState('idle')
  const [galleryOpen,setGalleryOpen] = useState(false)
  const mouseX = useRef(0)
  const mouseY = useRef(0)

  const { playExplode, playReassemble, playTick } = useAudio()
  const flicker = useFlicker()

  // Track mouse for parallax title
  useEffect(() => {
    const onMove = (e) => {
      mouseX.current = (e.clientX / window.innerWidth)  * 2 - 1
      mouseY.current = (e.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  const handleStageChange = useCallback((stage) => {
    setBurstStage(stage)
    if (stage === 'explode') playExplode()
    if (stage === 'reassemble') {
      playReassemble()
      setDataIn(false)
      setTimeout(() => setDataIn(true), 600)
    }
  }, [playExplode, playReassemble])

  const dataLines = [
    'DESIGNATION........ MK-I SKULL',
    'MATERIAL........... VOID CHROME',
    'COLLECTION......... DROP 001',
    'ORIGIN............. SECTOR ZERO',
    'STATUS............. 1 OF 1',
    'CLEARANCE.......... ██████ CLASSIFIED',
  ]
  const typed = useTypewriter(dataLines, dataIn, 17)
  const ticks  = ['Drop 001','Sector Zero','SS — 2025','1 of 1']

  const handleLoaded = useCallback(() => {
    setLoaded(true);setAtm(true)
    setTimeout(()=>setUiIn(true),400)
    setTimeout(()=>setTitleIn(true),720)
    setTimeout(()=>setDataIn(true),1650)
    setTimeout(()=>setFxIn(true),1200)
    const gl=()=>{ const d=3500+Math.random()*5500;setTimeout(()=>{ setGlitch(true);setTimeout(()=>{ setGlitch(false);gl() },420) },d) };gl()
    const start=performance.now()+200,dur=4400
    let raf
    const tick=now=>{ introProgress.current=Math.min(Math.max((now-start)/dur,0),1);if(introProgress.current<1) raf=requestAnimationFrame(tick);else introProgress.current=1 }
    raf=requestAnimationFrame(tick)
  },[])

  useEffect(()=>{ document.body.style.cursor='none';return ()=>{ document.body.style.cursor='auto' } },[])

  return (
    <div style={{ width:'100vw',height:'100vh',overflow:'hidden',background:'#010202',position:'relative' }}>
      <style>{GLOBAL_CSS}</style>
      <Cursor loaded={loaded} />
      <CursorTrail loaded={loaded} />
      <Loader onComplete={handleLoaded} />
      <Atmosphere visible={atm} />

      <BurstFlash stage={burstStage} />
      <GlitchLines stage={burstStage} />
      <PulseRings stage={burstStage} />
      <CinematicParticles visible={fxIn} />
      <DepthFog visible={fxIn} />
      <ScanBeam visible={fxIn} />
      <CornerFlares visible={fxIn} />
      <FilmGrain />
      <Scanlines />

      {/* Horizontal Gallery overlay */}
      <HorizontalGallery visible={galleryOpen} onClose={() => setGalleryOpen(false)} playTick={playTick} />

      <div style={{ position:'fixed',inset:0,zIndex:2 }}>
        <Canvas dpr={[1,2]} gl={{ antialias:true,toneMapping:4,toneMappingExposure:0.68,alpha:true }} style={{ background:'transparent' }}>
          <PerspectiveCamera makeDefault position={[0,0,30]} fov={21} />
          <ambientLight intensity={0.008} color="#001200" />
          <Suspense fallback={null}>
            <Environment preset="night" environmentIntensity={0.3} rotation={[0,Math.PI*0.85,0]} />
            <Scene introProgress={introProgress} onStageChange={handleStageChange} />
            <EffectComposer multisampling={8}>
              <Bloom mipmapBlur intensity={3.2} luminanceThreshold={0.22} radius={0.82} />
              <ChromaticAberration blendFunction={BlendFunction.NORMAL} offset={new Vector2(0.0014,0.0014)} />
              <BrightnessContrast brightness={-0.06} contrast={0.55} />
              <Noise opacity={0.028} />
              <Vignette eskil={false} offset={0.02} darkness={1.95} />
            </EffectComposer>
          </Suspense>
        </Canvas>
      </div>

      <div style={{ position:'fixed',inset:0,zIndex:20,pointerEvents:'none' }}>
        {/* Corner brackets */}
        {[
          {top:16,left:16,   borderTop:`1px solid rgba(57,255,20,0.16)`,borderLeft:`1px solid rgba(57,255,20,0.16)`},
          {top:16,right:16,  borderTop:`1px solid rgba(57,255,20,0.16)`,borderRight:`1px solid rgba(57,255,20,0.16)`},
          {bottom:16,left:16, borderBottom:`1px solid rgba(57,255,20,0.16)`,borderLeft:`1px solid rgba(57,255,20,0.16)`},
          {bottom:16,right:16,borderBottom:`1px solid rgba(57,255,20,0.16)`,borderRight:`1px solid rgba(57,255,20,0.16)`},
        ].map((s,i) => (
          <div key={i} style={{ position:'absolute',width:28,height:28,opacity:uiIn?1:0,transition:`opacity 1s ease ${i*.1}s`,...s }} />
        ))}

        <div style={{ position:'absolute',top:62,left:0,right:0,height:1,background:`linear-gradient(to right,transparent,rgba(57,255,20,0.08) 20%,rgba(57,255,20,0.08) 80%,transparent)`,opacity:uiIn?1:0,transition:'opacity 1.5s ease .6s' }} />

        {/* Nav */}
        <nav style={{ position:'absolute',top:0,left:0,right:0,padding:'18px 42px',display:'flex',justifyContent:'space-between',alignItems:'center',opacity:uiIn?1:0,animation:uiIn?'fade-in 1.2s ease forwards':'none',pointerEvents:loaded?'all':'none' }}>
          <div style={{ display:'flex',alignItems:'center',gap:10 }}>
            <div style={{ width:6,height:6,background:N,boxShadow:`0 0 12px ${N},0 0 24px rgba(57,255,20,0.3)`,opacity:flicker,transition:'opacity 0.04s' }} />
            <GlitchText text="MOONVIILLAIN" active={glitch} style={{ fontFamily:'"Bebas Neue",sans-serif',fontSize:24,letterSpacing:'0.2em',color:W }} />
          </div>
          <div style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:6 }}>
            <Ticker items={ticks} visible={uiIn} />
            <LiveClock visible={uiIn} />
          </div>
          <div style={{ display:'flex',gap:26,alignItems:'center' }}>
            {/* Drop — opens gallery */}
            <MagneticButton onClick={() => { setGalleryOpen(true); playTick() }} onHoverSound={playTick}>
              <span className="mag" style={{ fontFamily:'"Space Mono",monospace',fontSize:7.5,letterSpacing:'0.3em',color:'rgba(160,200,155,0.42)',textTransform:'uppercase',opacity:.6 }}>Drop</span>
            </MagneticButton>
            {['Studio','Contact'].map(it => (
              <MagneticButton key={it} onHoverSound={playTick}>
                <span className="mag" style={{ fontFamily:'"Space Mono",monospace',fontSize:7.5,letterSpacing:'0.3em',color:'rgba(160,200,155,0.42)',textTransform:'uppercase',opacity:.6 }}>{it}</span>
              </MagneticButton>
            ))}
            <MagneticButton strength={0.52} onHoverSound={playTick}>
              <div style={{ border:`1px solid rgba(57,255,20,0.22)`,padding:'5px 15px',animation:'acquire-pulse 3s ease-in-out infinite',transition:'border-color 0.25s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(57,255,20,0.55)'; e.currentTarget.style.animation='none'; e.currentTarget.style.boxShadow=`0 0 28px rgba(57,255,20,0.2),inset 0 0 14px rgba(57,255,20,0.06)` }}
                onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(57,255,20,0.22)'; e.currentTarget.style.animation='acquire-pulse 3s ease-in-out infinite'; e.currentTarget.style.boxShadow='' }}>
                <span style={{ fontFamily:'"Space Mono",monospace',fontSize:7,letterSpacing:'0.38em',color:'rgba(57,255,20,0.6)',textTransform:'uppercase' }}>Acquire</span>
              </div>
            </MagneticButton>
          </div>
        </nav>

        {/* Left rule */}
        <div style={{ position:'absolute',left:42,top:0,bottom:0,display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',gap:18,opacity:uiIn?1:0,transition:'opacity 1.5s ease .5s' }}>
          <div style={{ width:1,flex:1,maxHeight:100,background:'linear-gradient(to bottom,transparent,rgba(57,255,20,0.1))' }} />
          <div style={{ transform:'rotate(-90deg)',whiteSpace:'nowrap',fontFamily:'"Space Mono",monospace',fontSize:6.5,letterSpacing:'0.5em',color:'rgba(57,255,20,0.18)',textTransform:'uppercase' }}>Lunar Chrome — Drop 001</div>
          <div style={{ width:1,flex:1,maxHeight:100,background:'linear-gradient(to bottom,rgba(57,255,20,0.1),transparent)' }} />
        </div>

        {/* Spec sheet */}
        <div style={{ position:'absolute',right:42,top:0,bottom:0,display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'flex-end',opacity:dataIn?1:0,animation:dataIn?'slide-l 1s cubic-bezier(.16,1,.3,1) forwards':'none' }}>
          <div style={{ fontFamily:'"Space Mono",monospace',fontSize:7.5,letterSpacing:'0.1em',textTransform:'uppercase',lineHeight:2.9,textAlign:'right',borderRight:'1px solid rgba(57,255,20,0.1)',paddingRight:16 }}>
            <div style={{ fontSize:6.5,letterSpacing:'0.46em',color:'rgba(57,255,20,0.18)',marginBottom:10 }}>— Spec Sheet ——</div>
            {dataLines.map((line,i) => {
              const t=typed[i]??''
              const isC=line.includes('CLASSIFIED'),done=t===line
              return (
                <div key={i} style={{ opacity:t.length>0?1:0,transition:'opacity 0.3s',color:isC?'rgba(255,30,60,0.8)':'rgba(160,200,155,0.42)',textShadow:isC&&done?'0 0 10px rgba(255,30,60,0.5)':'none' }}>
                  {t}
                  {t.length>0&&t.length<line.length&&<span style={{ animation:'blink .65s step-end infinite',color:N }}>█</span>}
                  {isC&&done&&<span style={{ display:'inline-block',marginLeft:8,width:5,height:5,background:'rgba(255,30,60,0.8)',boxShadow:'0 0 8px rgba(255,30,60,0.6)',verticalAlign:'middle',animation:'pulse-dot 1.3s ease-in-out infinite' }} />}
                </div>
              )
            })}
          </div>
          <div style={{ width:1,height:65,background:'linear-gradient(to bottom,rgba(57,255,20,0.1),transparent)',marginTop:16 }} />
        </div>

        {/* Hero title — now with parallax depth */}
        <div style={{ position:'absolute',bottom:0,left:0,padding:'0 0 46px 70px' }}>
          <div style={{ display:'flex',alignItems:'center',gap:14,marginBottom:16,opacity:titleIn?1:0,animation:titleIn?'fade-up 1s ease .05s forwards':'none' }}>
            <div style={{ width:28,height:1,background:N,boxShadow:`0 0 6px ${N}`,opacity:flicker,transition:'opacity 0.04s' }} />
            <span style={{ fontFamily:'"Space Mono",monospace',fontSize:7.5,letterSpacing:'0.44em',color:'rgba(57,255,20,0.5)',textTransform:'uppercase' }}>Sector Zero — SS 2025</span>
          </div>

          {/* Parallax title replaces original SplitText */}
          <ParallaxTitle visible={titleIn} mouseX={mouseX} mouseY={mouseY} delay={0.05} />

          <div style={{ marginTop:20,overflow:'hidden' }}>
            <div style={{ fontFamily:'"Barlow Condensed",sans-serif',fontWeight:200,fontSize:'clamp(14px,1.6vw,20px)',letterSpacing:'0.22em',textTransform:'uppercase',color:'rgba(160,200,155,0.32)',animation:titleIn?'sweep-up 1.2s cubic-bezier(.16,1,.3,1) .95s both':'none' }}>
              The dark side of something beautiful.
            </div>
          </div>

          <MagneticButton strength={0.28} style={{ marginTop:18 }} onHoverSound={playTick}>
            <div style={{ display:'inline-flex',alignItems:'center',gap:10,border:'1px solid rgba(57,255,20,0.14)',padding:'6px 14px',boxShadow:'0 0 20px rgba(57,255,20,0.04)',opacity:titleIn?1:0,animation:titleIn?'fade-up 1.2s ease 1.1s both':'none',transition:'border-color 0.3s,box-shadow 0.3s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(57,255,20,0.35)'; e.currentTarget.style.boxShadow='0 0 28px rgba(57,255,20,0.12)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(57,255,20,0.14)'; e.currentTarget.style.boxShadow='0 0 20px rgba(57,255,20,0.04)' }}>
              <div style={{ width:4,height:4,background:N,boxShadow:`0 0 8px ${N}`,opacity:flicker,transition:'opacity 0.04s' }} />
              <span style={{ fontFamily:'"Space Mono",monospace',fontSize:6.5,letterSpacing:'0.4em',color:'rgba(57,255,20,0.45)',textTransform:'uppercase' }}>1 of 1 — Drop 001</span>
            </div>
          </MagneticButton>
        </div>

        {/* Scroll indicator */}
        <div style={{ position:'absolute',bottom:38,left:'50%',transform:'translateX(-50%)',display:'flex',flexDirection:'column',alignItems:'center',gap:10,opacity:uiIn?1:0,transition:'opacity 1.8s ease 1.4s' }}>
          <span style={{ fontFamily:'"Space Mono",monospace',fontSize:6.5,letterSpacing:'0.52em',color:'rgba(57,255,20,0.16)',textTransform:'uppercase' }}>Scroll</span>
          <div style={{ width:1,height:42,background:'linear-gradient(to bottom,rgba(57,255,20,0.12),transparent)',position:'relative',overflow:'hidden' }}>
            <div style={{ position:'absolute',width:'100%',height:4,background:N,boxShadow:`0 0 8px ${N}`,borderRadius:2,animation:'scroll-d 2.3s ease-in-out infinite' }} />
          </div>
        </div>

        {/* Bottom right */}
        <div style={{ position:'absolute',bottom:38,right:42,textAlign:'right',opacity:uiIn?1:0,transition:'opacity 1.8s ease 1.2s',fontFamily:'"Space Mono",monospace',fontSize:7.5,letterSpacing:'0.26em',color:'rgba(57,255,20,0.16)',textTransform:'uppercase',lineHeight:2.5 }}>
          <div>Move to reveal</div>
          <div>© 2025 Moonviillain</div>
        </div>

        {/* Watermark 001 */}
        <div style={{ position:'absolute',right:55,top:'50%',transform:'translateY(-50%)',fontFamily:'"Bebas Neue",sans-serif',fontSize:'clamp(150px,21vw,300px)',lineHeight:1,letterSpacing:'0.06em',color:'rgba(57,255,20,0.022)',pointerEvents:'none',userSelect:'none',opacity:uiIn?1:0,transition:'opacity 2.5s ease 1.1s',zIndex:-1 }}>001</div>
      </div>

      {/* Marquee */}
      <div style={{ position:'fixed',zIndex:19,left:0,right:0,bottom:64,opacity:uiIn?1:0,transition:'opacity 1.5s ease 1.1s' }}>
        <div style={{ borderTop:'1px solid rgba(57,255,20,0.04)',borderBottom:'1px solid rgba(57,255,20,0.04)',padding:'8px 0',overflow:'hidden' }}>
          <div style={{ display:'inline-block',whiteSpace:'nowrap',animation:'mq 26s linear infinite' }}>
            {Array(10).fill('MOONVIILLAIN — DROP 001 — VOID CHROME — SECTOR ZERO — 1 OF 1 — SS25 —').map((t,i) => (
              <span key={i} style={{ fontFamily:'"Space Mono",monospace',fontSize:'clamp(8px,.82vw,10px)',letterSpacing:'0.28em',color:'rgba(57,255,20,0.09)',marginRight:'2.8rem',textTransform:'uppercase' }}>
                {t} <span style={{ color:'rgba(57,255,20,0.04)' }}>◆</span>{' '}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
