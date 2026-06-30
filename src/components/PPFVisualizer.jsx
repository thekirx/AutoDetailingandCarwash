import { Canvas } from '@react-three/fiber'
import { OrbitControls, RoundedBox } from '@react-three/drei'
import { useState } from 'react'

function Panel({ position, size, tier, basic = false }) {
  const protectedPanel = tier !== 'Basic' || basic

  return (
    <group>
      <RoundedBox position={position} args={size}>
        <meshStandardMaterial color="#252d31" metalness={0.7} roughness={0.2} />
      </RoundedBox>

      {protectedPanel && (
        <RoundedBox
          position={position}
          args={size.map((value) =>
            value * (tier === 'Platinum' ? 1.055 : 1.025)
          )}
        >
          <meshPhysicalMaterial
            color={tier === 'Platinum' ? '#dfff20' : '#39d6ff'}
            emissive={tier === 'Platinum' ? '#dfff20' : '#39d6ff'}
            emissiveIntensity={tier === 'Platinum' ? 1.1 : 0.4}
            transparent
            opacity={tier === 'Platinum' ? 0.48 : 0.25}
            depthWrite={false}
          />
        </RoundedBox>
      )}
    </group>
  )
}

function SUV({ tier }) {
  return (
    <group>
      <Panel tier={tier} basic position={[1, 1.3, 0]} size={[2, .35, 1.8]} />
      <Panel tier={tier} basic position={[0, 1.2, 1]} size={[1.2, 1, .1]} />
      <Panel tier={tier} basic position={[0, 1.2, -1]} size={[1.2, 1, .1]} />
      <Panel tier={tier} position={[-1, 1.8, 0]} size={[2.4, .3, 1.7]} />
      <Panel tier={tier} position={[0, .8, 0]} size={[5.4, .8, 2]} />
    </group>
  )
}

export default function PPFVisualizer() {
  const [tier, setTier] = useState('Basic')

  return (
    <section id="visualizer" className="border-b border-white/8 py-20">
      <div className="mx-auto mb-8 max-w-7xl px-5 text-center">
        <h2 className="text-3xl font-bold">360° PPF Protection Visualizer</h2>
        <p className="mt-2 text-slate-400">See how our different tiers cover your vehicle.</p>
      </div>
      <div className="mx-auto h-[560px] max-w-5xl cursor-move overflow-hidden rounded-2xl border border-white/10 bg-[#0b1016]">
        <Canvas camera={{ position: [7, 4, 7] }}>
          <ambientLight intensity={1} />
          <directionalLight position={[5, 8, 5]} intensity={3} />
          <SUV tier={tier} />
          <OrbitControls enablePan={false} />
        </Canvas>
      </div>

      <div className="mt-8 flex justify-center gap-3">
        {['Basic', 'Premium', 'Platinum'].map((name) => (
          <button
            key={name}
            aria-pressed={tier === name}
            onClick={() => setTier(name)}
            className={`rounded-full px-6 py-2 font-semibold transition ${tier === name ? 'bg-lime-400 text-black' : 'border border-white/10 bg-[#10161e] text-slate-300 hover:bg-white/5'}`}
          >
            {name}
          </button>
        ))}
      </div>
    </section>
  )
}
