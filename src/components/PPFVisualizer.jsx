import { Canvas } from '@react-three/fiber'
import { ContactShadows, OrbitControls, RoundedBox } from '@react-three/drei'
import { Suspense, useMemo, useState } from 'react'
import { Box, Rotate3D, ShieldCheck } from 'lucide-react'

const packages = {
  Basic: { label: 'High-impact zones', coverage: 'Hood, doors & lights', thickness: '7.5 mil' },
  Premium: { label: 'Complete panel coverage', coverage: 'All panels + trims', thickness: '8 mil' },
  Platinum: { label: 'Maximum full-body armor', coverage: 'Entire exterior', thickness: '8.5 mil' },
}

const panels = [
  { id: 'lowerBody', type: 'box', position: [0, 0.95, 0], size: [5.5, 0.9, 2.05], radius: 0.22, premium: true },
  { id: 'hood', type: 'box', position: [1.77, 1.52, 0], size: [1.75, 0.28, 1.92], radius: 0.16, basic: true, premium: true },
  { id: 'roof', type: 'box', position: [-0.65, 2.32, 0], size: [2.7, 0.18, 1.72], radius: 0.14, premium: true },
  { id: 'frontDoorL', type: 'box', position: [0.2, 1.46, 1.035], size: [1.28, 1.18, 0.1], radius: 0.1, basic: true, premium: true },
  { id: 'rearDoorL', type: 'box', position: [-1.25, 1.43, 1.035], size: [1.42, 1.14, 0.1], radius: 0.1, basic: true, premium: true },
  { id: 'frontDoorR', type: 'box', position: [0.2, 1.46, -1.035], size: [1.28, 1.18, 0.1], radius: 0.1, basic: true, premium: true },
  { id: 'rearDoorR', type: 'box', position: [-1.25, 1.43, -1.035], size: [1.42, 1.14, 0.1], radius: 0.1, basic: true, premium: true },
  { id: 'frontBumper', type: 'box', position: [2.78, 0.86, 0], size: [0.25, 0.7, 1.94], radius: 0.14, premium: true },
  { id: 'rearBumper', type: 'box', position: [-2.78, 0.86, 0], size: [0.25, 0.7, 1.94], radius: 0.14, premium: true },
]

const lights = [
  { id: 'headL', position: [2.87, 1.44, 0.68], color: '#e8f7ff', basic: true },
  { id: 'headR', position: [2.87, 1.44, -0.68], color: '#e8f7ff', basic: true },
  { id: 'tailL', position: [-2.87, 1.4, 0.7], color: '#ff243d', basic: true },
  { id: 'tailR', position: [-2.87, 1.4, -0.7], color: '#ff243d', basic: true },
]

function OverlayMaterial({ tier }) {
  const platinum = tier === 'Platinum'
  return <meshPhysicalMaterial color={platinum ? '#efff72' : '#bdf7ff'} emissive={platinum ? '#dfff20' : '#39d6ff'} emissiveIntensity={platinum ? 1.1 : 0.45} transparent opacity={platinum ? 0.48 : 0.26} roughness={0.12} metalness={0.05} clearcoat={1} clearcoatRoughness={0.05} depthWrite={false} />
}

function Panel({ panel, tier }) {
  const selected = tier === 'Platinum' || (tier === 'Premium' && panel.premium) || (tier === 'Basic' && panel.basic)
  const thickness = tier === 'Platinum' ? 1.055 : 1.025
  return (
    <group>
      <RoundedBox args={panel.size} radius={panel.radius} smoothness={4} position={panel.position}>
        <meshPhysicalMaterial color="#252d31" metalness={0.72} roughness={0.2} clearcoat={1} clearcoatRoughness={0.12} />
      </RoundedBox>
      {selected && <RoundedBox args={panel.size.map((value) => value * thickness)} radius={panel.radius} smoothness={4} position={panel.position} renderOrder={2}><OverlayMaterial tier={tier} /></RoundedBox>}
    </group>
  )
}

function Light({ light, tier }) {
  const selected = tier === 'Platinum' || tier === 'Premium' || (tier === 'Basic' && light.basic)
  return <group position={light.position}><RoundedBox args={[0.1, 0.27, 0.55]} radius={0.07} smoothness={3}><meshStandardMaterial color={light.color} emissive={light.color} emissiveIntensity={1.5} /></RoundedBox>{selected && <RoundedBox args={tier === 'Platinum' ? [0.15, 0.34, 0.66] : [0.13, 0.31, 0.62]} radius={0.08} smoothness={3}><OverlayMaterial tier={tier} /></RoundedBox>}</group>
}

function Wheel({ position }) {
  return <group position={position} rotation={[Math.PI / 2, 0, 0]}><mesh><cylinderGeometry args={[0.64, 0.64, 0.34, 32]} /><meshStandardMaterial color="#080a0b" roughness={0.7} /></mesh><mesh><cylinderGeometry args={[0.38, 0.38, 0.36, 12]} /><meshStandardMaterial color="#687177" metalness={0.9} roughness={0.2} /></mesh><mesh><cylinderGeometry args={[0.14, 0.14, 0.38, 24]} /><meshStandardMaterial color="#121719" metalness={0.8} /></mesh></group>
}

