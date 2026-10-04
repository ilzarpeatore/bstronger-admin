import type { MenuItem, ChildItem } from './sidebaritems'

/** Ruta de la bandeja de chat; la entrada del sidebar que lleva el badge. */
export const CHAT_URL = '/chat'

/**
 * Pinta el número de mensajes sin leer sobre la entrada «Chat» del sidebar.
 *
 * Va aparte de `sidebaritems` (que es estático) y aparte del componente, para
 * que sea una función pura y se pueda probar sin montar nada. Mismo patrón que
 * `filterSidebarByPermission`.
 *
 * El contador que llega ya viene filtrado por el backend: un coach solo suma
 * los hilos de sus clientes (GET admin/chat/unread-count usa el scope
 * visibleTo). Aquí no se decide quién ve qué.
 */
function decorate(item: ChildItem, count: number): ChildItem {
  if (item.items?.length) {
    return { ...item, items: item.items.map((child) => decorate(child, count)) }
  }

  if (item.url !== CHAT_URL) return item

  if (count <= 0) {
    // Sin pendientes no se pinta nada: un «0» permanente es ruido.
    return { ...item, badge: false, badgeContent: undefined }
  }

  return {
    ...item,
    badge: true,
    badgeType: 'filled',
    badgeContent: count > 99 ? '99+' : String(count),
  }
}

export function withChatUnreadBadge(menu: MenuItem[], count: number): MenuItem[] {
  return menu.map((section) =>
    section.items ? { ...section, items: section.items.map((item) => decorate(item, count)) } : section,
  )
}
