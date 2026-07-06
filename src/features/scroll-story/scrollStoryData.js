export const storyStages = [
  {
    id: 'arrival',
    number: '01',
    label: 'Dirty car arrival',
    state: 'dirty',
    weight: 1.1,
    copy: 'From daily dirt to showroom finish.',
  },
  {
    id: 'carwash',
    number: '02',
    label: 'Carwash',
    state: 'washed',
    weight: 0.75,
    copy: 'Fast, clean, and reliable exterior care for everyday vehicles.',
  },
  {
    id: 'detailing',
    number: '03',
    label: 'Detailing',
    state: 'detailed',
    weight: 1.25,
    copy: 'Deep cleaning, paint correction, and interior restoration for a fresher, newer-looking car.',
  },
  {
    id: 'ppf',
    number: '04',
    label: 'Paint protection film',
    state: 'ppf',
    weight: 1.8,
    copy: 'Invisible paint protection against scratches, chips, road debris, and daily wear.',
  },
  {
    id: 'ceramic',
    number: '05',
    label: 'Ceramic coating',
    state: 'ceramic',
    weight: 1.25,
    copy: 'Long-lasting gloss, easier cleaning, and stronger paint defense.',
  },
]

export const packageOptions = [
  { id: 'wash', label: 'Wash', bestFor: 'Everyday maintenance', state: 'washed' },
  { id: 'detail', label: 'Detail', bestFor: 'Deep cleaning / restoration', state: 'detailed' },
  { id: 'ceramic', label: 'Ceramic', bestFor: 'Gloss and easier cleaning', state: 'ceramic' },
  { id: 'ppf', label: 'PPF', bestFor: 'Maximum paint protection', state: 'ppf' },
]
