import { useParams } from 'react-router'
import MealPlanTemplateDetailView from './MealPlanTemplateDetailView'

export default function MealPlanTemplateDetailPage() {
  const params = useParams()
  return <MealPlanTemplateDetailView templateId={params.id as string} />
}
