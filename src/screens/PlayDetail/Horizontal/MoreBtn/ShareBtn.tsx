import Btn from './Btn'
import playerState from '@/store/player/state'
import { getMusicUrl } from '@/core/music'
import { shareText } from '@/utils/nativeModules/utils'
import { toast } from '@/utils/tools'


const buildShareXml = (title: string, singer: string, url: string): string => {
  return `<msg><appmsg appid="wx485a97c844086dc9" sdkver="0"><title>${title}</title><des>${singer}</des><action>view</action><type>3</type><showtype>0</showtype><content></content><url>${url}</url><dataurl>${url}</dataurl><lowdataurl>${url}</lowdataurl><thumburl>https://imgcache.qq.com/music/photo/album/300/300_albumpic_default.png</thumburl><appattach><totallen>0</totallen><attachid></attachid><fileext>mp3</fileext></appattach></appmsg><fromusername></fromusername><scene>0</scene><appinfo><version>1</version><appname>KuGou Music</appname></appinfo><commenturl></commenturl></msg>`
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
      const xmlContent = buildShareXml(name, singer, url)

      void shareText(name, singer, xmlContent)
    } catch (err: any) {
      console.log('share error', err)
      toast(global.i18n.t('player__error_url'))
    }
  }

  return <Btn icon="share" onPress={handleShare} />
}
