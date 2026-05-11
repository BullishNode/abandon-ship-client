import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import HttpBackend from 'i18next-http-backend'
import { initReactI18next } from 'react-i18next'

void i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    backend: {
      loadPath: '/locales/{{lng}}.json'
    },
    debug: import.meta.env.DEV,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    },
    load: 'languageOnly',
    supportedLngs: ['en']
  })

export default i18n
