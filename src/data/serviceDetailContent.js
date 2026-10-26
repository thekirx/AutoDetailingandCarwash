const proofClip = (service, id, label, caption) => ({
  id,
  label,
  caption,
  poster: `/video/service-proof/${service}/${id}-poster.webp`,
  sources: {
    av1: `/video/service-proof/${service}/${id}.av1.mp4`,
    h264: `/video/service-proof/${service}/${id}.h264.mp4`,
  },
})

export const SERVICE_DETAIL_CONTENT = {
  'wash-detailing': {
    serviceName: 'Premium Wash & Detailing',
    bookState: { service: 'Premium Wash & Detailing' },
    faqs: [
      { question: 'Do I need to book a premium car wash?', answer: 'Premium car wash and selected cleaning services are available as walk-in services. Check the live queue before heading to your preferred branch.' },
      { question: 'Which services need an assessment?', answer: 'Protective treatments and restoration work, including glass coating and headlight restoration, may need a quick vehicle assessment before the team confirms timing and price.' },
      { question: 'Can I combine wash and detailing services?', answer: 'Yes. The team can recommend a practical combination based on your vehicle’s condition and the result you want.' },
      { question: 'How long will the service take?', answer: 'Timing varies by vehicle size, condition, selected service, and the branch queue. The live queue gives you the best view of current demand.' },
    ],
  },
  ppf: {
    serviceName: 'Paint Protection Film',
    bookState: { service: 'Paint Protection Film' },
    faqs: [
      {
        question: 'Why choose ClearPro PPF at Hakum Auto Care?',
        answer: 'ClearPro combines Polyoptico™ coating for a smooth, glossy finish, Invisiglue™ adhesive designed to prevent visible glue lines, and non-yellowing optical TPU for lasting clarity. Ask the Hakum team which ClearPro film suits your vehicle and the finish you want.',
      },
      {
        question: 'Will PPF change how my car looks?',
        answer: 'Clear ClearPro PPF is virtually invisible and designed to preserve the appearance of your original paint. ClearPro lists 95 GU gloss at 60° for selected gloss films; specifications vary by film. Its range also includes UltraSatin, Cosmoblack, and Carbon Fiber Black finishes. Ask Hakum about local availability before choosing a finish.',
      },
      {
        question: 'What does PPF protect my car from?',
        answer: 'PPF adds a protective barrier against rock chips, road debris, light scratches, and everyday surface damage. It cannot prevent every impact or deep cut. ClearPro also makes specialty films for headlamps, windshields, and skylights; ask the team about availability and suitability for your vehicle.',
      },
      {
        question: 'Does ClearPro film heal its own scratches?',
        answer: 'ClearPro PPF has self-healing properties designed to reduce the appearance of light scratches and swirl marks with heat or sunlight. Deep scratches, cuts, and impact damage may require professional assessment or replacement of the affected film.',
      },
      {
        question: 'Will PPF make my car easier to clean?',
        answer: 'Yes. ClearPro PPF has hydrophobic properties that help water, dirt, and grime release more easily during routine cleaning. ClearPro reports a 105° contact angle for selected films; performance varies by product. Regular gentle washing is still needed.',
      },
      {
        question: 'Will PPF damage my paint, and can it be removed later?',
        answer: 'ClearPro PPF is designed to protect original vehicle paint, with adhesive designed for residue-free removal under appropriate conditions. Have the film professionally removed, and disclose repaired or repainted panels before installation so the team can assess the paint condition and removal risks.',
      },
      {
        question: 'What warranty comes with ClearPro PPF?',
        answer: 'Warranty duration depends on the film selected; ask Hakum to confirm the applicable manufacturer terms before installation. ClearPro lists cracking, yellowing, discoloration, peeling, delamination, degumming, and bubbling as eligible claim types, subject to its conditions and exclusions. Retain your installation invoice and completed warranty record as proof of purchase.',
      },
      {
        question: 'How do I care for PPF after installation?',
        answer: 'Wait at least three days before washing, and follow the installer’s product-specific aftercare instructions. Then wash gently by hand with suitable soap, water, and microfiber towels. Avoid automatic car washes and never direct high-pressure water at film edges.',
      },
    ],
    proof: {
      eyebrow: 'Hakum installation proof',
      title: 'Protection, installed—not simulated.',
      copy: 'Real PPF work from our team, showing preparation, installation, owner feedback, and finished vehicles.',
      clips: [
        { ...proofClip('ppf', 'fortuner', 'Hakum full-body PPF installation on a Toyota Fortuner', 'Toyota Fortuner · Full-body PPF installation'), homepageFeatured: true },
        proofClip('ppf', 'hilux', 'Hakum full-body PPF installation on a Toyota Hilux', 'Toyota Hilux · Full-body PPF installation'),
        proofClip('ppf', 'sorento', 'Hakum full-body PPF installation on a Kia Sorento', 'Kia Sorento · Full-body PPF installation'),
        proofClip('ppf', 'full-body-install', 'Hakum full-body Paint Protection Film preparation and installation', 'Full-body PPF · Preparation and installation'),
        proofClip('ppf', 'panel-install', 'Hakum technician applying Paint Protection Film to a vehicle panel', 'PPF installation · Hands-on application'),
        proofClip('ppf', 'civic-feedback', 'Civic Type R owner feedback after Hakum Paint Protection Film service', 'Civic Type R · Owner feedback'),
        proofClip('ppf', 'mini-cooper', 'Hakum Paint Protection Film installation on a green Mini Cooper', 'Mini Cooper · PPF installation'),
        proofClip('ppf', 'santa-fe', 'Hakum full-body Paint Protection Film installation on a Hyundai Santa Fe', 'Hyundai Santa Fe · Full-body PPF installation'),
        proofClip('ppf', 'toyota-cross', 'Hakum Paint Protection Film installation on a red Toyota Corolla Cross', 'Toyota Corolla Cross · PPF installation'),
        proofClip('ppf', 'white-hilux-install', 'Hakum Paint Protection Film installation on a white Toyota Hilux', 'Toyota Hilux · PPF installation'),
        proofClip('ppf', 'black-vehicle-install', 'Hakum technician installing Paint Protection Film on a black vehicle', 'Black vehicle · PPF installation'),
        proofClip('ppf', 'xpander-cross', 'Hakum Paint Protection Film installation on a white Mitsubishi Xpander Cross', 'Mitsubishi Xpander Cross · PPF installation'),
      ],
    },
  },
  ceramic: {
    serviceName: 'Ceramic Coating',
    bookState: { service: 'Ceramic Coating' },
    packageHighlights: {
      premium: 'Unlimited Recoating',
      platinum: 'Unlimited Recoating',
    },
    faqs: [
      {
        question: 'What does Ceramic Coating do?',
        answer: 'Ceramic Coating adds a durable hydrophobic layer that deepens gloss and makes routine washing easier by reducing how strongly water and grime cling to the surface.',
      },
      {
        question: 'Does Ceramic Coating remove scratches?',
        answer: 'No. Paint correction is what reduces visible swirls and defects before application. The coating preserves the prepared finish but does not repair damage underneath it.',
      },
      {
        question: 'Will I still need to wash a coated vehicle?',
        answer: 'Yes. The surface usually releases dirt more easily, but regular safe washing is still necessary to preserve gloss and hydrophobic performance.',
      },
      {
        question: 'How long must the coating cure?',
        answer: 'Initial curing depends on the product, weather, and application conditions. The Hakum team will give you the correct first-wash and exposure instructions when your vehicle is released.',
      },
      {
        question: 'What does Unlimited Recoating mean for my package?',
        answer:
          'Most shops promise protection — but when it comes to how long that protection actually holds up, most fall short of what is advertised. This is true no matter which brand of ceramic coating is used. At Hakum, we promise protection and we deliver on it — with our Unlimited Ceramic Coating Reboost, absolutely free. That means when your coating\u2019s effectiveness starts to degrade, we add an additional layer, absolutely free. The risk is on us, because we trust our products.',
      },
      {
        question: 'Which Ceramic package should I choose?',
        answer: 'Premium suits drivers looking for strong long-term gloss and easier upkeep. Platinum is the higher-tier option for the longest listed protection period and maximum finish depth.',
      },
    ],
    proof: {
      eyebrow: 'Hakum coating proof',
      title: 'A finish that stays showroom ready.',
      copy: 'Real Ceramic Coating work across different finishes, captured during preparation, application, and final inspection.',
      clips: [
        { ...proofClip('ceramic', 'honda-city', 'Hakum Ceramic Coating preparation and finish on a Honda City', 'Honda City · Coating preparation and finish'), homepageFeatured: true },
        proofClip('ceramic', 'byd-emax6', 'Hakum Ceramic Coating application on a BYD eMAX 6', 'BYD eMAX 6 · Coating application'),
        proofClip('ceramic', 'crv', 'Hakum Ceramic Coating preparation and finish on a Honda CR-V', 'Honda CR-V · Coating preparation and finish'),
        proofClip('ceramic', 'veloz', 'Hakum Ceramic Coating application and finish on a Toyota Veloz', 'Toyota Veloz · Application and finish'),
        proofClip('ceramic', 'vios', 'Hakum Ceramic Coating application and finish on a Toyota Vios', 'Toyota Vios · Application and finish'),
        proofClip('ceramic', 'nissan', 'Hakum Ceramic Coating application and gloss finish on a Nissan', 'Nissan · Application and gloss finish'),
        proofClip('ceramic', 'tesla', 'Hakum Ceramic Coating application and finish on a Tesla', 'Tesla · Application and finish'),
        proofClip('ceramic', 'mg', 'Hakum Ceramic Coating polish and application on an MG', 'MG · Polish and coating application'),
        /* Not every coated vehicle is a car: the same coating goes on a
           scooter, and the clip is the only one on the page that shows it. */
        proofClip('ceramic', 'vespa', 'Hakum Ceramic Coating applied to a Vespa scooter', 'Vespa · Ceramic coating'),
      ],
    },
  },
  tint: {
    serviceName: 'Nano Ceramic Tint',
    bookState: { service: 'Nano Ceramic Tint' },
    faqs: [
      {
        question: 'What makes ClearPro ceramic tint better than regular tint?',
        answer: 'ClearPro uses nano-ceramic technology to reduce heat while maintaining visual clarity. The manufacturer describes a Class 1000 dust-free coating workshop and lists ISO 9001, ISO 14001, and ISO 45001 certifications. Choose a film based on its specifications and your driving needs.',
      },
      {
        question: 'Is ClearPro tint certified by the Skin Cancer Foundation?',
        answer: 'Specific ClearPro films carry the Skin Cancer Foundation’s Seal of Recommendation, including Nano Ceramic Series HC70 NANO, HC55 NANO, HC45 NANO, HC35 NANO, HC25 NANO, HC15 NANO, and HC05 NANO. This does not cover every ClearPro film. ClearPro reports over 99% UVA and UVB rejection for its window films; confirm the specifications and recommendation status of the exact film you select.',
      },
      {
        question: 'How much cooler will my car be?',
        answer: 'ClearPro ceramic tint is designed to reduce infrared heat entering the vehicle, helping cabin comfort and reducing cooling demand on the air-conditioning system. Results depend on the film, glass, weather, and driving conditions, so a specific temperature reduction cannot be guaranteed.',
      },
      {
        question: 'Will I still see clearly during the day and night?',
        answer: 'ClearPro offers different visible light transmission levels. Choose a shade that balances privacy, heat rejection, glare reduction, and daytime and nighttime visibility. Darker shades let in less visible light and can reduce nighttime visibility. Ask the team to show available options before installation.',
      },
      {
        question: 'Will ceramic tint interfere with my phone, GPS, or Wi-Fi?',
        answer: 'ClearPro’s non-metallic ceramic films are designed not to interfere with mobile signals, GPS, Wi-Fi, or Bluetooth. Navigation apps and connected vehicle features should continue functioning normally.',
      },
    ],
    proof: {
      eyebrow: 'Hakum tint proof',
      title: 'Installed for the road ahead.',
      copy: 'Real Nano Ceramic Tint installations from preparation through the finished glass.',
      clips: [
        { ...proofClip('tint', 'naval', 'Hakum Nano Ceramic Tint installation on a white SUV', 'White SUV · Nano Ceramic Tint installation'), homepageFeatured: true },
        proofClip('tint', 'wigo', 'Hakum Nano Ceramic Tint installation on a Toyota Wigo', 'Toyota Wigo · Nano Ceramic Tint installation'),
        proofClip('tint', 'toyota86', 'Hakum Nano Ceramic Tint installation on a Toyota 86', 'Toyota 86 · Nano Ceramic Tint installation'),
      ],
    },
  },
}
