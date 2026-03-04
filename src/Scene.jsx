import React, { useRef, useLayoutEffect, useMemo, useEffect } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// ── AMBIENT DUST ─────────────────────────────────────────────
function AmbientDust() {
  const ref   = useRef()
  const count = 600
  const { positions, speeds, phases } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const speeds    = new Float32Array(count)
    const phases    = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      positions[i*3]   = (Math.random() - 0.5) * 28
      positions[i*3+1] = (Math.random() - 0.5) * 20
      positions[i*3+2] = (Math.random() - 0.5) * 14
      speeds[i] = 0.0004 + Math.random() * 0.0018
      phases[i] = Math.random() * Math.PI * 2
    }
    return { positions, speeds, phases }
  }, [])
  const posRef = useRef(new Float32Array(positions))

  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.getElapsedTime()
    const arr = posRef.current
    for (let i = 0; i < count; i++) {
      arr[i*3]   += Math.sin(t * 0.12 + phases[i]) * 0.0004
      arr[i*3+1] += speeds[i] * 0.25
      arr[i*3+2] += Math.cos(t * 0.10 + phases[i]) * 0.0003
      if (arr[i*3+1] > 10) arr[i*3+1] = -10
    }
    ref.current.geometry.attributes.position.array.set(arr)
    ref.current.geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.018} color="#39ff14" transparent opacity={0.06} sizeAttenuation depthWrite={false} />
    </points>
  )
}

// ── ORBITAL RING ──────────────────────────────────────────────
function OrbitalRing({ introProgress }) {
  const ref  = useRef()
  const ref2 = useRef()

  useFrame((state) => {
    const t  = state.clock.getElapsedTime()
    const ip = introProgress.current
    const appear = THREE.MathUtils.clamp((ip - 0.75) / 0.25, 0, 1)

    if (ref.current) {
      ref.current.rotation.x = Math.sin(t * 0.14) * 0.3 + 0.5
      ref.current.rotation.y = t * 0.18
      ref.current.rotation.z = Math.cos(t * 0.10) * 0.2
      ref.current.material.opacity = appear * 0.22
    }
    if (ref2.current) {
      ref2.current.rotation.x = -Math.sin(t * 0.11) * 0.4 - 0.3
      ref2.current.rotation.y = -t * 0.13
      ref2.current.rotation.z = Math.cos(t * 0.09) * 0.3
      ref2.current.material.opacity = appear * 0.14
    }
  })

  return (
    <>
      <mesh ref={ref}>
        <torusGeometry args={[3.2, 0.006, 2, 180]} />
        <meshBasicMaterial color="#39ff14" transparent opacity={0} />
      </mesh>
      <mesh ref={ref2}>
        <torusGeometry args={[4.1, 0.004, 2, 180]} />
        <meshBasicMaterial color="#00ffaa" transparent opacity={0} />
      </mesh>
    </>
  )
}

// ── ENERGY FIELD ──────────────────────────────────────────────
function EnergyField({ introProgress }) {
  const ref   = useRef()
  const count = 120
  const { angles, radii, speeds, heights, phases } = useMemo(() => {
    const angles  = new Float32Array(count)
    const radii   = new Float32Array(count)
    const speeds  = new Float32Array(count)
    const heights = new Float32Array(count)
    const phases  = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      angles[i]  = (i / count) * Math.PI * 2
      radii[i]   = 2.2 + Math.random() * 2.8
      speeds[i]  = (0.12 + Math.random() * 0.22) * (Math.random() > 0.5 ? 1 : -1)
      heights[i] = (Math.random() - 0.5) * 5
      phases[i]  = Math.random() * Math.PI * 2
    }
    return { angles, radii, speeds, heights, phases }
  }, [])

  const positions = useMemo(() => new Float32Array(count * 3), [])
  const posRef    = useRef(positions)

  useFrame((state) => {
    if (!ref.current) return
    const t  = state.clock.getElapsedTime()
    const ip = introProgress.current
    const appear = THREE.MathUtils.clamp((ip - 0.7) / 0.3, 0, 1)
    const arr    = posRef.current

    for (let i = 0; i < count; i++) {
      const a = angles[i] + t * speeds[i]
      const r = radii[i] + Math.sin(t * 0.4 + phases[i]) * 0.4
      arr[i*3]   = Math.cos(a) * r
      arr[i*3+1] = heights[i] + Math.sin(t * 0.25 + phases[i]) * 0.6
      arr[i*3+2] = Math.sin(a) * r
    }
    ref.current.geometry.attributes.position.array.set(arr)
    ref.current.geometry.attributes.position.needsUpdate = true
    ref.current.material.opacity = appear * 0.55
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.045} color="#39ff14" transparent opacity={0} sizeAttenuation depthWrite={false} />
    </points>
  )
}

