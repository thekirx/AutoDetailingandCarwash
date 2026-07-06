import { scrollStoryAssets } from './scrollStoryAssets'

const vehicleDescription = 'A vehicle transforms from road-worn to washed, detailed, paint-protected, and ceramic-coated.'

export default function PinnedCarVisual({ previewState, packagePreview = false }) {
  return <div className={`story-car-visual ${packagePreview ? 'is-package-preview' : ''}`} data-testid={packagePreview ? 'package-preview' : undefined} data-state={previewState}>
    <span className="visually-hidden">{vehicleDescription}</span>
    <div className="story-car-stack" data-car-stack aria-hidden="true">
      {Object.entries(scrollStoryAssets.vehicle).map(([state, src]) => <img
        className={`story-car-image story-car-${state}`}
        data-car-state={state}
        key={state}
        src={src}
        alt=""
        loading={state === 'dirty' ? 'eager' : 'lazy'}
        decoding="async"
      />)}
      <div className="story-headlights"><i/><i/></div>
      <div className="story-mist" />
      <div className="story-water-sweep" />
      <div className="story-foam" />
      <div className="story-swirl" />
      <div className="story-ppf-coverage">
        <i className="story-ppf-panel ppf-hood"/>
        <i className="story-ppf-panel ppf-bumper"/>
        <i className="story-ppf-panel ppf-mirror"/>
        <i className="story-ppf-panel ppf-doors"/>
      </div>
      <div className="story-gloss-sweep" />
      <div className="story-droplets"><i/><i/><i/><i/><i/><i/></div>
    </div>
  </div>
}
