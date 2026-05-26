import { memo, useMemo } from 'react'

import { StyleSheet, View } from 'react-native'

import SubTitle from '../../components/SubTitle'
import CheckBox from '@/components/common/CheckBox'
import { useSettingValue } from '@/store/setting/hook'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'

type ShareCardType = LX.AppSetting['common.shareCardType']

const setShareCardType = (type: ShareCardType) => {
  updateSetting({ 'common.shareCardType': type })
}


const useActive = (type: ShareCardType) => {
  const shareCardType = useSettingValue('common.shareCardType')
  const isActive = useMemo(() => shareCardType == type, [shareCardType, type])
  return isActive
}

const Item = ({ id, name }: {
  id: ShareCardType
  name: string
}) => {
  const isActive = useActive(id)
  return <CheckBox marginBottom={3} check={isActive} label={name} onChange={() => { setShareCardType(id) }} need />
}

export default memo(() => {
  const t = useI18n()
  const list = useMemo(() => {
    return [
      {
        id: 'kugou',
        name: t('setting_basic_share_card_type_kugou'),
      },
      {
        id: 'netease',
        name: t('setting_basic_share_card_type_netease'),
      },
    ] as const
  }, [t])

  return (
    <SubTitle title={t('setting_basic_share_card_type')}>
      <View style={styles.list}>
        {
          list.map(({ id, name }) => <Item name={name} id={id} key={id} />)
        }
      </View>
    </SubTitle>
  )
})

const styles = StyleSheet.create({
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
})
