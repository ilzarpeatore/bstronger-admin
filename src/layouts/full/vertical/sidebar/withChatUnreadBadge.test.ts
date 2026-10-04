import { describe, it, expect } from 'vitest'
import { withChatUnreadBadge, CHAT_URL } from './withChatUnreadBadge'
import type { MenuItem } from './sidebaritems'

const menu = (): MenuItem[] => [
  {
    heading: 'Principal',
    items: [
      { name: 'Tareas', url: '/tasks' },
      { name: 'Chat', url: CHAT_URL },
    ],
  },
  {
    heading: 'Anidado',
    items: [
      {
        name: 'Grupo',
        items: [{ name: 'Chat anidado', url: CHAT_URL }],
      },
    ],
  },
]

describe('withChatUnreadBadge', () => {
  it('pinta el contador sobre la entrada de chat', () => {
    const [principal] = withChatUnreadBadge(menu(), 3)
    const chat = principal.items!.find((i) => i.url === CHAT_URL)!

    expect(chat.badge).toBe(true)
    expect(chat.badgeContent).toBe('3')
    expect(chat.badgeType).toBe('filled')
  })

  it('no pinta nada cuando no hay mensajes sin leer', () => {
    const [principal] = withChatUnreadBadge(menu(), 0)
    const chat = principal.items!.find((i) => i.url === CHAT_URL)!

    expect(chat.badge).toBe(false)
    expect(chat.badgeContent).toBeUndefined()
  })

  it('corta en 99+ para que no rompa el ancho del sidebar', () => {
    const [principal] = withChatUnreadBadge(menu(), 1250)

    expect(principal.items!.find((i) => i.url === CHAT_URL)!.badgeContent).toBe('99+')
  })

  it('no toca las demas entradas', () => {
    const [principal] = withChatUnreadBadge(menu(), 5)
    const tareas = principal.items!.find((i) => i.url === '/tasks')!

    expect(tareas.badge).toBeUndefined()
  })

  it('tambien alcanza una entrada de chat anidada', () => {
    const anidado = withChatUnreadBadge(menu(), 2)[1]
    const chat = anidado.items![0].items![0]

    expect(chat.badgeContent).toBe('2')
  })

  it('no muta el menu original', () => {
    const original = menu()
    withChatUnreadBadge(original, 7)

    expect(original[0].items!.find((i) => i.url === CHAT_URL)!.badge).toBeUndefined()
  })
})
