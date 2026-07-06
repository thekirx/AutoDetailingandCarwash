import { useState } from 'react'
import { ArrowRight, ShieldCheck, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import PinnedCarVisual from './PinnedCarVisual'
import { packageOptions, storyStages } from './scrollStoryData'
import { usePinnedCarStory } from './usePinnedCarStory'

const ppfPackages = ['Basic', 'Premium', 'Platinum']

export default function PinnedCarStory() {
  const [previewState, setPreviewState] = useState('washed')
  const { storyRef } = usePinnedCarStory()

  return <section className="pinned-car-story" ref={storyRef} aria-labelledby="car-story-title">
    <div className="story-scroll-track">
      <div className="story-pin-stage" data-pin-stage>
        <div className="public-shell story-stage-shell">
          <div className="story-heading">
            <p className="eyebrow eyebrow-light">The Hakum treatment · Scroll to transform</p>
            <h2 className="section-title light" id="car-story-title">From road-worn<br/>to remarkable.</h2>
          </div>

          <PinnedCarVisual previewState="dirty" />

          <div className="story-copy-stack">
            {storyStages.map((stage) => <article className="story-copy" data-story-stage={stage.id} key={stage.id}>
              <span>{stage.number} / {stage.label}</span>
              <h3>{stage.label}</h3>
              <p>{stage.copy}</p>
              {stage.id === 'detailing' && <div className="story-detail-insets" aria-label="Detailing focus areas">
                <small>Paint correction</small><small>Interior restoration</small><small>Wheel finish</small>
              </div>}
              {stage.id === 'ppf' && <div className="story-ppf-packages" aria-label="PPF package levels">
                {ppfPackages.map((name) => <small key={name}><ShieldCheck/> {name}</small>)}
              </div>}
              {stage.id === 'ceramic' && <div className="story-gloss-meter"><span>Gloss meter</span><b><i/></b></div>}
            </article>)}
          </div>

          <ol className="story-progress" aria-label="Treatment progress">
            {storyStages.map((stage) => <li data-progress-stage={stage.id} key={stage.id}><span>{stage.number}</span>{stage.label}</li>)}
          </ol>
        </div>
      </div>
    </div>

    <div className="story-package-selector public-shell">
      <div className="story-package-heading">
        <div><p className="eyebrow eyebrow-light">Choose your treatment</p><h2 className="section-title light">Find your<br/>finish.</h2></div>
        <p>Preview the finish that matches how you drive, maintain, and protect your vehicle.</p>
      </div>
      <div className="story-package-layout">
        <div className="story-package-options">
          {packageOptions.map((option, index) => <button
            aria-label={`Preview ${option.label} package`}
            aria-pressed={previewState === option.state}
            key={option.id}
            onClick={() => setPreviewState(option.state)}
            onFocus={() => setPreviewState(option.state)}
            onPointerEnter={() => setPreviewState(option.state)}
            type="button"
          >
            <span>0{index + 1}</span><strong>{option.label}</strong><small>{option.bestFor}</small><ArrowRight/>
          </button>)}
        </div>
        <div className="story-package-preview">
          <PinnedCarVisual previewState={previewState} packagePreview />
          <div><Sparkles/><span>{packageOptions.find((item) => item.state === previewState)?.bestFor}</span></div>
        </div>
      </div>
      <div className="story-package-actions">
        <Link to="/packages">View all packages <ArrowRight/></Link>
        <Link to="/book">Book a service <ArrowRight/></Link>
      </div>
    </div>
  </section>
}
