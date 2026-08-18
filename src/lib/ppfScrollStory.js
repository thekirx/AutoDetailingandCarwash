export const PPF_INTRO_END = 0.12

const clampProgress = (progress) => Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0))

export function getPpfFrameIndex(progress, frameCount) {
  const safeProgress = clampProgress(progress)
  const safeFrameCount = Math.max(1, frameCount)
  const frameProgress = Math.max(0, (safeProgress - PPF_INTRO_END) / (1 - PPF_INTRO_END))
  return Math.round(frameProgress * (safeFrameCount - 1))
}

export function getPpfStoryState(progress, story, frameCount) {
  const safeProgress = clampProgress(progress)
  const showIntroduction = safeProgress < story.introEnd
  const activeChapter = story.chapters.findIndex((chapter) => (
    safeProgress >= chapter.start
      && (safeProgress < chapter.end || (chapter.end === 1 && safeProgress === 1))
  ))

  return {
    frame: getPpfFrameIndex(safeProgress, frameCount),
    activeChapter,
    showIntroduction,
    phase: showIntroduction ? 'introduction' : activeChapter === -1 ? 'clear' : 'process',
  }
}
