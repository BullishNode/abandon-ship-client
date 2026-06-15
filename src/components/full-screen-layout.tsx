import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import secondLogo from '@/assets/second_logo.svg'
import secondLogoWhite from '@/assets/second_logo_white.svg'
import { footerLinks } from '@/config/links'
import { useResolvedTheme } from '@/hooks/use-resolved-theme'

interface FullScreenLayoutProps {
  children: ReactNode
}

export function FullScreenLayout({ children }: FullScreenLayoutProps) {
  const { t } = useTranslation()
  const logo = useResolvedTheme() === 'dark' ? secondLogoWhite : secondLogo

  return (
    <div className="flex min-h-screen flex-col items-center bg-background">
      <header className="flex justify-center px-6 py-12">
        <div className="flex w-full items-center">
          {/** biome-ignore lint/correctness/useImageSize: second logo */}
          <img alt="Second Logo" className="h-8" src={logo} />
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-lg">{children}</div>
      </main>
      <footer className="flex justify-center px-6 py-12">
        <div className="flex w-full max-w-lg items-center">
          <ul className="flex gap-4">
            {Object.entries(footerLinks).map(([key, { i18n, fallback, link }]) => (
              <li key={key}>
                <a
                  className="text-muted-foreground text-sm hover:text-foreground"
                  href={link}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {t(i18n, fallback)}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </footer>
    </div>
  )
}
