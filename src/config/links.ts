const externalLinks = {
  chat: 'https://chat.second.tech',
  forum: 'https://community.second.tech',
  reportIssues: 'https://gitlab.com/ark-bitcoin/labs/bark-web/-/work_items'
} as const

const footerLinks = {
  chat: {
    i18n: 'links.chat',
    link: externalLinks.chat
  },
  forum: {
    i18n: 'links.forum',
    link: externalLinks.forum
  }
}

export { externalLinks, footerLinks }
