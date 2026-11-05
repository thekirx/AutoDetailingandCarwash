import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Award, Sparkles, ArrowRight } from 'lucide-react'
import { MEMBER_TIERS, SERVICE_POINTS, VISIT_REWARDS } from '@/lib/rewardsCatalog'
import BdAppGuide from './BdAppGuide'
import './BdRewards.css'

export default function BdRewards() {
  const [activeTab, setActiveTab] = useState('milestones') // 'milestones' | 'tiers' | 'points'

  return (
    <section className="bd-rewards" id="rewards">
      <div className="bd-shell">
        <div className="bd-rewards-head bd-reveal">
          <p className="bd-eyebrow">Hakum Rewards &amp; Loyalty</p>
          <h2 className="bd-skew">
            Perks on <em>every visit.</em>
          </h2>
          <p>
            Taking care of your car never gets this exciting. Accumulate points across services and detailing,
            unlock free visit milestones regardless of which vehicle you bring, and use points for Hakum merch in the Hakum app.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="bd-rewards-tabs bd-reveal">
          <button
            type="button"
            className={`bd-rewards-tab-btn ${activeTab === 'milestones' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('milestones')}
          >
            Visit Rewards
          </button>
          <button
            type="button"
            className={`bd-rewards-tab-btn ${activeTab === 'tiers' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('tiers')}
          >
            Member Tiers
          </button>
          <button
            type="button"
            className={`bd-rewards-tab-btn ${activeTab === 'points' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('points')}
          >
            Points Table
          </button>

        </div>

        {/* TAB 1: Visit Rewards (Every Nth visit, regardless of car used) */}
        {activeTab === 'milestones' && (
          <div className="bd-milestones-track bd-reveal">
            {VISIT_REWARDS.map((item) => (
              <div key={item.visit} className="bd-milestone-step">
                <div className="bd-milestone-head">
                  <span className="bd-milestone-visit">Visit #{item.visit}</span>
                  <span className="bd-milestone-badge">Milestone</span>
                </div>
                <div className="bd-milestone-reward">{item.label}</div>
                <p className="bd-milestone-note">Regardless if different cars used</p>
              </div>
            ))}
          </div>
        )}

        {/* TAB 2: Membership Tiers (Customer Category) */}
        {activeTab === 'tiers' && (
          <div className="bd-tiers-grid bd-reveal">
            {MEMBER_TIERS.map((tier) => (
              <div
                key={tier.name}
                className={`bd-tier-card ${tier.badge === 'Platinum' ? 'is-platinum' : ''}`}
              >
                <span className="bd-tier-badge">{tier.badge} Tier</span>
                <div className="bd-tier-name">{tier.name}</div>
                <div className="bd-tier-visits">{tier.visits}</div>
                <p className="bd-tier-desc">{tier.description}</p>
              </div>
            ))}
          </div>
        )}

        {/* TAB 3: Points Accumulation (Carwash & Detailing) */}
        {activeTab === 'points' && (
          <div className="bd-points-table-grid bd-reveal">
            {/* Wash Services & Maintenance */}
            <div className="bd-points-box">
              <div className="bd-points-box-title">
                <span>Wash &amp; Maintenance</span>
                <Sparkles size={16} className="text-primary" />
              </div>
              {SERVICE_POINTS.slice(0, 11).map((item) => (
                <div key={item.name} className="bd-points-row">
                  <span className="bd-points-label">{item.name}</span>
                  <span className="bd-points-value">+{item.points} pts</span>
                </div>
              ))}
            </div>

            {/* Ceramic, Tint & PPF Detailing */}
            <div className="bd-points-box">
              <div className="bd-points-box-title">
                <span>Detailing, Tint &amp; PPF</span>
                <Award size={16} className="text-primary" />
              </div>
              {SERVICE_POINTS.slice(11).map((item) => (
                <div key={item.name} className="bd-points-row">
                  <span className="bd-points-label">{item.name}</span>
                  <span className="bd-points-value">+{item.points} pts</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bd-rewards-footer bd-reveal">
          <p>Use your points for Hakum merch in the Hakum app.</p>
          <BdAppGuide className="bd-btn bd-btn-quiet">Get the app <ArrowRight size={16} /></BdAppGuide>
        </div>

        {/* Footer Call to Action */}
        <div className="bd-rewards-footer bd-reveal">
          <div className="bd-rewards-footer-copy">
            <h3>Start earning stamps &amp; rewards today</h3>
            <p>Sign up online or install the Hakum Customer App to track points and claim perks seamlessly.</p>
          </div>
          <div className="bd-cta-row">
            <Link to="/signup" className="bd-btn bd-btn-primary">
              Create an account <ArrowRight size={16} />
            </Link>
            <Link to="/account/loyalty" className="bd-btn bd-btn-quiet">
              View your rewards
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
