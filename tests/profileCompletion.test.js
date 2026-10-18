import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { PROFILE_STEPS, profileCompletion } from '../src/lib/profileCompletion.js'

const base = { full_name: 'Ana Cruz', phone: '09171234567', email: '', date_of_birth: null }
const car = (extra = {}) => ({ id: 'v1', plate_number: 'ABC 1234', vehicle_make: 'Toyota', vehicle_model: 'Vios', ...extra })

describe('profileCompletion', () => {
  it('has five equal steps', () => {
    assert.equal(PROFILE_STEPS.length, 5)
  })

  it('starts at 20% after sign-up with no car', () => {
    const p = profileCompletion(base, [])
    assert.equal(p.percent, 20)
    assert.equal(p.done, 1)
    assert.equal(p.next.id, 'birthday')
    assert.equal(p.next.to, '/account/more?tab=account#birthday')
  })

  it('reaches 100% and has no next step', () => {
    const p = profileCompletion({ ...base, email: 'ana@gmail.com', date_of_birth: '1994-08-11' }, [car()])
    assert.equal(p.percent, 100)
    assert.equal(p.complete, true)
    assert.equal(p.next, null)
  })

  it('does not count a shop login address as a real email', () => {
    const p = profileCompletion({ ...base, email: '09171234567@customers.hakumautocare.com' }, [])
    assert.equal(p.steps.find((s) => s.id === 'email').done, false)
  })

  it('asks for make & model and links to the car missing them', () => {
    const p = profileCompletion(
      { ...base, email: 'ana@gmail.com', date_of_birth: '1994-08-11' },
      [car(), car({ id: 'v2', vehicle_model: '' })],
    )
    assert.equal(p.percent, 80)
    assert.equal(p.next.id, 'car_details')
    assert.equal(p.next.to, '/account/more?tab=garage&vehicle=v2')
  })

  it('make & model is not done without a car', () => {
    const p = profileCompletion(base, [])
    assert.equal(p.steps.find((s) => s.id === 'car_details').done, false)
  })

  it('orders next as birthday, email, car, make & model', () => {
    assert.equal(profileCompletion({ ...base, date_of_birth: '1994-08-11' }, []).next.id, 'email')
    assert.equal(profileCompletion({ ...base, date_of_birth: '1994-08-11', email: 'a@b.co' }, []).next.id, 'car')
    assert.equal(profileCompletion({ ...base, date_of_birth: '1994-08-11', email: 'a@b.co' }, []).next.to, '/account/more?tab=garage&add=1')
  })

  it('tolerates a missing profile', () => {
    const p = profileCompletion(null, null)
    assert.equal(p.percent, 0)
    assert.equal(p.next.id, 'birthday')
  })
})
