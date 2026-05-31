import musicSdk from '@/utils/musicSdk'
import { toNewMusicInfo } from '@/utils'
import { addTempPlayList } from '@/core/player/tempPlayList'
import { playNext } from '@/core/player/player'
import playerState from '@/store/player/state'
import { LIST_IDS } from '@/config/constant'
import { playSonglist } from '@/core/init/deeplink/playSonglist'
import { navigations } from '@/navigation'
import commonState from '@/store/common/state'
import type { ListInfoItem } from '@/store/songlist/state'
import type { BroadcastPlayData } from './index'

const VALID_SOURCES: LX.OnlineSource[] = ['kg', 'tx', 'mg', 'wy', 'kw']

const isValidSource = (source?: string): source is LX.OnlineSource => {
  return source != null && VALID_SOURCES.includes(source as LX.OnlineSource)
}

/**
 * 跳转到歌单详情页面
 */
const navigateToSonglistDetail = (info: ListInfoItem) => {
  const homeComponentId = commonState.componentIds.home
  if (!homeComponentId) return
  navigations.pushSonglistDetailScreen(homeComponentId, info)
}

/**
 * 通过广播搜索并播放歌曲
 * 使用歌曲名、歌手、专辑信息在指定平台或全平台搜索，找到后播放
 */
export const handleBroadcastSearchPlay = async(data: BroadcastPlayData) => {
  const { name, singer, albumName, source, playLater } = data
  if (!name) return

  try {
    let musicList: any[] = []

    if (isValidSource(source)) {
      // 在指定平台搜索
      const sdk = musicSdk[source]
      if (sdk?.musicSearch) {
        const keyword = `${name} ${singer || ''}`.trim()
        const result = await sdk.musicSearch.search(keyword, 1, 30)
        if (result?.list?.length) {
          musicList = result.list
        }
      }
    } else {
      // 全平台搜索（使用 findMusic 进行精确匹配）
      const { findMusic } = await import('@/utils/musicSdk')
      const results = await findMusic({
        name,
        singer: singer || '',
        albumName: albumName || '',
        interval: '',
        source: 'local',
      })
      if (results.length) {
        musicList = results
      }
    }

    if (!musicList.length) {
      console.log('broadcast play: music not found -', name, singer)
      return
    }

    // 如果指定了平台搜索，尝试精确匹配歌手和歌名
    let targetMusic = musicList[0]
    if (isValidSource(source) && singer) {
      const matched = musicList.find((item: any) => {
        const itemName = (item.name || '').toLowerCase()
        const itemSinger = (item.singer || '').toLowerCase()
        return itemName.includes(name.toLowerCase()) && itemSinger.includes(singer.toLowerCase())
      })
      if (matched) targetMusic = matched
    }

    const musicInfo = toNewMusicInfo(targetMusic) as LX.Music.MusicInfoOnline
    const isPlaying = !!playerState.playMusicInfo.musicInfo

    if (playLater) {
      addTempPlayList([{ listId: LIST_IDS.PLAY_LATER, musicInfo }])
    } else {
      addTempPlayList([{ listId: LIST_IDS.PLAY_LATER, musicInfo, isTop: true }])
      if (isPlaying) void playNext()
    }

    console.log('broadcast play: playing -', musicInfo.name, musicInfo.singer)
  } catch (err) {
    console.error('broadcast play error:', err)
  }
}

/**
 * 通过广播播放歌单（按歌单ID）
 * 使用歌单ID和平台信息获取歌单详情并播放，同时跳转到歌单详情页
 */
export const handleBroadcastSonglistPlay = async(data: BroadcastPlayData) => {
  const { songlistId, songlistSource } = data
  if (!songlistId || !isValidSource(songlistSource)) return

  try {
    const source = songlistSource as LX.OnlineSource

    // 跳转到歌单详情页
    navigateToSonglistDetail({
      id: songlistId,
      author: '',
      name: '',
      source,
    })

    await playSonglist(source, songlistId)
    console.log('broadcast play: playing songlist -', songlistSource, songlistId)
  } catch (err) {
    console.error('broadcast play songlist error:', err)
  }
}

/**
 * 通过广播按关键字搜索歌单并播放
 * 例如传入 "轻柔的音乐"、"睡前轻音乐"、"跑步歌单" 等关键字
 * 会在指定平台或默认平台搜索歌单，找到第一个匹配的歌单后播放，同时跳转到歌单详情页
 */
export const handleBroadcastKeywordSonglistPlay = async(data: BroadcastPlayData) => {
  const { keyword, source } = data
  if (!keyword) return

  try {
    const searchSource: LX.OnlineSource = isValidSource(source) ? source : 'kw'
    const sdk = musicSdk[searchSource]

    if (!sdk?.songList?.search) {
      console.log('broadcast play: songlist search not supported for source -', searchSource)
      return
    }

    const result = await (sdk.songList.search(keyword, 1, 20) as Promise<{
      list: Array<{ id: string, name: string, author?: string, img?: string, play_count?: string, source: LX.OnlineSource }>
      total: number
    }>)

    if (!result?.list?.length) {
      console.log('broadcast play: songlist not found for keyword -', keyword)
      return
    }

    // 取第一个搜索结果的歌单进行播放
    const targetSonglist = result.list[0]
    console.log('broadcast play: found songlist -', targetSonglist.name, 'from', searchSource)

    // 跳转到歌单详情页
    navigateToSonglistDetail({
      id: targetSonglist.id,
      author: targetSonglist.author || '',
      name: targetSonglist.name || '',
      img: targetSonglist.img,
      play_count: targetSonglist.play_count,
      source: searchSource,
    })

    await playSonglist(searchSource, targetSonglist.id)
    console.log('broadcast play: playing keyword songlist -', keyword, searchSource)
  } catch (err) {
    console.error('broadcast play keyword songlist error:', err)
  }
}
