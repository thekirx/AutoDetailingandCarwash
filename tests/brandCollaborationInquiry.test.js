import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  BRAND_COLLAB_TYPES,
  normalizeBrandCollaborationInquiry,
  validateBrandCollaborationInquiry,
} from '../src/lib/partnershipInquiry.js'

describe('brand collaboration inquiry', () => {
  it('maps the brand-collab form onto the existing partnership intake payload', () => {
    assert.deepEqual(
      normalizeBrandCollaborationInquiry({
        collaborationType: 'product_collaboration',
        contactName: '  Ana Reyes  ',
        brandName: '  Sonax Philippines  ',
        email: '  ANA@EXAMPLE.COM ',
        contactNumber: ' 0915 000 0000 ',
        website: ' https://sonax.example ',
        message: ' Let us build a launch together. ',
      }),
      {
        siteType: 'commercial_lot',
        name: 'Ana Reyes',
        email: 'ana@example.com',
        contactNumber: '0915 000 0000',
        city: 'Sonax Philippines',
        message: 'Website: https://sonax.example\n\nLet us build a launch together.',
      },
    )
  })

  it('requires brand and contact details while leaving the website optional', () => {
    assert.deepEqual(validateBrandCollaborationInquiry({}), {
      contactName: 'Contact name is required.',
      brandName: 'Brand or company name is required.',
      email: 'Email is required.',
      contactNumber: 'Contact number is required.',
      message: 'Tell us what you have in mind.',
    })

    assert.deepEqual(
      validateBrandCollaborationInquiry({
        collaborationType: BRAND_COLLAB_TYPES[0].value,
        contactName: 'Ana Reyes',
        brandName: 'Sonax Philippines',
        email: 'ana@example.com',
        contactNumber: '0915 000 0000',
        website: '',
        message: 'Product launch collaboration.',
      }),
      {},
    )
  })
})
