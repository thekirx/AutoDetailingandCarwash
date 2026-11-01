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
        question: "Why choose ClearPro PPF at Hakum Auto Care?",
        answer: "Hakum Auto Care is an official distributor of ClearPro automotive films in the Philippines, so you get genuine ClearPro film, not look-alikes. ClearPro is built on three patented technologies. Polyoptico™ coating gives a smooth, mirror-like finish with no orange peel. Invisiglue™ adhesive leaves no visible glue lines. Non-yellowing optical TPU keeps the film clear over time. Each roll is also checked by an automated 8K computer inspection during production.",
      },
      {
        question: "Will PPF change how my car looks?",
        answer: "No. ClearPro film is virtually invisible. Its surface reaches 95 GU gloss at 60°, so it blends with your paint like factory clear coat. If you want a different look, we offer matte, satin, and black finishes such as UltraSatin, Cosmoblack, and Carbon Fiber Black.",
      },
      {
        question: "What does PPF protect my car from?",
        answer: "It protects against rock chips, road debris, and light scratches. ClearPro film covers your car from the headlamps to the rear bumper while keeping the glossy finish. We can also protect headlamps, windshields, and skylights with ClearPro’s specialty films.",
      },
      {
        question: "Does ClearPro film heal its own scratches?",
        answer: "Yes. ClearPro film is self-healing, so light swirls and scratches fade away and the surface looks pristine again. It also lasts longer than many competing films, which makes it a smart long-term investment for your car.",
      },
      {
        question: "Will it make my car easier to keep clean?",
        answer: "Yes. ClearPro film is highly hydrophobic, with a contact angle of up to 105°. Water, dirt, and grime roll off the surface, so your car stays cleaner between washes. That helps in the Philippines, where rain and dust are part of everyday driving.",
      },
      {
        question: "Will PPF damage my paint, and can it be removed later?",
        answer: "No. The film is designed to protect your original paint. ClearPro’s adhesive is gentle on paint and leaves no residue when the film is removed. Your paint stays original and ready for resale.",
      },
      {
        question: "What warranty comes with ClearPro PPF from Hakum Auto Care?",
        answer: "ClearPro PPF carries a 10-year manufacturer’s warranty. It covers cracking, yellowing, discoloration, peeling, delaminating, degumming, and bubbling. Because we are an official ClearPro distributor, we handle your installation and warranty paperwork properly. Keep your installation invoice, because it is your proof of warranty.",
      },
      {
        question: "How do I care for my PPF after installation?",
        answer: "Don’t wash your car for at least 3 days so the film can cure. After that, hand-wash with soap, water, and microfiber towels. Avoid automatic car washes, and don’t aim a high-pressure hose at the film edges. These steps protect the film and your warranty.",
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
        question: "What makes ClearPro ceramic tint better than regular tint?",
        answer: "ClearPro uses advanced nano-ceramic technology. It reduces heat without the dyed look of cheap film, and it stays clear and glossy. ClearPro films are made in a Class 1000 dust-free cleanroom, and the company is ISO 9001, 14001, and 45001 certified. The brand is sold in over 85 countries, and Hakum Auto Care brings it to the Philippines as an official distributor.",
      },
      {
        question: "Is ClearPro tint certified by the Skin Cancer Foundation?",
        answer: "Yes. Every ClearPro window film is Certified by the Skin Cancer Foundation, whichever shade or series you choose. Each film blocks over 99% of UVA and UVB rays, which helps protect you and your passengers on every drive.",
      },
      {
        question: "How much cooler will my car be?",
        answer: "ClearPro tint blocks infrared rays, so less heat enters the cabin. Your car stays more comfortable under the Philippine sun, and your A/C works less to cool it down.",
      },
      {
        question: "Will I still see clearly, day and night?",
        answer: "Yes. ClearPro films have high light transmission and visual clarity, so you get privacy and heat reduction without losing visibility. They also reduce glare from sunlight and reflections, which makes bright-day driving safer and more comfortable.",
      },
      {
        question: "Will ceramic tint interfere with my phone, GPS, or Wi-Fi?",
        answer: "No. ClearPro films use non-metallic materials, so there is no interference with mobile signals, GPS, Wi-Fi, or Bluetooth. Navigation apps and connected features keep working normally.",
      },
      {
        question: "Does tint protect my interior and my safety too?",
        answer: "Yes. Blocking over 99% of UV rays helps prevent fading and cracking of your dashboard, seats, and trim. The film also holds glass together on impact, which reduces the risk from shattered glass. Its privacy effect makes it harder to see into your car from outside.",
      },
      {
        question: "Will the tint scratch, fade, or peel?",
        answer: "ClearPro tint has a scratch-resistant coating that handles everyday wear. It is designed to last up to 10 years and carries a 10-year warranty covering yellowing, cracking, fading, delamination, bubbling, and other non-human quality problems.",
      },
      {
        question: "What shade options do you offer?",
        answer: "ClearPro offers a full range of shades across several series: Black, Core, Hitech, Hyper, and Spectra. Whether you want a subtle upgrade or maximum privacy, we’ll help you choose a ClearPro film that fits your car and your preferences. Visit or contact Hakum Auto Care to see samples.",
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
