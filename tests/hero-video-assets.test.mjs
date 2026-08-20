import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const assets = [
  { name: 'desktop', path: '../src/assets/hero/desktop-hero.mp4', width: 1920, height: 1080 },
  { name: 'mobile', path: '../src/assets/hero/mobile-hero.mp4', width: 1080, height: 1920 },
]

function inspectMedia(relativePath) {
  const path = fileURLToPath(new URL(relativePath, import.meta.url))
  const result = spawnSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'stream=codec_type,codec_name,width,height',
    '-of', 'json',
    path,
  ], { encoding: 'utf8' })

  assert.equal(result.status, 0, result.stderr || `Unable to inspect ${path}`)
  return JSON.parse(result.stdout).streams
}

for (const asset of assets) {
  test(`${asset.name} hero video is silent, H.264, and correctly sized`, () => {
    const streams = inspectMedia(asset.path)
    const video = streams.find((stream) => stream.codec_type === 'video')

    assert.ok(video, `${asset.name} hero is missing its video stream`)
    assert.equal(video.codec_name, 'h264')
    assert.equal(video.width, asset.width)
    assert.equal(video.height, asset.height)
    assert.equal(streams.some((stream) => stream.codec_type === 'audio'), false)
  })
}
