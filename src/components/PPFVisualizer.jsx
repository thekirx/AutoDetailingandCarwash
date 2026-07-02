import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import { ArrowRight } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as THREE from 'three'
import { PPF_PACKAGES } from '../data/ppfPackages'

const PPF_HIGHLIGHT_COLOR = '#CCFF00'
const PPF_HIGHLIGHT_OPACITY = {
  basic: .35,
  premium: .35,
  platinum: .45,
}
const PPF_COLORS = {
  basic: { color:PPF_HIGHLIGHT_COLOR, emissive:PPF_HIGHLIGHT_COLOR, opacity:PPF_HIGHLIGHT_OPACITY.basic, selectedOpacity:.47, label:'7.5 MIL protected area' },
  premium: { color:PPF_HIGHLIGHT_COLOR, emissive:PPF_HIGHLIGHT_COLOR, opacity:PPF_HIGHLIGHT_OPACITY.premium, selectedOpacity:.47, label:'7.5 MIL protected area' },
  platinum: { color:PPF_HIGHLIGHT_COLOR, emissive:PPF_HIGHLIGHT_COLOR, opacity:PPF_HIGHLIGHT_OPACITY.platinum, selectedOpacity:.57, label:'8.5 MIL enhanced defense' },
}
const BASIC_HOOD_SURFACE = [.56,.88,-.72, 1.76,.76,-.62, 1.76,.76,.62, .56,.88,.72]
const BASIC_DOOR_SURFACES = {
  left: [-.82,.47,.872, .72,.47,.872, .62,.82,.862, -.68,.82,.862],
  right: [.72,.47,-.872, -.82,.47,-.872, -.68,.82,-.862, .62,.82,-.862],
}
const BASIC_LIGHT_SURFACES = {
  headlightLeft: [1.925,.72,.38, 1.925,.72,.72, 1.9,.88,.68, 1.9,.88,.4],
  headlightRight: [1.925,.72,-.72, 1.925,.72,-.38, 1.9,.88,-.4, 1.9,.88,-.68],
  taillightLeft: [-1.925,.7,.38, -1.925,.7,.7, -1.905,.86,.68, -1.905,.86,.4],
  taillightRight: [-1.925,.7,-.7, -1.925,.7,-.38, -1.905,.86,-.4, -1.905,.86,-.68],
}

function getCoverageState(packageData) {
  const areas = new Set(packageData.coverageAreas.map(area => area.toLowerCase()))
  const fullBody = areas.has('full exterior')
  return {
    fullBody,
    hood: fullBody || areas.has('hood'), doors: fullBody || areas.has('all four doors'),
    headlights: fullBody || areas.has('headlights'), taillights: fullBody || areas.has('taillights'),
    bumpers: fullBody || areas.has('front bumper') || areas.has('rear bumper'),
    roof: fullBody || areas.has('roof'), trunk: fullBody || areas.has('trunk'),
    mirrors: fullBody || areas.has('side mirrors'), fenders: fullBody || areas.has('fenders'),
    trims: fullBody || areas.has('trims'), quarterPanels: fullBody || areas.has('quarter panels'),
    rockerPanels: areas.has('rocker panels'),
    packageId: packageData.id,
    emphasis: packageData.id === 'platinum' ? 'heavy' : 'standard',
  }
}

function CarModel(props) {
  const { scene } = useGLTF('/models/Mazda RX-7.glb')
  return <group {...props}><primitive object={scene} rotation={[0,Math.PI/2,0]} castShadow receiveShadow/></group>
}

useGLTF.preload('/models/Mazda RX-7.glb')

function HighlightMaterial({ materialRef, hovered, packageId }) {
  const palette = PPF_COLORS[packageId]
  useFrame(({ clock }, delta) => {
    if (!materialRef.current) return
    const pulse = Math.sin(clock.elapsedTime * 2.2) * .025
    const opacity = hovered ? palette.selectedOpacity : palette.opacity
    materialRef.current.opacity += (opacity - materialRef.current.opacity) * Math.min(delta * 7, 1)
    const glow = hovered ? .85 : .55 + pulse
    materialRef.current.emissiveIntensity += (glow - materialRef.current.emissiveIntensity) * Math.min(delta * 7, 1)
  })
  return <meshStandardMaterial ref={materialRef} color={palette.color} emissive={palette.emissive} emissiveIntensity={.55} roughness={.18} metalness={.05} side={THREE.DoubleSide} transparent opacity={0} depthWrite={false} polygonOffset polygonOffsetFactor={-2}/>
}

