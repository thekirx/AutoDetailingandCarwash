import { Canvas } from '@react-three/fiber'
import { OrbitControls, RoundedBox } from '@react-three/drei'
import { useState } from 'react'

const packages = {
  Essential: { panels: 2, label: 'High-impact front', copy: 'Bumper, partial hood, and mirror protection.' },
  Signature: { panels: 4, label: 'Full front defense', copy: 'Full hood, fenders, bumper, and mirrors.' },
  Ultimate: { panels: 5, label: 'Complete body coverage', copy: 'Edge-to-edge protection across every painted panel.' },
}

function BodyPanel({ position, size, active }) {
  return <group><RoundedBox position={position} args={size} radius={.18} smoothness={4}><meshStandardMaterial color="#17213b" metalness={.82} roughness={.18}/></RoundedBox>{active && <RoundedBox position={position} args={size.map(v => v * 1.025)} radius={.18} smoothness={4}><meshPhysicalMaterial color="#3d68ff" emissive="#052699" emissiveIntensity={1.4} transparent opacity={.5} depthWrite={false}/></RoundedBox>}</group>
}

function Car({ coverage }) {
  return <group rotation={[0,-.2,0]}>
    <BodyPanel active={coverage >= 1} position={[1.75,.8,0]} size={[1.35,.55,2]}/>
    <BodyPanel active={coverage >= 2} position={[.7,1.12,0]} size={[1.15,.3,1.9]}/>
    <BodyPanel active={coverage >= 3} position={[-.25,1.28,0]} size={[1.05,.8,1.75]}/>
    <BodyPanel active={coverage >= 4} position={[-1.35,.83,0]} size={[1.35,.65,2]}/>
    <BodyPanel active={coverage >= 5} position={[0,.45,0]} size={[4.8,.4,1.85]}/>
    {[[1.4,.22,1],[-1.35,.22,1],[1.4,.22,-1],[-1.35,.22,-1]].map((p,i)=><mesh key={i} position={p} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.42,.42,.24,24]}/><meshStandardMaterial color="#05070c"/></mesh>)}
  </group>
}

export default function PPFVisualizer() {
  const [selected, setSelected] = useState('Signature')
  const data = packages[selected]
  return <section className="visualizer-section" id="visualizer"><div className="public-shell visualizer-grid">
    <div className="visualizer-copy"><p className="eyebrow">Paint protection film</p><h2 className="section-title">See your<br/>coverage in 360°.</h2><p>Drag the vehicle to explore every angle. Switch packages to see exactly where our virtually invisible protection goes.</p><div className="package-tabs">{Object.keys(packages).map(name => <button key={name} onClick={() => setSelected(name)} aria-pressed={selected===name}>{name}</button>)}</div><div className="coverage-note"><span>Selected coverage</span><strong>{data.label}</strong><p>{data.copy}</p></div></div>
    <div className="car-canvas"><span>Drag to rotate · 360°</span><Canvas camera={{position:[6,3.8,6],fov:38}}><ambientLight intensity={1.4}/><directionalLight position={[6,8,5]} intensity={4}/><pointLight position={[-4,3,-4]} color="#315eff" intensity={20}/><Car coverage={data.panels}/><OrbitControls enablePan={false} enableZoom={false} autoRotate autoRotateSpeed={.7}/></Canvas></div>
  </div></section>
}