// ── FLOATING SHARDS ───────────────────────────────────────────
function FloatingShards({ introProgress }) {
  const shards = useMemo(() => {
    return Array.from({ length: 18 }, () => ({
      x: (Math.random() - 0.5) * 12,
      y: (Math.random() - 0.5) * 10,
      z: (Math.random() - 0.5) * 6 - 2,
      rx: Math.random() * Math.PI,
      ry: Math.random() * Math.PI,
      sx: 0.02 + Math.random() * 0.06,
      sy: 0.04 + Math.random() * 0.10,
      sz: 0.005 + Math.random() * 0.02,
      phase: Math.random() * Math.PI * 2,
      speed: 0.3 + Math.random() * 0.5,
      col: Math.random() > 0.3 ? '#39ff14' : '#7700ff',
    }))
  }, [])

  const refs = useRef(shards.map(() => React.createRef()))

  useFrame((state) => {
    const t  = state.clock.getElapsedTime()
    const ip = introProgress.current
    const appear = THREE.MathUtils.clamp((ip - 0.72) / 0.28, 0, 1)

    shards.forEach((s, i) => {
      const mesh = refs.current[i].current
      if (!mesh) return
      mesh.position.x = s.x + Math.sin(t * s.speed * 0.4 + s.phase) * 0.5
      mesh.position.y = s.y + Math.sin(t * s.speed * 0.3 + s.phase + 1) * 0.6
      mesh.position.z = s.z + Math.cos(t * s.speed * 0.25 + s.phase) * 0.3
      mesh.rotation.x = s.rx + t * s.speed * 0.5
      mesh.rotation.y = s.ry + t * s.speed * 0.35
      mesh.material.opacity = appear * 0.35
    })
  })

  return (
    <>
      {shards.map((s, i) => (
        <mesh key={i} ref={refs.current[i]} position={[s.x, s.y, s.z]}>
          <boxGeometry args={[s.sx, s.sy, s.sz]} />
          <meshBasicMaterial color={s.col} transparent opacity={0} />
        </mesh>
      ))}
    </>
  )
}

// ── CINEMATIC CAMERA ──────────────────────────────────────────
function CinematicCamera({ introProgress }) {
  const { camera } = useThree()
  useFrame((state) => {
    const t  = state.clock.getElapsedTime()
    const ip = introProgress.current
    const eased   = 1 - Math.pow(1 - THREE.MathUtils.clamp(ip / 0.85, 0, 1), 5)
    const targetZ = THREE.MathUtils.lerp(52, 9.2, eased)
    const breath  = THREE.MathUtils.clamp((ip - 0.85) / 0.15, 0, 1)
    camera.position.z = targetZ + Math.sin(t * 0.28) * 0.13 * breath
    camera.position.y = Math.sin(t * 0.20) * 0.065 * breath
    camera.position.x = Math.sin(t * 0.15) * 0.038 * breath
    camera.lookAt(0, 0, 0)
  })
  return null
}