function SurfaceFilm({ label, description, vertices, packageId, onInspect }) {
  const material = useRef(null)
  const [hovered,setHovered] = useState(false)
  const geometry = useMemo(() => {
    const value = new THREE.BufferGeometry()
    value.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3))
    value.setIndex([0,1,2,0,2,3])
    value.computeVertexNormals()
    return value
  }, [vertices])
  useEffect(() => () => geometry.dispose(), [geometry])
  const inspect = (event) => {
    event.stopPropagation()
    setHovered(true)
    onInspect({ label, description })
  }
  const clearInspect = () => { setHovered(false); onInspect(null) }
  return <mesh geometry={geometry} renderOrder={10} onPointerOver={inspect} onPointerOut={clearInspect} onClick={inspect}>
    <HighlightMaterial materialRef={material} hovered={hovered} packageId={packageId}/>
  </mesh>
}

function FullBodyFilm({ packageId, onInspect }) {
  const { scene } = useGLTF('/models/Mazda RX-7.glb')
  const isHeavy = packageId === 'platinum'
  const palette = PPF_COLORS[packageId]
  const [hovered,setHovered] = useState(false)
  const material = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: palette.color, emissive: palette.emissive,
    emissiveIntensity: .55, roughness: .18, metalness: .05,
    transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
  }), [palette])
  const outlineMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: palette.color, transparent: true, opacity: 0,
    depthWrite: false, side: THREE.BackSide,
  }), [palette])
  const filmScene = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse(child => {
      if (!child.isMesh) return
      const excluded = /wheel|logo|exhaust/i.test(child.name)
      child.visible = !excluded
      if (!excluded) child.material = material
    })
    return clone
  }, [scene, material])
  const outlineScene = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse(child => {
      if (!child.isMesh) return
      const excluded = /wheel|logo|exhaust/i.test(child.name)
      child.visible = !excluded
      if (!excluded) {
        child.material = outlineMaterial
        child.raycast = () => {}
      }
    })
    return clone
  }, [scene, outlineMaterial])
  useEffect(() => () => { material.dispose(); outlineMaterial.dispose() }, [material, outlineMaterial])
  useFrame(({ clock }, delta) => {
    const pulse = Math.sin(clock.elapsedTime * 1.8) * .025
    const target = hovered ? palette.selectedOpacity : palette.opacity
    material.opacity += (target - material.opacity) * Math.min(delta * 5, 1)
    const glow = hovered ? .85 : .55 + pulse
    material.emissiveIntensity += (glow - material.emissiveIntensity) * Math.min(delta * 5, 1)
    const outlineTarget = hovered ? .48 : (isHeavy ? .32 : .22) + pulse
    outlineMaterial.opacity += (outlineTarget - outlineMaterial.opacity) * Math.min(delta * 5, 1)
  })
  const inspect = (event) => {
    event.stopPropagation()
    setHovered(true)
    onInspect({ label: 'Full exterior', description: 'A thin, virtually invisible film layer follows the vehicle surface for complete exterior protection.' })
  }
  const clearInspect = () => { setHovered(false); onInspect(null) }
  return <group>
    <primitive object={outlineScene} rotation={[0,Math.PI/2,0]} scale={1.012} renderOrder={1}/>
    <primitive object={filmScene} rotation={[0,Math.PI/2,0]} scale={1.003} renderOrder={2} onPointerOver={inspect} onPointerOut={clearInspect} onClick={inspect}/>
  </group>
}

function Car({ coverage, onInspect }) {
  const panel = { packageId: coverage.packageId, onInspect }
  return <group rotation={[0,-.2,0]}>
    <CarModel/>
    {coverage.fullBody ? <FullBodyFilm {...panel}/> : <>
      <SurfaceFilm {...panel} label="Hood" description="A primary impact zone protected from stone chips, bug acids, and road wear." vertices={BASIC_HOOD_SURFACE}/>
      {[1,-1].map(side => <SurfaceFilm key={`doors-${side}`} {...panel} label="All four doors" description="Door skin coverage helps prevent scratches, chips, and everyday contact marks." vertices={side > 0 ? BASIC_DOOR_SURFACES.left : BASIC_DOOR_SURFACES.right}/>) }
      <SurfaceFilm {...panel} label="Headlights" description="Clear film helps protect this lighting surface from chips, staining, and daily road wear." vertices={BASIC_LIGHT_SURFACES.headlightLeft}/>
      <SurfaceFilm {...panel} label="Headlights" description="Clear film helps protect this lighting surface from chips, staining, and daily road wear." vertices={BASIC_LIGHT_SURFACES.headlightRight}/>
      <SurfaceFilm {...panel} label="Taillights" description="Clear film helps protect this lighting surface from chips, staining, and daily road wear." vertices={BASIC_LIGHT_SURFACES.taillightLeft}/>
      <SurfaceFilm {...panel} label="Taillights" description="Clear film helps protect this lighting surface from chips, staining, and daily road wear." vertices={BASIC_LIGHT_SURFACES.taillightRight}/>
    </>}
  </group>
}

