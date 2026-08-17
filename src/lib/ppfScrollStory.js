export const PPF_INTRO_END = 0.15

const clampProgress = (progress) => Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0))

export function getPpfFrameIndex(progress, frameCount) {
  const safeProgress = clampProgress(progress)
  const safeFrameCount = Math.max(1, frameCount)
  const frameProgress = Math.max(0, (safeProgress - PPF_INTRO_END) / (1 - PPF_INTRO_END))
  return Math.round(frameProgress * (safeFrameCount - 1))
}

export function getPpfStoryState(progress, chapters, frameCount) {
  const safeProgress = clampProgress(progress)
  const activeChapter = chapters.reduce(
    (active, chapter, index) => (safeProgress >= chapter.start ? index : active),
    -1,
  )

  return {
    frame: getPpfFrameIndex(safeProgress, frameCount),
    activeChapter,
    phase: activeChapter === -1 ? 'introduction' : 'process',
  }
}