// ── LIGHTING ──────────────────────────────────────────────────
function StreetLighting({ burstStageRef }) {
  const keyRef   = useRef()
  const neon1Ref = useRef()
  const neon2Ref = useRef()
  const neon3Ref = useRef()
  const rimRef   = useRef()
  const underRef = useRef()
  const backRef  = useRef()

  useFrame((state) => {
    const t    = state.clock.getElapsedTime()
    const mx   = state.mouse.x
    const my   = state.mouse.y
    const stage = burstStageRef ? burstStageRef.current : 'idle'

    const isExplode    = stage === 'explode'
    const isDark       = stage === 'dark'
    const isReassemble = stage === 'reassemble'

    if (keyRef.current) {
      keyRef.current.position.lerp(new THREE.Vector3(mx * 4, my * 3.5 + 0.5, 6), 0.035)
      if (isExplode) {
        keyRef.current.intensity = 18 + Math.sin(t * 40) * 6
        keyRef.current.color.set('#ffffff')
      } else if (isDark) {
        keyRef.current.intensity = 0
        keyRef.current.color.set('#ffffff')
      } else if (isReassemble) {
        keyRef.current.intensity = 2 + t * 0.1
        keyRef.current.color.set('#aaffcc')
      } else {
        keyRef.current.intensity = 3.5 + Math.sin(t * 0.15) * 0.3
        keyRef.current.color.set('#ddf0ff')
      }
    }
    if (neon1Ref.current) {
      neon1Ref.current.position.set(Math.sin(t * 0.12) * 10, 2 + Math.cos(t * 0.09) * 4, Math.cos(t * 0.12) * 4)
      neon1Ref.current.intensity = isExplode ? 28 + Math.sin(t * 60) * 8
        : isDark ? 0
        : isReassemble ? 4 + Math.sin(t * 1.2) * 2
        : 8 + Math.sin(t * 0.38) * 2.5
      neon1Ref.current.color.set(isExplode ? '#ffffff' : isReassemble ? '#00ffaa' : '#39ff14')
    }
    if (neon2Ref.current) {
      neon2Ref.current.position.set(Math.cos(t * 0.15 + Math.PI) * 8, -2 + Math.sin(t * 0.11) * 3, Math.sin(t * 0.15 + Math.PI) * 5)
      neon2Ref.current.intensity = isDark ? 0.8 + Math.sin(t * 3) * 0.5
        : isReassemble ? 6 + Math.sin(t * 0.8) * 2
        : 5 + Math.sin(t * 0.44 + 1.2) * 1.8
      neon2Ref.current.color.set(isDark ? '#330022' : '#00ffaa')
    }
    if (neon3Ref.current) {
      neon3Ref.current.position.set(Math.sin(t * 0.09 + 2) * 5, 6 + Math.sin(t * 0.13) * 2, Math.cos(t * 0.09 + 2) * 3)
      neon3Ref.current.intensity = 3.5 + Math.sin(t * 0.55 + 2) * 1.2
    }
    if (rimRef.current) {
      rimRef.current.position.set(Math.sin(t * 0.07) * 5, 7 + Math.cos(t * 0.09) * 2, -9)
      rimRef.current.intensity = isExplode ? 22 + Math.sin(t * 50) * 6
        : isDark ? 3 + Math.sin(t * 6) * 2
        : isReassemble ? 9 + Math.sin(t * 0.6) * 2
        : 7 + Math.sin(t * 0.12) * 1.5
      rimRef.current.color.set(isExplode ? '#ff44ff' : isDark ? '#440033' : '#7700ff')
    }
    if (underRef.current) {
      underRef.current.position.set(Math.sin(t * 0.10 + 1) * 4, -5.5, 0)
      underRef.current.intensity = isDark ? 0 : 2.5 + Math.sin(t * 0.6) * 0.8
    }
    if (backRef.current) {
      backRef.current.position.set(Math.sin(t * 0.06) * 5, 0, -10)
    }
  })

  return (
    <>
      <pointLight ref={keyRef}   intensity={3.5} distance={18} decay={2}   color="#ddf0ff" />
      <pointLight ref={neon1Ref} intensity={8}   distance={18} decay={1.8} color="#39ff14" />
      <pointLight ref={neon2Ref} intensity={5}   distance={16} decay={2}   color="#00ffaa" />
      <pointLight ref={neon3Ref} intensity={3.5} distance={14} decay={2}   color="#44ff88" />
      <pointLight ref={rimRef}   intensity={7}   distance={24} decay={2}   color="#7700ff" />
      <pointLight ref={underRef} intensity={2.5} distance={12} decay={2}   color="#00ff44" />
      <pointLight ref={backRef}  intensity={3}   distance={18} decay={2}   color="#0033ff" />
      <directionalLight position={[0, 6, 4]} intensity={0.08} color="#ffffff" />
    </>
  )
}

