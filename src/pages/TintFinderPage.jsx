import TintFinder from '../components/public/TintFinder'
import TalkToUsButton from '../components/public/bredesign/TalkToUsButton'

export default function TintFinderPage() {
  return (
    <div className="tf-page">
      <TintFinder standalone />
      <TalkToUsButton />
    </div>
  )
}
