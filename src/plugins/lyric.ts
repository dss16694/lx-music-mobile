import { useEffect, useState } from 'react'
import Lyric, { type Lines } from 'lrc-file-parser'
// import { getStore, subscribe } from '@/store'
export type Line = Lines[number]
type PlayHook = (line: number, text: string) => void
type SetLyricHook = (lines: Lines) => void

// ── 逐字歌词类型 ──────────────────────────────────────────────
export interface WordToken {
  /** 相对行起始时间的偏移量 (ms) */
  startOffset: number
  /** 持续时长 (ms) */
  duration: number
  /** 文字内容 */
  text: string
}

export interface WordLine {
  /** 行起始时间 (ms) */
  time: number
  /** 逐字 token 列表 */
  words: WordToken[]
  /** 纯文本（无逐字时的 fallback）*/
  text: string
}

/** 当前行的逐字播放进度：哪个字正在高亮 */
export interface WordPlayInfo {
  /** 当前激活的行索引，-1 表示还没开始 */
  line: number
  /** 当前激活的字索引，-1 表示整行未激活 */
  wordIndex: number
}

type WordSetHook = (lines: WordLine[]) => void
type WordPlayHook = (info: WordPlayInfo) => void

// ── 逐字解析 ─────────────────────────────────────────────────
/**
 * 解析 lxlyric 格式（酷狗 KRC / 网易 YRC / 酷我 / 咪咕 MRC 共用）：
 *   [mm:ss.ms]<offsetMs,durationMs>字<offsetMs,durationMs>字...
 *
 * 注意：ms 部分位数不固定（1~3位），直接是毫秒数，不需要补零
 *   "01:03.50"  → ms=50  (50ms)
 *   "01:03.500" → ms=500 (500ms)
 *   "01:03.5"   → ms=5   (5ms, 酷狗部分歌词)
 */
