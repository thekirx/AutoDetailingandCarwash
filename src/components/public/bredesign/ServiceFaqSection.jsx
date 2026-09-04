import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

export default function ServiceFaqSection({ serviceId, serviceName, faqs }) {
  const [openIndex, setOpenIndex] = useState(null)

  return (
    <section className="bd-service-faq" data-service-faq={serviceId}>
      <div className="bd-shell bd-service-faq-layout">
        <header>
          <p className="bd-eyebrow">Questions, answered</p>
          <h2>{serviceName}<br /><em>FAQs.</em></h2>
          <p>What to expect before, during, and after your service.</p>
        </header>

        <div className="bd-service-faq-list">
          {faqs.map((faq, index) => {
            const open = index === openIndex
            const answerId = `${serviceId}-faq-${index}`
            return (
              <article key={faq.question} data-open={open ? 'true' : 'false'}>
                <h3>
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={answerId}
                    onClick={() => setOpenIndex(open ? null : index)}
                  >
                    <span>{faq.question}</span>
                    <ChevronDown size={20} aria-hidden="true" />
                  </button>
                </h3>
                <div id={answerId} hidden={!open}>
                  <p>{faq.answer}</p>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
