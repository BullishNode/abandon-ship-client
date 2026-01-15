import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card'

export default function IndexPage() {
  const { t } = useTranslation()

  return (
    <Card className="min-w-sm shadow-none ring-0">
      <CardHeader>
        <CardTitle className="text-center font-bold text-3xl">
          {t('welcome.title')}
        </CardTitle>
        <CardDescription className="text-pretty text-center text-foreground text-lg">
          {t('welcome.description')}
        </CardDescription>
      </CardHeader>
      <CardFooter className="flex-col gap-2">
        <Button asChild className="w-full">
          <Link to="/create">{t('onboarding.create')}</Link>
        </Button>
        <Button asChild className="w-full" variant="outline">
          <Link to="/import">{t('onboarding.import')}</Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
