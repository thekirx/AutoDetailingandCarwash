import { useState } from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { Link } from 'react-router-dom'

import { getInstallPlatform, getInstallSteps } from '@/lib/installApp'

import './BdAppGuide.css'

import shotBook from '../../../assets/app-guide/book.webp'
import shotCars from '../../../assets/app-guide/cars.webp'
import shotHome from '../../../assets/app-guide/home.webp'
import shotQueue from '../../../assets/app-guide/queue.webp'
import shotSignup from '../../../assets/app-guide/signup.webp'
import shotStamps from '../../../assets/app-guide/stamps.webp'

/* The screens are real captures of the customer app with sample data (Alex,
   ticket D-004), so the walkthrough shows exactly what the customer will see. */
const PLATFORMS = [
  { id: 'ios', label: 'iPhone' },
  { id: 'android', label: 'Android' },
  { id: 'desktop', label: 'Computer' },
]

const STEPS = [
  {
    key: 'install',
    title: 'Put Hakum',
    accent: 'on your phone.',
    body: 'No app store needed. Hakum runs from your browser and sits on your home screen like any other app.',
    shot: shotHome,
  },
  {
    key: 'account',
    title: 'Create your',
    accent: 'account.',
    body: 'Sign up with your mobile number. We ask for your name, your plate and your birthday — that is it.',
    points: ['You stay signed in on this phone until you log out', 'Your birthday unlocks a free service every year'],
    shot: shotSignup,
  },
  {
    key: 'cars',
    title: 'Save your',
    accent: 'cars.',
    body: 'Add every car you bring in, so booking picks the plate for you next time.',
    points: ['Home → My cars → Add a car', 'Plates, conduction stickers and temporary plates all work'],
    shot: shotCars,
  },
  {
    key: 'book',
    title: 'Book a',
    accent: 'service.',
    body: 'Pick the branch, the service and your car, then a day and time. You see the starting price before you send it.',
    points: ['Tap Book on the bottom bar', 'The branch confirms your slot with a text'],
    shot: shotBook,
  },
  {
    key: 'queue',
    title: 'Watch it',
    accent: 'live.',
    body: 'Your ticket moves from Booked to Intake, In progress, Checking, Releasing and Payment as the team works.',
    points: ['Tap Queue on the bottom bar', 'See how busy each branch is before you drive over', 'Turn on alerts and we ping you when it is ready'],
    shot: shotQueue,
  },
  {
    key: 'stamps',
    title: 'Collect',
    accent: 'stamps.',
    body: 'Every visit adds a stamp: a free wash at 10, a free interior detail at 15. Show the reward at any branch.',
    points: ['Home → Loyalty program', 'Your birthday treat shows up here too'],
    shot: shotStamps,
  },
]

function initialPlatform() {
  const detected = getInstallPlatform()
  return detected === 'ios' || detected === 'android' ? detected : 'desktop'
}

/** "Get our app now": a short walkthrough of installing and using the web app. */
export default function BdAppGuide({ className, children }) {
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const [platform, setPlatform] = useState(initialPlatform)
  const step = STEPS[index]
  const last = index === STEPS.length - 1
  const install = getInstallSteps(platform)

  const onOpenChange = (next) => {
    setOpen(next)
    if (next) setIndex(0)
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Trigger className={className}>{children}</DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="hk-guide-backdrop" />
        <DialogPrimitive.Popup className="hk-guide">
          <DialogPrimitive.Close className="hk-guide-close" aria-label="Close guide">
            <X size={18} aria-hidden />
          </DialogPrimitive.Close>

          <div className="hk-guide-copy">
            <div className="hk-guide-progress" aria-hidden="true">
              {STEPS.map((s, i) => (
                <i key={s.key} className={i <= index ? 'is-on' : undefined} />
              ))}
            </div>
            <p className="hk-guide-count">
              Step {index + 1} of {STEPS.length}
            </p>
            <DialogPrimitive.Title className="hk-guide-title">
              {step.title} <em>{step.accent}</em>
            </DialogPrimitive.Title>
            <p className="hk-guide-body">{step.body}</p>

            {step.key === 'install' ? (
              <div className="hk-guide-install">
                <div className="hk-guide-tabs" role="tablist" aria-label="Your device">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      role="tab"
                      aria-selected={platform === p.id}
                      className={platform === p.id ? 'is-on' : undefined}
                      onClick={() => setPlatform(p.id)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <ol>
                  {install.steps.map((text) => (
                    <li key={text}>{text}</li>
                  ))}
                </ol>
                {install.tip ? <p className="hk-guide-tip">{install.tip}</p> : null}
              </div>
            ) : (
              <ul className="hk-guide-points">
                {step.points.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            )}

            <div className="hk-guide-foot">
              {index > 0 ? (
                <button type="button" className="hk-guide-btn" onClick={() => setIndex(index - 1)}>
                  <ArrowLeft size={14} aria-hidden /> Back
                </button>
              ) : (
                <span />
              )}
              {last ? (
                <div className="hk-guide-end">
                  <Link className="hk-guide-btn" to="/signin" onClick={() => setOpen(false)}>
                    Sign in
                  </Link>
                  <Link className="hk-guide-btn is-primary" to="/signup" onClick={() => setOpen(false)}>
                    Create account <ArrowRight size={14} aria-hidden />
                  </Link>
                </div>
              ) : (
                <>
                  <DialogPrimitive.Close className="hk-guide-skip">Skip guide</DialogPrimitive.Close>
                  <button type="button" className="hk-guide-btn is-primary" onClick={() => setIndex(index + 1)}>
                    Next <ArrowRight size={14} aria-hidden />
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="hk-guide-visual" aria-hidden="true">
            <div className="hk-guide-phone">
              <img src={step.shot} alt="" />
            </div>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
