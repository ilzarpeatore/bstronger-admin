import { useParams } from 'react-router'
import UserDetailView from './UserDetailView'

export default function UserDetailPage() {
  const params = useParams()
  return <UserDetailView userId={params.id as string} tab={params.tab} />
}