function SUV({ tier }) {
  const wheels = useMemo(() => [[1.85, 0.67, 1.08], [1.85, 0.67, -1.08], [-1.9, 0.67, 1.08], [-1.9, 0.67, -1.08]], [])
  const allTrimSelected = tier === 'Premium' || tier === 'Platinum'
  return (
    <group rotation={[0, -0.12, 0]}>
      {panels.map((panel) => <Panel key={panel.id} panel={panel} tier={tier} />)}
      <RoundedBox args={[2.75, 0.88, 1.78]} radius={0.22} smoothness={4} position={[-0.58, 1.9, 0]}><meshPhysicalMaterial color="#111a1f" metalness={0.35} roughness={0.1} transmission={0.15} clearcoat={1} /></RoundedBox>
      <mesh position={[1.04, 1.98, 0]} rotation={[0, 0, -0.54]}><boxGeometry args={[0.08, 0.92, 1.66]} /><meshPhysicalMaterial color="#172329" roughness={0.08} metalness={0.25} /></mesh>
      <mesh position={[-2.03, 1.95, 0]} rotation={[0, 0, 0.22]}><boxGeometry args={[0.07, 0.8, 1.66]} /><meshPhysicalMaterial color="#172329" roughness={0.08} /></mesh>
      {lights.map((light) => <Light key={light.id} light={light} tier={tier} />)}
      {wheels.map((position) => <Wheel key={position.join('-')} position={position} />)}
      <RoundedBox args={[4.9, 0.16, 2.14]} radius={0.07} smoothness={3} position={[-0.05, 0.67, 0]}><meshStandardMaterial color="#090c0e" metalness={0.45} /></RoundedBox>
      {allTrimSelected && <RoundedBox args={tier === 'Platinum' ? [5.02, 0.23, 2.22] : [4.96, 0.2, 2.18]} radius={0.08} smoothness={3} position={[-0.05, 0.67, 0]}><OverlayMaterial tier={tier} /></RoundedBox>}
    </group>
  )
}

export default function PPFVisualizer({ onBook }) {
  const [tier, setTier] = useState('Basic')
  const details = packages[tier]
  return (
    <section id="visualizer" className="border-y border-line bg-[#0b1012] py-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mb-10 grid gap-6 lg:grid-cols-[1fr_.7fr] lg:items-end"><div><p className="eyebrow">Interactive PPF studio</p><h2 className="section-title">See your protection.</h2></div><p className="max-w-lg text-sm leading-6 text-mist">Drag to inspect every angle. Switch packages to reveal exactly where our paint protection film wraps your vehicle.</p></div>
        <div className="overflow-hidden rounded-3xl border border-line bg-ink shadow-2xl">
          <div className="relative h-[430px] sm:h-[560px]">
            <div className="pointer-events-none absolute left-5 top-5 z-10 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-[10px] font-bold uppercase tracking-[.2em] text-white/70 backdrop-blur"><Rotate3D className="mr-2 inline text-acid" size={14} />Drag to rotate · Scroll to zoom</div>
            <div className="pointer-events-none absolute bottom-5 right-5 z-10 text-right"><p className="font-display text-2xl text-acid">{details.thickness}</p><p className="text-[9px] font-bold uppercase tracking-[.25em] text-mist">Film thickness</p></div>
            <Canvas camera={{ position: [7.2, 4.2, 7.5], fov: 38 }} dpr={[1, 1.6]} gl={{ antialias: true }} aria-label="Interactive 3D SUV showing PPF coverage">
              <color attach="background" args={['#080c0e']} />
              <fog attach="fog" args={['#080c0e', 10, 18]} />
              <ambientLight intensity={0.8} />
              <directionalLight position={[5, 8, 6]} intensity={3.2} color="#f4ffd0" />
              <directionalLight position={[-6, 3, -5]} intensity={2} color="#5ccfff" />
              <pointLight position={[0, 2, 4]} intensity={6} color="#dfff36" distance={8} />
              <Suspense fallback={null}><SUV tier={tier} /><ContactShadows position={[0, 0.02, 0]} opacity={0.65} scale={11} blur={2.8} far={5} /></Suspense>
              <gridHelper args={[18, 18, '#283237', '#151c1f']} position={[0, 0, 0]} />
              <OrbitControls makeDefault enablePan={false} minDistance={6.5} maxDistance={12} minPolarAngle={0.8} maxPolarAngle={1.48} autoRotate autoRotateSpeed={0.45} />
            </Canvas>
          </div>
          <div className="grid border-t border-line bg-panel lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="grid grid-cols-3" role="group" aria-label="PPF coverage package">
              {Object.keys(packages).map((name) => <button key={name} onClick={() => setTier(name)} aria-pressed={tier === name} className={`border-r border-line px-3 py-5 text-xs font-extrabold uppercase tracking-wider transition sm:px-8 ${tier === name ? 'bg-acid text-ink' : 'text-mist hover:bg-white/5 hover:text-white'}`}>{name}</button>)}
            </div>
            <div className="flex items-center justify-between gap-8 px-6 py-5 lg:min-w-[460px]"><div className="flex items-center gap-4"><span className="grid h-10 w-10 place-items-center rounded-full border border-acid/30 text-acid"><ShieldCheck size={20} /></span><div><p className="text-xs font-bold uppercase tracking-wider">{details.label}</p><p className="mt-1 text-xs text-mist">{details.coverage}</p></div></div><button onClick={() => onBook('PPF')} className="hidden items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-acid transition hover:text-white sm:flex">Book PPF <Box size={15} /></button></div>
          </div>
        </div>
      </div>
    </section>
  )
}
