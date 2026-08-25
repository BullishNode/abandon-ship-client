const externalLinks = {
  chat: 'https://chat.second.tech',
  forum: 'https://community.second.tech',
  reportIssues: 'https://gitlab.com/ark-bitcoin/labs/bark-web/-/work_items',
  terms: 'https://second.tech/terms'
} as const

const footerLinks = {
  chat: {
    fallback: 'Community chat',
    i18n: 'links.chat',
    link: externalLinks.chat
  },
  forum: {
    fallback: 'Community forum',
    i18n: 'links.forum',
    link: externalLinks.forum
  },
  terms: {
    fallback: 'Terms of service',
    i18n: 'links.terms',
    link: externalLinks.terms
  }
}

export { externalLinks, footerLinks }
