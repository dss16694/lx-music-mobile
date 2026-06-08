/**
 * 逐字歌词行组件
 *
 * 激活行：已播放的字显示主题色，未播放的字显示半透明色。
 * 非激活行：整行低透明度显示。
 */
import { memo } from 'react'
import { View, Text as RNText, StyleSheet, type TextStyle, type ViewStyle } from 'react-native'
import { type WordLine, type WordPlayInfo } from '@/plugins/lyric'
import { useTheme } from '@/store/theme/hook'
import { useTextShadow } from '@/store/theme/hook'
import { setSpText } from '@/utils/pixelRatio'

interface WordLrcLineProps {
  line: WordLine
  lineNum: number
  activeLine: number
  wordPlayInfo: WordPlayInfo
  /** 字体大小（逻辑单位，同 lrcFontSize/10） */
  size: number
  textAlign: 'left' | 'center' | 'right'
  /** 翻译/罗马音文本列表（原 extendedLyrics，直接透传） */
  extendedLyrics: string[]
  onLayout: (lineNum: number, height: number, width: number) => void
}

const WordLrcLine = memo(({
  line,
  lineNum,
  activeLine,
  wordPlayInfo,
  size,
  textAlign,
  extendedLyrics,
  onLayout,
}: WordLrcLineProps) => {
  const theme = useTheme()
  const textShadow = useTextShadow()
  const isActive = activeLine === lineNum
  const lineHeight = setSpText(size) * 1.3
  const fontSize = setSpText(size)

  const containerStyle: ViewStyle = {
    paddingTop: 10,
    paddingBottom: 10,
  }

  const shadowStyle: TextStyle = textShadow ? {
    textShadowColor: theme['c-primary-dark-300-alpha-800'],
    textShadowOffset: { width: 0.2, height: 0.2 },
    textShadowRadius: 2,
  } : {}

  // 非激活行：整行低亮度
  if (!isActive) {
    return (
      <View
        style={containerStyle}
        onLayout={({ nativeEvent }) => onLayout(lineNum, nativeEvent.layout.height, nativeEvent.layout.width)}
      >
        <RNText
          style={[{
            fontSize,
            lineHeight,
            textAlign,
            color: theme['c-350'],
            opacity: 0.6,
          }, shadowStyle]}
          textBreakStrategy="simple"
        >
          {line.text}
        </RNText>
        {extendedLyrics.map((lrc, idx) => (
          <RNText
            key={idx}
            style={[{
              fontSize: setSpText(size * 0.8),
              lineHeight: lineHeight * 0.8,
              textAlign,
              color: theme['c-300'],
              opacity: 0.6,
              paddingTop: 5,
            }, shadowStyle]}
            textBreakStrategy="simple"
          >
            {lrc}
          </RNText>
        ))}
      </View>
    )
  }

  // 激活行：逐字着色
  const playedColor = theme['c-primary']
  const unplayedColor = theme['c-primary-alpha-200']
  const activeWordIndex = wordPlayInfo.line === lineNum ? wordPlayInfo.wordIndex : -1

  return (
    <View
      style={containerStyle}
      onLayout={({ nativeEvent }) => onLayout(lineNum, nativeEvent.layout.height, nativeEvent.layout.width)}
    >
      <RNText
        style={[{ fontSize, lineHeight, textAlign }, shadowStyle]}
        textBreakStrategy="simple"
      >
        {line.words.map((word, wi) => {
          const played = wi <= activeWordIndex
          return (
            <RNText
              key={wi}
              style={{ color: played ? playedColor : unplayedColor }}
            >
              {word.text}
            </RNText>
          )
        })}
      </RNText>
      {extendedLyrics.map((lrc, idx) => (
        <RNText
          key={idx}
          style={[{
            fontSize: setSpText(size * 0.8),
            lineHeight: lineHeight * 0.8,
            textAlign,
            color: theme['c-primary-alpha-200'],
            paddingTop: 5,
          }, shadowStyle]}
          textBreakStrategy="simple"
        >
          {lrc}
        </RNText>
      ))}
    </View>
  )
}, (prev, next) => {
  // 只在以下情况重新渲染：
  // 1. 自身 line 数据变化
  // 2. 从激活变为非激活，或反之
  // 3. 已激活且字级进度变化
  const prevActive = prev.activeLine === prev.lineNum
  const nextActive = next.activeLine === next.lineNum
  if (prev.line !== next.line) return false
  if (prevActive !== nextActive) return false
  if (nextActive) {
    // 激活行：wordIndex 变化需重渲
    const prevWi = prev.wordPlayInfo.line === prev.lineNum ? prev.wordPlayInfo.wordIndex : -1
    const nextWi = next.wordPlayInfo.line === next.lineNum ? next.wordPlayInfo.wordIndex : -1
    if (prevWi !== nextWi) return false
  }
  if (prev.size !== next.size) return false
  if (prev.textAlign !== next.textAlign) return false
  return true
})

export default WordLrcLine
