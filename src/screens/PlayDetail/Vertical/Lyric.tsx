import { memo, useMemo, useEffect, useRef, useCallback } from 'react'
import { View, FlatList, type FlatListProps, type LayoutChangeEvent, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native'
import { type Line, useLrcPlay, useLrcSet, useWordLrcPlay, useWordLrcSet } from '@/plugins/lyric'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { AnimatedColorText } from '@/components/common/Text'
import { setSpText } from '@/utils/pixelRatio'
import playerState from '@/store/player/state'
import { scrollTo } from '@/utils/scroll'
import PlayLine, { type PlayLineType } from '../components/PlayLine'
import WordLrcLine from '../components/WordLrcLine'

type FlatListType = FlatListProps<Line>

interface LineProps {
  line: Line
  lineNum: number
  activeLine: number
  onLayout: (lineNum: number, height: number, width: number) => void
}

/** 普通逐句歌词行 */
const LrcLine = memo(({ line, lineNum, activeLine, onLayout }: LineProps) => {
  const theme = useTheme()
  const lrcFontSize = useSettingValue('playDetail.vertical.style.lrcFontSize')
  const textAlign = useSettingValue('playDetail.style.align')
  const size = lrcFontSize / 10
  const lineHeight = setSpText(size) * 1.3

  const colors = useMemo(() => {
    const active = activeLine == lineNum
    return active ? [
      theme['c-primary'],
      theme['c-primary-alpha-200'],
      1,
    ] as const : [
      theme['c-350'],
      theme['c-300'],
      0.6,
    ] as const
  }, [activeLine, lineNum, theme])

  const handleLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    onLayout(lineNum, nativeEvent.layout.height, nativeEvent.layout.width)
  }

  return (
    <View style={styles.line} onLayout={handleLayout}>
      <AnimatedColorText style={{
        ...styles.lineText,
        textAlign,
        lineHeight,
      }} textBreakStrategy="simple" color={colors[0]} opacity={colors[2]} size={size}>{line.text}</AnimatedColorText>
      {
        line.extendedLyrics.map((lrc, index) => {
          return (<AnimatedColorText style={{
            ...styles.lineTranslationText,
            textAlign,
            lineHeight: lineHeight * 0.8,
          }} textBreakStrategy="simple" key={index} color={colors[1]} opacity={colors[2]} size={size * 0.8}>{lrc}</AnimatedColorText>)
        })
      }
    </View>
  )
}, (prevProps, nextProps) => {
  return prevProps.line === nextProps.line &&
    prevProps.activeLine != nextProps.lineNum &&
    nextProps.activeLine != nextProps.lineNum
})

const wait = async() => new Promise(resolve => setTimeout(resolve, 100))

// ── 逐字模式列表 ────────────────────────────────────────────────
import { type WordLine, type WordPlayInfo } from '@/plugins/lyric'

type WordFlatListType = FlatListProps<WordLine>

interface WordListProps {
  wordLines: WordLine[]
  activeLine: number
  wordPlayInfo: WordPlayInfo
  size: number
  textAlign: 'left' | 'center' | 'right'
  flatListRef: React.RefObject<FlatList>
  playLineRef: React.RefObject<PlayLineType>
  isShowLyricProgressSetting: boolean
  lrcLines: Line[]
  onLineLayout: (lineNum: number, height: number, width: number) => void
  onSpaceLayout: (e: LayoutChangeEvent) => void
  onScrollBeginDrag: () => void
  onScrollEndDrag: () => void
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
  onScrollToIndexFailed: WordFlatListType['onScrollToIndexFailed']
  onPlayLine: (time: number) => void
  initialNumToRender: number
}

const WordLyricList = ({
  wordLines,
  activeLine,
  wordPlayInfo,
  size,
  textAlign,
  flatListRef,
  playLineRef,
  isShowLyricProgressSetting,
  lrcLines,
  onLineLayout,
  onSpaceLayout,
  onScrollBeginDrag,
  onScrollEndDrag,
  onScroll,
  onScrollToIndexFailed,
  onPlayLine,
  initialNumToRender,
}: WordListProps) => {
  const spaceComponent = useMemo(() => (
    <View style={styles.space} onLayout={onSpaceLayout}></View>
  ), [onSpaceLayout])

  const renderItem: WordFlatListType['renderItem'] = ({ item, index }) => {
    // 用 lrcLines[index] 的 extendedLyrics 做翻译/罗马音
    const extendedLyrics = lrcLines[index]?.extendedLyrics ?? []
    return (
      <WordLrcLine
        line={item}
        lineNum={index}
        activeLine={activeLine}
        wordPlayInfo={wordPlayInfo}
        size={size}
        textAlign={textAlign}
        extendedLyrics={extendedLyrics}
        onLayout={onLineLayout}
      />
    )
  }

  const getKey: WordFlatListType['keyExtractor'] = (item, index) => `w${index}${item.text}`

  return (
    <>
      <FlatList
        data={wordLines}
        renderItem={renderItem}
        keyExtractor={getKey}
        style={styles.container}
        ref={flatListRef}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={spaceComponent}
        ListFooterComponent={spaceComponent}
        onScrollBeginDrag={onScrollBeginDrag}
        onScrollEndDrag={onScrollEndDrag}
        fadingEdgeLength={100}
        initialNumToRender={Math.max(initialNumToRender + 10, 10)}
        onScrollToIndexFailed={onScrollToIndexFailed}
        onScroll={onScroll}
      />
      { isShowLyricProgressSetting ? <PlayLine ref={playLineRef} onPlayLine={onPlayLine} /> : null }
    </>
  )
}

