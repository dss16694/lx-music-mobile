import { View } from 'react-native'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import CheckBox from '@/components/common/CheckBox'
import styles from './style'


export default () => {
  const t = useI18n()
  const isShowWordLyric = useSettingValue('playDetail.isShowWordLyric')
  const setShowWordLyric = (value: boolean) => {
    updateSetting({ 'playDetail.isShowWordLyric': value })
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <CheckBox marginBottom={3} check={isShowWordLyric} label={t('play_detail_setting_show_word_lyric')} onChange={setShowWordLyric} />
      </View>
    </View>
  )
}