export default function PPFVisualizer() {
  const [selected,setSelected] = useState('premium')
  const [inspected,setInspected] = useState(null)
  const data = PPF_PACKAGES.find(item => item.id === selected) ?? PPF_PACKAGES[0]
  const coverage = getCoverageState(data)
  const filmThicknessValue = data.id === 'platinum' ? '8.5 MIL' : '7.5 MIL'
  const visibleCoverageAreas = data.id === 'basic'
    ? data.coverageAreas
    : data.coverageAreas.filter(area => ['Full exterior','Trims','Headlights','All four doors','Roof','Rocker panels','Additional high-impact areas where applicable'].includes(area))
  const selectPackage = (id) => { setSelected(id); setInspected(null) }

  return <section className="visualizer-section" id="visualizer" aria-labelledby="ppf-heading"><div className="public-shell">
    <header className="ppf-heading"><div><p className="eyebrow eyebrow-light">Invisible armor · Visible confidence</p><h2 className="section-title light" id="ppf-heading">Paint Protection<br/>Film Packages</h2></div><p>Paint Protection Film is an invisible, clear layer applied to your vehicle’s paint to protect it from damage. Think of it like a mobile phone screen protector, but for your car’s exterior.</p></header>
    <div className="package-tabs" role="tablist" aria-label="Paint protection film packages">{PPF_PACKAGES.map((item,index) => <button key={item.id} id={`ppf-tab-${item.id}`} role="tab" aria-selected={selected===item.id} aria-controls="ppf-package-panel" onClick={() => selectPackage(item.id)}><span>0{index+1}</span>{item.title}{item.recommendedLabel && <small>{item.recommendedLabel}</small>}</button>)}</div>
    <div className="visualizer-grid">
      <div className="car-canvas">
        <div className="ppf-canvas-label"><span>Interactive coverage view</span><strong>{data.title}</strong></div><span>Drag to rotate · Select a panel</span>
        <div className="ppf-canvas-stage"><Canvas camera={{position:[6,3.8,6],fov:38}} onPointerMissed={() => setInspected(null)}><ambientLight intensity={1.4}/><directionalLight position={[6,8,5]} intensity={4}/><pointLight position={[-4,3,-4]} color="#315eff" intensity={coverage.emphasis==='heavy'?30:20}/><Car coverage={coverage} onInspect={setInspected}/><OrbitControls enablePan={false} enableZoom={false} autoRotate autoRotateSpeed={.7}/></Canvas></div>
        <div className={`ppf-mobile-diagram ${coverage.fullBody?'is-full':''} ${coverage.emphasis==='heavy'?'is-heavy':''}`} aria-label={`${data.title} coverage diagram`}><div className="ppf-diagram-car"><i className="hood"/><i className="roof"/><i className="doors"/><i className="rear"/><b>360°</b></div><p>{data.coverageType}<small>{data.coverageAreas.join(' · ')}</small></p></div>
        {inspected && <div className="ppf-panel-tooltip" role="status"><span>Coverage area</span><strong>{inspected.label}</strong><p>{inspected.description}</p></div>}
        <div className={`ppf-coverage-legend is-${data.id}`}><span><i/> {PPF_COLORS[data.id].label}</span><span><i className="ppf-legend-base"/> Vehicle surface</span></div>
        <p className="ppf-model-attribution">Mazda RX-7 by IvOfficial [CC-BY] via Poly Pizza</p>
      </div>
      <article className="ppf-package-panel" id="ppf-package-panel" role="tabpanel" aria-labelledby={`ppf-tab-${selected}`}>
        <div className="ppf-panel-head"><div><p>Selected package</p><h3>{data.title} Package</h3><span>{data.subtitle}</span></div></div>
        <div className={`film-thickness-card ${data.id==='platinum'?'is-heavy':''}`}><span className="film-thickness-value">{filmThicknessValue}</span><span className="film-thickness-label">Premium-grade PPF</span></div>
        <div className="ppf-detail-block"><h4>Coverage</h4><p>{data.shortDescription}</p><div className="ppf-tags">{visibleCoverageAreas.map(area => <span key={area}>{area}</span>)}</div></div>
        <Link className="ppf-book-button" to="/book" state={{service:'Paint Protection Film',package:data.title,packageId:data.id,coverageType:data.coverageType,filmThickness:data.filmThickness}}>{data.ctaLabel} <ArrowRight size={18}/></Link>
      </article>
    </div>
  </div></section>
}