// ── MAIN SCENE ────────────────────────────────────────────────
export default function Scene({ introProgress, onStageChange }) {
  const { scene }   = useGLTF('/Untitled-v1.glb')
  const groupRef    = useRef()
  const centered    = useRef(false)
  const currentRot  = useRef({ x: 0, y: 0 })
  const currentPos  = useRef({ x: 0, y: 0 })
  const meshes      = useRef([])
  const glitchState = useRef({ active: false, timer: 0, cooldown: 3 + Math.random() * 5, intensity: 0 })
  const touchInput  = useRef(null)

  useEffect(() => {
    const onTouch = (e) => {
      const t = e.touches[0]
      if (!t) return
      touchInput.current = {
        x:  (t.clientX / window.innerWidth)  * 2 - 1,
        y: -((t.clientY / window.innerHeight) * 2 - 1),
      }
    }
    const onEnd = () => { touchInput.current = null }
    window.addEventListener('touchmove', onTouch, { passive: true })
    window.addEventListener('touchend', onEnd)
    return () => {
      window.removeEventListener('touchmove', onTouch)
      window.removeEventListener('touchend', onEnd)
    }
  }, [])

  const sharedUniforms = useRef({
    uTime:          { value: 0 },
    uBreath:        { value: 0 },
    uGlitchTime:    { value: 0 },
    uGlitchAmount:  { value: 0 },
    uFragmentBurst: { value: 0 },
    uReassemble:    { value: 0 },
    uSeed:          { value: Math.random() * 100 },
  })

  useLayoutEffect(() => {
    meshes.current = []
    const u = sharedUniforms.current

    scene.traverse((obj) => {
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

      obj.material.onBeforeCompile = (shader) => {
        shader.uniforms.uTime          = u.uTime
        shader.uniforms.uBreath        = u.uBreath
        shader.uniforms.uGlitchTime    = u.uGlitchTime
        shader.uniforms.uGlitchAmount  = u.uGlitchAmount
        shader.uniforms.uFragmentBurst = u.uFragmentBurst
        shader.uniforms.uReassemble    = u.uReassemble
        shader.uniforms.uSeed          = u.uSeed

        shader.vertexShader = shader.vertexShader.replace(
          '#include <common>',
          `#include <common>
          uniform float uTime;
          uniform float uBreath;
          uniform float uGlitchTime;
          uniform float uGlitchAmount;
          uniform float uFragmentBurst;
          uniform float uReassemble;
          uniform float uSeed;

          float hash(float n){ return fract(sin(n) * 43758.5453123); }
          float hash2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          vec3 hash3(float n){ return vec3(hash(n), hash(n+1.0), hash(n+2.0)) * 2.0 - 1.0; }

          float noise(vec3 p){
            vec3 i = floor(p); vec3 f = fract(p);
            f = f*f*(3.0-2.0*f);
            return mix(
              mix(mix(hash(dot(i,vec3(1,57,113))),hash(dot(i+vec3(1,0,0),vec3(1,57,113))),f.x),
                  mix(hash(dot(i+vec3(0,1,0),vec3(1,57,113))),hash(dot(i+vec3(1,1,0),vec3(1,57,113))),f.x),f.y),
              mix(mix(hash(dot(i+vec3(0,0,1),vec3(1,57,113))),hash(dot(i+vec3(1,0,1),vec3(1,57,113))),f.x),
                  mix(hash(dot(i+vec3(0,1,1),vec3(1,57,113))),hash(dot(i+vec3(1,1,1),vec3(1,57,113))),f.x),f.y),
            f.z);
          }
          `
        )

        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>

          float breathNoise = noise(position * 1.8 + uTime * 0.14);
          float microPulse = sin(uTime * 1.6 + position.y * 12.0 + breathNoise * 4.0) * 0.006 * uBreath;
          transformed += normal * microPulse;

          float shardID  = floor((position.y + uSeed) / 0.12) + floor(position.x / 0.10) * 31.0;
          float shardRnd = hash(shardID + 7.3);
          float stagger  = 0.5 + shardRnd * 1.0;

          vec3 burstDir   = normalize(hash3(shardID) + normal * 0.4);
          float burstDist = 1.4 + shardRnd * 4.0;

          float bf  = uFragmentBurst;
          float t0  = clamp(bf * stagger, 0.0, 1.0);
          float arc = t0 * t0 * t0;

          transformed += burstDir * burstDist * arc;

          float spinAmt = arc * shardRnd * 3.14159 * 3.0;
          vec3 rotAxis  = normalize(hash3(shardID + 99.0));
          float cosR = cos(spinAmt); float sinR = sin(spinAmt);
          transformed = transformed * cosR
            + cross(rotAxis, transformed) * sinR
            + rotAxis * dot(rotAxis, transformed) * (1.0 - cosR);

          float ra = uReassemble;
          if (ra > 0.0) {
            vec3 origin = vec3(0.0, 0.0, -14.0);
            vec3 travel = transformed - origin;
            float travelDist  = length(travel);
            float arrivalDelay = (1.0 - clamp(travelDist / 10.0, 0.0, 1.0)) * 0.3
                                 + shardRnd * 0.12;
            float ras = clamp((ra - arrivalDelay) / (1.0 - arrivalDelay + 0.001), 0.0, 1.0);
            float ease = 1.0 - pow(1.0 - ras, 5.0);
            vec3 perpA = normalize(cross(travel, vec3(0.0, 1.0, 0.0)) + 0.001);
            vec3 perpB = normalize(cross(travel, perpA));
            float noiseA = noise(position * 2.0 + uTime * 1.1 + shardRnd * 5.0);
            float noiseB = noise(position * 2.0 + uTime * 0.9 + shardRnd * 9.0 + 3.3);
            vec3 swarm = (perpA * noiseA + perpB * noiseB) * 1.8 * (1.0 - ease);
            transformed = origin + travel * ease + swarm;
          }

          float slab = floor((position.y + uSeed) / 0.06);
          float sr   = hash(slab + floor(uGlitchTime * 14.0));
          if (sr > 0.82) {
            float s = (sr - 0.82) / 0.18;
            transformed.x += s * uGlitchAmount * 0.55 * sign(hash(slab) - 0.5);
            transformed.z += s * uGlitchAmount * 0.15 * sign(hash(slab + 1.0) - 0.5);
            transformed.y += s * uGlitchAmount * 0.08 * sign(hash(slab + 2.0) - 0.5);
          }
          `
        )

        obj.material.userData.shader = shader
      }

      obj.material.needsUpdate = true
      meshes.current.push(obj)
    })
  }, [scene]) // eslint-disable-line

  const burstStageRef = useRef('idle')

  const burstState = useRef({
    stage: 'idle',
    progress: 0,
    cooldown: 5 + Math.random() * 8,
    explodeSpeed:   0.9,
    darkDuration:   0.45,
    darkTimer:      0,
    reassembleSpeed: 0.42,
  })

  useFrame((state, delta) => {
    if (!groupRef.current) return
    const t  = state.clock.getElapsedTime()
    const ip = introProgress ? introProgress.current : 1
    const u  = sharedUniforms.current

    if (!centered.current) {
      const box = new THREE.Box3().setFromObject(scene)
      if (box.min.x !== Infinity) {
        const c = new THREE.Vector3(); box.getCenter(c); scene.position.sub(c)
        centered.current = true
      }
    }

    const breathStrength = THREE.MathUtils.clamp((ip - 0.75) / 0.25, 0, 1)
    u.uTime.value   = t
    u.uBreath.value = breathStrength

    if (ip > 0.88) {
      const gs = glitchState.current
      if (gs.active) {
        gs.timer -= delta
        gs.intensity = Math.min(gs.intensity + delta * 18, 1)
        if (gs.timer <= 0) { gs.active = false; gs.cooldown = 3 + Math.random() * 5; gs.intensity = 0 }
      } else {
        gs.cooldown -= delta
        if (gs.cooldown <= 0) { gs.active = true; gs.timer = 0.035 + Math.random() * 0.09 }
      }
      u.uGlitchTime.value   = t
      u.uGlitchAmount.value = gs.active ? gs.intensity : 0
    }

    const baseOpacity = THREE.MathUtils.clamp((ip - 0.35) / 0.4, 0, 1)
    const bs = burstState.current

    if (ip > 0.9) {
      if (bs.stage === 'idle') {
        u.uFragmentBurst.value = 0
        u.uReassemble.value    = 0
        meshes.current.forEach(obj => { obj.material.opacity = baseOpacity })
        bs.cooldown -= delta
        if (bs.cooldown <= 0) {
          bs.stage    = 'explode'
          bs.progress = 0
          onStageChange && onStageChange('explode')
          burstStageRef.current = 'explode'
        }

      } else if (bs.stage === 'explode') {
        bs.progress += delta * bs.explodeSpeed
        const p = Math.min(bs.progress, 1.0)
        u.uFragmentBurst.value = p
        u.uReassemble.value    = 0
        const opacity = Math.max(0, 1 - p / 0.6) * baseOpacity
        meshes.current.forEach(obj => { obj.material.opacity = opacity })
        if (bs.progress >= 1.0) {
          bs.stage     = 'dark'
          bs.darkTimer = 0
          u.uFragmentBurst.value = 0
          meshes.current.forEach(obj => { obj.material.opacity = 0 })
          onStageChange && onStageChange('dark')
          burstStageRef.current = 'dark'
        }

      } else if (bs.stage === 'dark') {
        bs.darkTimer += delta
        u.uFragmentBurst.value = 0
        u.uReassemble.value    = 0
        meshes.current.forEach(obj => { obj.material.opacity = 0 })
        if (bs.darkTimer >= bs.darkDuration) {
          bs.stage    = 'reassemble'
          bs.progress = 0
          onStageChange && onStageChange('reassemble')
          burstStageRef.current = 'reassemble'
        }

      } else if (bs.stage === 'reassemble') {
        bs.progress += delta * bs.reassembleSpeed
        const p = Math.min(bs.progress, 1.0)
        u.uFragmentBurst.value = 0
        u.uReassemble.value    = p
        const opacity = Math.min(1, Math.max(0, (p - 0.15) / 0.6)) * baseOpacity
        meshes.current.forEach(obj => { obj.material.opacity = opacity })
        if (bs.progress >= 1.0) {
          bs.stage    = 'idle'
          bs.cooldown = 7 + Math.random() * 11
          u.uReassemble.value = 0
          meshes.current.forEach(obj => { obj.material.opacity = baseOpacity })
          onStageChange && onStageChange('idle')
          burstStageRef.current = 'idle'
        }
      }
    } else {
      u.uFragmentBurst.value = 0
      u.uReassemble.value    = 0
      meshes.current.forEach(obj => { obj.material.opacity = baseOpacity })
    }

    const introSpin = (1 - THREE.MathUtils.clamp((ip - 0.35) / 0.65, 0, 1)) * Math.PI * 0.4
    const track     = THREE.MathUtils.clamp((ip - 0.72) / 0.28, 0, 1)
    const mx = touchInput.current ? touchInput.current.x : state.mouse.x
    const my = touchInput.current ? touchInput.current.y : state.mouse.y
    currentRot.current.x += (-my * 0.26 - currentRot.current.x) * 0.045 * track
    currentRot.current.y += ( mx * 0.38 + introSpin - currentRot.current.y) * 0.045
    currentPos.current.x += ( mx * 0.13 - currentPos.current.x) * 0.034 * track
    currentPos.current.y += ( my * 0.08 - currentPos.current.y) * 0.034 * track

    groupRef.current.rotation.x = currentRot.current.x
    groupRef.current.rotation.y = currentRot.current.y
    groupRef.current.position.x = currentPos.current.x
    groupRef.current.position.y = currentPos.current.y + Math.sin(t * 0.44) * 0.025
  })

  return (
    <>
      <CinematicCamera introProgress={introProgress} />
      <StreetLighting burstStageRef={burstStageRef} />
      <group ref={groupRef}>
        <primitive object={scene} scale={1.22} />
      </group>
      <AmbientDust />
      <EnergyField introProgress={introProgress} />
      <OrbitalRing introProgress={introProgress} />
      <FloatingShards introProgress={introProgress} />
    </>
  )
}