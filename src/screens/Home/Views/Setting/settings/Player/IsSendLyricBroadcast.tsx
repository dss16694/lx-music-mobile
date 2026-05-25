import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { memo } from 'react'
import { View } from 'react-native'
import { useSettingValue } from '@/store/setting/hook'

import CheckBoxItem from '../../components/CheckBoxItem'
import { enableLyricBroadcast } from '@/core/desktopLyric'

export default memo(() => {
  const t = useI18n()
  const isSendLyricBroadcast = useSettingValue('player.isSendLyricBroadcast')
  const setSendLyricBroadcast = (isSend: boolean) => {
    updateSetting({ 'player.isSendLyricBroadcast': isSend })
    void enableLyricBroadcast(isSend)
  }

  return (
    <View style={styles.content}>
      <CheckBoxItem check={isSendLyricBroadcast} onChange={setSendLyricBroadcast} label={t('setting_play_send_lyric_broadcast')} />
    </View>
  )
})


const styles = createStyle({
  content: {
    marginTop: 5,
  },
})
