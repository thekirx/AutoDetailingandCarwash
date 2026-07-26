/**
 * Customer settings — garage-enabled wrapper around shared UserSettingsModal.
 */
import UserSettingsModal from '@/components/UserSettingsModal'

export default function CustomerSettingsModal(props) {
  return <UserSettingsModal {...props} audience="customer" showGarage />
}