const WORD_TOKEN_RE = /<(\d+),(\d+)>([^<\[]*)/g
const LINE_TIME_RE = /^\[(\d{1,2}):(\d{1,2})\.(\d{1,4})\]/

const parseWordLyric = (lxlyric: string): WordLine[] => {
  const result: WordLine[] = []
  const lines = lxlyric.split(/\r\n|\n|\r/)

  for (const raw of lines) {
    const line = raw.trim()
    const timeMatch = LINE_TIME_RE.exec(line)
    if (!timeMatch) continue

    const m = parseInt(timeMatch[1])
    const s = parseInt(timeMatch[2])
    // ms 直接是毫秒数，位数不固定，不做补零处理
    const ms = parseInt(timeMatch[3])
    const lineTime = m * 60_000 + s * 1_000 + ms

    const body = line.slice(timeMatch[0].length)
    const words: WordToken[] = []
    let plainText = ''
    let match: RegExpExecArray | null

    WORD_TOKEN_RE.lastIndex = 0
    while ((match = WORD_TOKEN_RE.exec(body)) !== null) {
      const startOffset = parseInt(match[1])
      const duration = parseInt(match[2])
      const text = match[3]
      if (text) {
        words.push({ startOffset, duration, text })
        plainText += text
      }
    }

    // 没有逐字 token 的行跳过
    if (!words.length) continue

    result.push({ time: lineTime, words, text: plainText })
  }

  // 按时间排序
  result.sort((a, b) => a.time - b.time)
  return result
}

// ── 逐字播放调度器 ────────────────────────────────────────────
const getNow = () => performance.now()

const wordPlayerTools = {
  lines: [] as WordLine[],
  currentInfo: { line: -1, wordIndex: -1 } as WordPlayInfo,
  playHooks: [] as WordPlayHook[],
  setHooks: [] as WordSetHook[],
  isPlay: false,
  _playbackRate: 1,
  _startTime: 0,
  _performanceTime: 0,
  _timer: null as ReturnType<typeof setTimeout> | null,
  _lineTimer: null as ReturnType<typeof setTimeout> | null,

  _clearTimers() {
    if (this._timer) { clearTimeout(this._timer); this._timer = null }
    if (this._lineTimer) { clearTimeout(this._lineTimer); this._lineTimer = null }
  },

  _currentMs() {
    return (getNow() - this._performanceTime) * this._playbackRate + this._startTime
  },

  _emitPlay(line: number, wordIndex: number) {
    this.currentInfo = { line, wordIndex }
    for (const h of this.playHooks) h(this.currentInfo)
  },

  _scheduleWords(lineIndex: number, curMs: number) {
    if (lineIndex < 0 || lineIndex >= this.lines.length) return
    const wl = this.lines[lineIndex]

    // 找到当前 ms 对应的字
    let wi = -1
    for (let i = 0; i < wl.words.length; i++) {
      const abs = wl.time + wl.words[i].startOffset
      if (curMs >= abs) wi = i
    }

    this._emitPlay(lineIndex, wi)

    // 调度下一个字
    const nextWi = wi + 1
    if (nextWi < wl.words.length) {
      const nextWord = wl.words[nextWi]
      const nextAbsMs = wl.time + nextWord.startOffset
      const delay = Math.max(0, (nextAbsMs - curMs) / this._playbackRate)
      this._timer = setTimeout(() => {
        if (!this.isPlay) return
        this._emitPlay(lineIndex, nextWi)
        // 继续调度该行剩余的字
        this._scheduleWordsFrom(lineIndex, nextWi + 1)
      }, delay)
    }
  },

  _scheduleWordsFrom(lineIndex: number, startWi: number) {
    if (!this.isPlay) return
    const wl = this.lines[lineIndex]
    if (!wl || startWi >= wl.words.length) return

    const now = this._currentMs()
    const word = wl.words[startWi]
    const absMs = wl.time + word.startOffset
    const delay = Math.max(0, (absMs - now) / this._playbackRate)

    this._timer = setTimeout(() => {
      if (!this.isPlay) return
      this._emitPlay(lineIndex, startWi)
      this._scheduleWordsFrom(lineIndex, startWi + 1)
    }, delay)
  },

  _scheduleNextLine(lineIndex: number) {
    if (!this.isPlay) return
    const nextLine = lineIndex + 1
    if (nextLine >= this.lines.length) return

    const now = this._currentMs()
    const delay = Math.max(0, (this.lines[nextLine].time - now) / this._playbackRate)
    this._lineTimer = setTimeout(() => {
      if (!this.isPlay) return
      this._scheduleWords(nextLine, this._currentMs())
      this._scheduleNextLine(nextLine)
    }, delay)
  },

  play(timeMs: number) {
    this._clearTimers()
    this.isPlay = true
    this._performanceTime = getNow()
    this._startTime = timeMs

    if (!this.lines.length) return

    // 找当前应激活的行
    let lineIndex = -1
    for (let i = 0; i < this.lines.length; i++) {
      if (timeMs >= this.lines[i].time) lineIndex = i
    }

    if (lineIndex < 0) {
      // 还没到第一行，等待第一行
      this._emitPlay(-1, -1)
      this._scheduleNextLine(-1)
      return
    }

    this._scheduleWords(lineIndex, timeMs)
    this._scheduleNextLine(lineIndex)
  },

  pause() {
    this.isPlay = false
    this._clearTimers()
  },

  setPlaybackRate(rate: number) {
    const wasPlay = this.isPlay
    if (wasPlay) this.pause()
    this._playbackRate = rate
    if (wasPlay) this.play(this._currentMs())
  },

  setLines(lines: WordLine[]) {
    this.pause()
    this.lines = lines
    this.currentInfo = { line: -1, wordIndex: -1 }
    for (const h of this.setHooks) h(lines)
    for (const h of this.playHooks) h(this.currentInfo)
  },

  addPlayHook(h: WordPlayHook) {
    this.playHooks.push(h)
    h(this.currentInfo)
  },
  removePlayHook(h: WordPlayHook) {
    const i = this.playHooks.indexOf(h)
    if (i >= 0) this.playHooks.splice(i, 1)
  },
  addSetHook(h: WordSetHook) {
    this.setHooks.push(h)
    h(this.lines)
  },
  removeSetHook(h: WordSetHook) {
    const i = this.setHooks.indexOf(h)
    if (i >= 0) this.setHooks.splice(i, 1)
  },
}

// ── 行级歌词播放（原有逻辑） ───────────────────────────────────
const lrcTools = {
  isInited: false,
  lrc: null as Lyric | null,
  currentLineData: { line: 0, text: '' },
  currentLines: [] as Lines,
  playHooks: [] as PlayHook[],
  setLyricHooks: [] as SetLyricHook[],
  isPlay: false,
  isShowTranslation: false,
  isShowRoma: false,
  lyricText: '',
  translationText: '' as string | null | undefined,
  romaText: '' as string | null | undefined,
  lxlyricText: '' as string | null | undefined,
  init() {
    if (this.isInited) return
    this.isInited = true
    this.lrc = new Lyric({
      onPlay: this.onPlay.bind(this),
      onSetLyric: this.onSetLyric.bind(this),
      offset: 100, // offset time(ms), default is 150 ms
    })
  },
  onPlay(line: number, text: string) {
    this.currentLineData.line = line
    // console.log(line)
    this.currentLineData.text = text
    for (const hook of this.playHooks) hook(line, text)
  },
  onSetLyric(lines: Lines) {
    this.currentLines = lines
    this.currentLineData.line = 0
    this.currentLineData.text = ''
    for (const hook of this.playHooks) hook(-1, '')
    for (const hook of this.setLyricHooks) hook(lines)
  },
  addPlayHook(hook: PlayHook) {
    this.playHooks.push(hook)
    hook(this.currentLineData.line, this.currentLineData.text)
  },
  removePlayHook(hook: PlayHook) {
    this.playHooks.splice(this.playHooks.indexOf(hook), 1)
  },
  addSetLyricHook(hook: SetLyricHook) {
    this.setLyricHooks.push(hook)
    hook(this.currentLines)
  },
  removeSetLyricHook(hook: SetLyricHook) {
    this.setLyricHooks.splice(this.setLyricHooks.indexOf(hook), 1)
  },
  setLyric() {
    const extendedLyrics = [] as string[]
    if (this.isShowTranslation && this.translationText) extendedLyrics.push(this.translationText)
    if (this.isShowRoma && this.romaText) extendedLyrics.push(this.romaText)
    this.lrc!.setLyric(this.lyricText, extendedLyrics)
    // 同步更新逐字歌词
    if (this.lxlyricText) {
      const wordLines = parseWordLyric(this.lxlyricText)
      console.log('[lyric] parseWordLyric result', {
        inputLen: this.lxlyricText.length,
        inputPreview: this.lxlyricText.slice(0, 300),
        parsedLines: wordLines.length,
        firstLine: wordLines[0],
      })
      wordPlayerTools.setLines(wordLines)
    } else {
      console.log('[lyric] lxlyricText is empty, word lyric disabled')
      wordPlayerTools.setLines([])
    }
  },
}


export const init = async() => {
  lrcTools.init()
}

export const setLyric = (lyric: string, translation?: string, romalrc?: string, lxlyric?: string) => {
  lrcTools.isPlay = false
  lrcTools.lyricText = lyric
  lrcTools.translationText = translation
  lrcTools.romaText = romalrc
  lrcTools.lxlyricText = lxlyric
  lrcTools.setLyric()
}
export const setPlaybackRate = (playbackRate: number) => {
  lrcTools.lrc!.setPlaybackRate(playbackRate)
  wordPlayerTools.setPlaybackRate(playbackRate)
}
export const toggleTranslation = (isShow: boolean) => {
  lrcTools.isShowTranslation = isShow
  if (!lrcTools.lyricText) return
  lrcTools.setLyric()
}
export const toggleRoma = (isShow: boolean) => {
  lrcTools.isShowRoma = isShow
  if (!lrcTools.lyricText) return
  lrcTools.setLyric()
}
export const play = (time: number) => {
  // console.log(time)
  lrcTools.isPlay = true
  lrcTools.lrc!.play(time)
  if (wordPlayerTools.lines.length) wordPlayerTools.play(time)
}
export const pause = () => {
  // console.log('pause')
  lrcTools.isPlay = false
  lrcTools.lrc!.pause()
  wordPlayerTools.pause()
}

// on lyric play hook
export const useLrcPlay = (autoUpdate = true) => {
  const [lrcInfo, setLrcInfo] = useState(lrcTools.currentLineData)
  useEffect(() => {
    if (!autoUpdate) return
    const setLrcCallback: SetLyricHook = () => {
      setLrcInfo({ line: 0, text: '' })
    }
    const playCallback: PlayHook = (line, text) => {
      setLrcInfo({ line, text })
    }
    lrcTools.addSetLyricHook(setLrcCallback)
    lrcTools.addPlayHook(playCallback)
    setLrcInfo(lrcTools.currentLineData)
    return () => {
      lrcTools.removeSetLyricHook(setLrcCallback)
      lrcTools.removePlayHook(playCallback)
    }
  }, [autoUpdate])

  return lrcInfo
}

// on lyric set hook
export const useLrcSet = () => {
  const [lines, setLines] = useState<Lines>(lrcTools.currentLines)
  useEffect(() => {
    const callback = (lines: Lines) => {
      setLines(lines)
    }
    lrcTools.addSetLyricHook(callback)
    return () => { lrcTools.removeSetLyricHook(callback) }
  }, [])

  return lines
}

// ── 逐字歌词 hooks ────────────────────────────────────────────

/** 订阅逐字歌词行列表变化 */
export const useWordLrcSet = () => {
  const [lines, setLines] = useState<WordLine[]>(wordPlayerTools.lines)
  useEffect(() => {
    const cb: WordSetHook = (l) => setLines([...l])
    wordPlayerTools.addSetHook(cb)
    return () => wordPlayerTools.removeSetHook(cb)
  }, [])
  return lines
}

/** 订阅当前字级播放进度 */
export const useWordLrcPlay = () => {
  const [info, setInfo] = useState<WordPlayInfo>(wordPlayerTools.currentInfo)
  useEffect(() => {
    const cb: WordPlayHook = (i) => setInfo({ ...i })
    wordPlayerTools.addPlayHook(cb)
    return () => wordPlayerTools.removePlayHook(cb)
  }, [])
  return info
}
