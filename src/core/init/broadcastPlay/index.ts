import { NativeEventEmitter, NativeModules } from 'react-native'
import { handleBroadcastSearchPlay, handleBroadcastSonglistPlay, handleBroadcastKeywordSonglistPlay } from './action'

const { UtilsModule } = NativeModules

export interface BroadcastPlayData {
  /** 歌曲名 */
  name?: string
  /** 歌手 */
  singer?: string
  /** 专辑名 */
  albumName?: string
  /** 音乐平台: kg | tx | mg | wy | kw */
  source?: string
  /** 歌单ID（用于按ID播放歌单） */
  songlistId?: string
  /** 歌单来源平台 */
  songlistSource?: string
  /** 歌单搜索关键字（如"轻柔的音乐"、"跑步歌单"等） */
  keyword?: string
  /** 是否添加到稍后播放（而非立即播放） */
  playLater?: boolean
}

export const initBroadcastPlay = () => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const eventEmitter = new NativeEventEmitter(UtilsModule)
  eventEmitter.addListener('broadcast-play-music', (data: BroadcastPlayData) => {
    console.log('broadcast-play-music received:', data)
    if (data.songlistId && data.songlistSource) {
      // 按歌单ID播放
      void handleBroadcastSonglistPlay(data)
    } else if (data.keyword) {
      // 按关键字搜索歌单并播放
      void handleBroadcastKeywordSonglistPlay(data)
    } else if (data.name) {
      // 按歌曲名搜索并播放
      void handleBroadcastSearchPlay(data)
    }
  })
}
