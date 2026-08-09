import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizePartnershipInquiry,
  submitPartnershipInquiry,
  validatePartnershipInquiry,
} from '../src/lib/partnershipInquiry.js';

test('normalizes only the approved partnership fields', () => {
  assert.deepEqual(
    normalizePartnershipInquiry({
      name: '  Alex Cruz  ',
      email: ' ALEX@example.com ',
      contactNumber: ' 0917 123 4567 ',
      city: ' Quezon City ',
      message: '  We would like to discuss a branch partnership.  ',
      role: 'admin',
    }),
    {
      name: 'Alex Cruz',
      email: 'alex@example.com',
      contactNumber: '0917 123 4567',
      city: 'Quezon City',
      message: 'We would like to discuss a branch partnership.',
    },
  );
});

test('validates all required fields and email format', () => {
  assert.deepEqual(validatePartnershipInquiry({}), {
    name: 'Name is required.',
    email: 'Email is required.',
    contactNumber: 'Contact number is required.',
    city: 'City is required.',
    message: 'Message is required.',
  });

  assert.deepEqual(
    validatePartnershipInquiry({
      name: 'Alex',
      email: 'not-an-email',
      contactNumber: '0917',
      city: 'Manila',
      message: 'Hello',
    }),
    { email: 'Enter a valid email address.' },
  );
});

test('keeps submission unavailable without making a network request', async () => {
  const result = await submitPartnershipInquiry({
    name: 'Alex',
    email: 'alex@example.com',
    contactNumber: '0917',
    city: 'Manila',
    message: 'Hello',
  });

  assert.deepEqual(result, {
    ok: false,
    code: 'unavailable',
    message: 'Online partnership inquiries are not available yet. Please contact Hakum Auto Care directly for now.',
  });
});
