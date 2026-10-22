import AddressBook from '@renderer/components/pages/addressBook/Page'
import { useAuth } from '@renderer/contexts/AuthContext'

export default function AddressBookPage(): React.JSX.Element {
  const { status } = useAuth()
  return <AddressBook key={status?.network ?? 'none'} />
}
