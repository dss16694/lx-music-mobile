import Btn from './Btn'
import playerState from '@/store/player/state'
import { getMusicUrl } from '@/core/music'
import { shareText } from '@/utils/nativeModules/utils'
import { toast } from '@/utils/tools'


const escapeXml = (str: string): string => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

const escapeUrl = (url: string): string => {
  return url.replace(/&/g, '&amp;')
}

const formatLyric = (lrc: string | null): string => {
  if (!lrc) return ''
  return escapeXml(lrc).replace(/\n/g, '&#x0A;').replace(/ /g, '&#x20;')
}

const buildShareXml = (title: string, singer: string, dataUrl: string, albumUrl: string, lyric: string): string => {
  const escapedTitle = escapeXml(title)
  const escapedSinger = escapeXml(singer)
  const escapedDataUrl = escapeUrl(dataUrl)
  const escapedAlbumUrl = escapeUrl(albumUrl)
  const formattedLyric = formatLyric(lyric)

  return `<msg><appmsg appid="wx5aa333606550dfd5"><title>${escapedTitle}</title><des>${escapedSinger}</des><action>view</action><type>76</type><url>${escapedDataUrl}</url><dataurl>${escapedDataUrl}</dataurl><statextstr>GhQKEnd4NWFhMzMzNjA2NTUwZGZkNQ==</statextstr><songalbumurl>${escapedAlbumUrl}</songalbumurl><songlyric>${formattedLyric}</songlyric><musicShareItem><mvCoverUrl>${escapedAlbumUrl}</mvCoverUrl><mvSingerName>${escapedSinger}</mvSingerName><mid></mid></musicShareItem><finderLiveProductShare><isPriceBeginShow>false</isPriceBeginShow></finderLiveProductShare><gameshare><appbrandext><priority>-1</priority></appbrandext><duration>-1</duration></gameshare></appmsg></msg>`
}

export default () => {
  const handleShare = async() => {
    const playMusicInfo = playerState.playMusicInfo.musicInfo
    if (!playMusicInfo) return

    const musicInfo = 'progress' in playMusicInfo ? playMusicInfo.metadata.musicInfo : playMusicInfo

    try {
      const url = await getMusicUrl({ musicInfo })
      if (!url) {
        toast(global.i18n.t('player__error_url'))
        return
      }

      const name = playerState.musicInfo.name || musicInfo.name
      const singer = playerState.musicInfo.singer || musicInfo.singer
      const albumUrl = playerState.musicInfo.pic || ''
      const lyric = playerState.musicInfo.lrc || ''
      const xmlContent = buildShareXml(name, singer, url, albumUrl, lyric)

      void shareText(name, singer, xmlContent)
    } catch (err: any) {
      console.log('share error', err)
      toast(global.i18n.t('player__error_url'))
    }
  }

  return <Btn icon="share" onPress={handleShare} />
}
