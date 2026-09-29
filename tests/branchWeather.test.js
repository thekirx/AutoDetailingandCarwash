import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { fetchBranchWeather, weatherForecastLine, weatherLabelFromCode } from '../src/lib/branchWeather.js'

describe('branch weather', () => {
  it('maps WMO codes and caches Open-Meteo current temp', async () => {
    assert.equal(weatherLabelFromCode(2), 'Partly cloudy')
    assert.equal(weatherLabelFromCode(95), 'Thunderstorm')
    const storage = new Map()
    const fakeStore = {
      getItem: (k) => storage.get(k) || null,
      setItem: (k, v) => storage.set(k, v),
    }
    let calls = 0
    const fetchImpl = async () => {
      calls += 1
      return {
        ok: true,
        json: async () => ({ current: { temperature_2m: 29.4, weather_code: 2 } }),
      }
    }
    const first = await fetchBranchWeather(14.459, 120.929, { fetchImpl, now: 1, storage: fakeStore })
    const second = await fetchBranchWeather(14.459, 120.929, { fetchImpl, now: 2, storage: fakeStore })
    assert.equal(weatherForecastLine(0), "It's sunny today.")
    assert.equal(weatherForecastLine(3), "It's cloudy today.")
    assert.equal(weatherForecastLine(61), "It's raining today.")
    assert.equal(weatherForecastLine(null), '')
    assert.deepEqual(first, { tempC: 29, label: 'Partly cloudy', line: "It's partly cloudy today." })
    assert.deepEqual(second, first)
    assert.equal(calls, 1)
  })
})