// ── 主组件 ───────────────────────────────────────────────────────
export default () => {
  const lyricLines = useLrcSet()
  const { line } = useLrcPlay()
  const wordLines = useWordLrcSet()
  const wordPlayInfo = useWordLrcPlay()
  const isShowWordLyric = useSettingValue('playDetail.isShowWordLyric')
  const lrcFontSize = useSettingValue('playDetail.vertical.style.lrcFontSize')
  const textAlign = useSettingValue('playDetail.style.align')

  const flatListRef = useRef<FlatList>(null)
  const playLineRef = useRef<PlayLineType>(null)
  const isPauseScrollRef = useRef(true)
  const scrollTimoutRef = useRef<NodeJS.Timeout | null>(null)
  const delayScrollTimeout = useRef<NodeJS.Timeout | null>(null)
  const lineRef = useRef({ line: 0, prevLine: 0 })
  const isFirstSetLrc = useRef(true)
  const scrollInfoRef = useRef<NativeSyntheticEvent<NativeScrollEvent>['nativeEvent'] | null>(null)
  const listLayoutInfoRef = useRef<{ spaceHeight: number, lineHeights: number[] }>({ spaceHeight: 0, lineHeights: [] })
  const scrollCancelRef = useRef<(() => void) | null>(null)
  const isShowLyricProgressSetting = useSettingValue('playDetail.isShowLyricProgressSetting')

  // 逐字模式下使用 wordLines 的行索引，普通模式下使用 line
  const useWordMode = isShowWordLyric && wordLines.length > 0
  const activeLine = useWordMode ? wordPlayInfo.line : line

  const handleScrollToActive = (index = lineRef.current.line) => {
    if (index < 0) return
    if (flatListRef.current) {
      if (scrollInfoRef.current && lineRef.current.line - lineRef.current.prevLine == 1) {
        let offset = listLayoutInfoRef.current.spaceHeight
        for (let l = 0; l < index; l++) {
          offset += listLayoutInfoRef.current.lineHeights[l]
        }
        offset += (listLayoutInfoRef.current.lineHeights[index] ?? 0) / 2
        try {
          scrollCancelRef.current = scrollTo(flatListRef.current, scrollInfoRef.current, offset - scrollInfoRef.current.layoutMeasurement.height * 0.42, 600, () => {
            scrollCancelRef.current = null
          })
        } catch {}
      } else {
        if (scrollCancelRef.current) {
          scrollCancelRef.current()
          scrollCancelRef.current = null
        }
        try {
          flatListRef.current.scrollToIndex({
            index,
            animated: true,
            viewPosition: 0.42,
          })
        } catch {}
      }
    }
  }

  const handleScroll = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollInfoRef.current = nativeEvent
    if (isPauseScrollRef.current) {
      playLineRef.current?.updateScrollInfo(nativeEvent)
    }
  }
  const handleScrollBeginDrag = () => {
    isPauseScrollRef.current = true
    playLineRef.current?.setVisible(true)
    if (delayScrollTimeout.current) {
      clearTimeout(delayScrollTimeout.current)
      delayScrollTimeout.current = null
    }
    if (scrollTimoutRef.current) {
      clearTimeout(scrollTimoutRef.current)
      scrollTimoutRef.current = null
    }
    if (scrollCancelRef.current) {
      scrollCancelRef.current()
      scrollCancelRef.current = null
    }
  }

  const onScrollEndDrag = () => {
    if (!isPauseScrollRef.current) return
    if (scrollTimoutRef.current) clearTimeout(scrollTimoutRef.current)
    scrollTimoutRef.current = setTimeout(() => {
      playLineRef.current?.setVisible(false)
      scrollTimoutRef.current = null
      isPauseScrollRef.current = false
      if (!playerState.isPlay) return
      handleScrollToActive()
    }, 3000)
  }

  useEffect(() => {
    return () => {
      if (delayScrollTimeout.current) {
        clearTimeout(delayScrollTimeout.current)
        delayScrollTimeout.current = null
      }
      if (scrollTimoutRef.current) {
        clearTimeout(scrollTimoutRef.current)
        scrollTimoutRef.current = null
      }
    }
  }, [])

  // 歌词列表变化时重置滚动
  const currentLines = useWordMode ? wordLines : lyricLines
  useEffect(() => {
    listLayoutInfoRef.current.lineHeights = []
    lineRef.current.prevLine = 0
    lineRef.current.line = 0
    if (!flatListRef.current) return
    flatListRef.current.scrollToOffset({ offset: 0, animated: false })
    if (!currentLines.length) return
    playLineRef.current?.updateLyricLines(lyricLines)
    requestAnimationFrame(() => {
      if (isFirstSetLrc.current) {
        isFirstSetLrc.current = false
        setTimeout(() => {
          isPauseScrollRef.current = false
          handleScrollToActive()
        }, 100)
      } else {
        if (delayScrollTimeout.current) clearTimeout(delayScrollTimeout.current)
        delayScrollTimeout.current = setTimeout(() => {
          handleScrollToActive(0)
        }, 100)
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLines])

  // 行变化时滚动（逐字模式用 wordPlayInfo.line，普通模式用 line）
  useEffect(() => {
    const curLine = useWordMode ? wordPlayInfo.line : line
    if (curLine < 0) return
    lineRef.current.prevLine = lineRef.current.line
    lineRef.current.line = curLine
    if (!flatListRef.current || isPauseScrollRef.current) return

    if (curLine - lineRef.current.prevLine != 1) {
      handleScrollToActive(curLine)
      return
    }

    delayScrollTimeout.current = setTimeout(() => {
      delayScrollTimeout.current = null
      handleScrollToActive(curLine)
    }, 600)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useWordMode ? wordPlayInfo.line : line])

  useEffect(() => {
    requestAnimationFrame(() => {
      playLineRef.current?.updateLayoutInfo(listLayoutInfoRef.current)
      playLineRef.current?.updateLyricLines(lyricLines)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isShowLyricProgressSetting])

  const handleScrollToIndexFailed: FlatListType['onScrollToIndexFailed'] = (info) => {
    void wait().then(() => {
      handleScrollToActive(info.index)
    })
  }

  const handleLineLayout = useCallback<LineProps['onLayout']>((lineNum, height) => {
    listLayoutInfoRef.current.lineHeights[lineNum] = height
    playLineRef.current?.updateLayoutInfo(listLayoutInfoRef.current)
  }, [])

  const handleSpaceLayout = useCallback(({ nativeEvent }: LayoutChangeEvent) => {
    listLayoutInfoRef.current.spaceHeight = nativeEvent.layout.height
    playLineRef.current?.updateLayoutInfo(listLayoutInfoRef.current)
  }, [])

  const handlePlayLine = useCallback((time: number) => {
    playLineRef.current?.setVisible(false)
    global.app_event.setProgress(time)
  }, [])

  const size = lrcFontSize / 10

  // 逐字模式
  if (useWordMode) {
    return (
      <WordLyricList
        wordLines={wordLines}
        activeLine={wordPlayInfo.line}
        wordPlayInfo={wordPlayInfo}
        size={size}
        textAlign={textAlign}
        flatListRef={flatListRef}
        playLineRef={playLineRef}
        isShowLyricProgressSetting={isShowLyricProgressSetting}
        lrcLines={lyricLines}
        onLineLayout={handleLineLayout}
        onSpaceLayout={handleSpaceLayout}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={onScrollEndDrag}
        onScroll={handleScroll}
        onScrollToIndexFailed={handleScrollToIndexFailed}
        onPlayLine={handlePlayLine}
        initialNumToRender={wordPlayInfo.line}
      />
    )
  }

  // 普通逐句模式
  const renderItem: FlatListType['renderItem'] = ({ item, index }) => {
    return (
      <LrcLine line={item} lineNum={index} activeLine={line} onLayout={handleLineLayout} />
    )
  }
  const getkey: FlatListType['keyExtractor'] = (item, index) => `${index}${item.text}`

  const spaceComponent = (
    <View style={styles.space} onLayout={handleSpaceLayout}></View>
  )

  return (
    <>
      <FlatList
        data={lyricLines}
        renderItem={renderItem}
        keyExtractor={getkey}
        style={styles.container}
        ref={flatListRef}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={spaceComponent}
        ListFooterComponent={spaceComponent}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={onScrollEndDrag}
        fadingEdgeLength={100}
        initialNumToRender={Math.max(line + 10, 10)}
        onScrollToIndexFailed={handleScrollToIndexFailed}
        onScroll={handleScroll}
      />
      { isShowLyricProgressSetting ? <PlayLine ref={playLineRef} onPlayLine={handlePlayLine} /> : null }
    </>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
    paddingLeft: 20,
    paddingRight: 20,
  },
  space: {
    paddingTop: '100%',
  },
  line: {
    paddingTop: 10,
    paddingBottom: 10,
  },
  lineText: {
    textAlign: 'center',
  },
  lineTranslationText: {
    textAlign: 'center',
    paddingTop: 5,
  },
})
