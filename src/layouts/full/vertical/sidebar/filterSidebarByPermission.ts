import type { MenuItem, ChildItem } from './sidebaritems'

/**
 * Recursively drops sidebar entries (and nested entries) whose
 * `requiredPermission` the current admin lacks, using the same
 * `hasPermission` check the route guards use (RequirePermission).
 *
 * - An item with no `requiredPermission` is always kept.
 * - An item with children (`items`) is kept only if at least one child
 *   survives filtering, or it has its own `url` (a clickable parent).
 * - A top-level section is dropped entirely if all of its items were
 *   filtered out, so no empty group heading is left behind.
 */
export function filterSidebarByPermission(
  menu: MenuItem[],
  hasPermission: (permission: string) => boolean,
): MenuItem[] {
  const isAllowed = (item: ChildItem) =>
    !item.requiredPermission || hasPermission(item.requiredPermission)

  const filterChildren = (items: ChildItem[]): ChildItem[] =>
    items
      .filter(isAllowed)
      .map((item) => (item.items ? { ...item, items: filterChildren(item.items) } : item))
      .filter((item) => !item.items || item.items.length > 0 || !!item.url)

  return menu
    .map((section) => (section.items ? { ...section, items: filterChildren(section.items) } : section))
    .filter((section) => !section.items || section.items.length > 0)
}
