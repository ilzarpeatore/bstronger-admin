import { describe, it, expect } from 'vitest';
import { filterSidebarByPermission } from './filterSidebarByPermission';
import type { MenuItem } from './sidebaritems';

function buildMenu(): MenuItem[] {
  return [
    {
      heading: 'Configuración',
      items: [
        { id: 1, name: 'Ajustes', url: '/settings' },
        {
          id: 2,
          name: 'Seguridad',
          items: [
            { id: 21, name: 'Roles', url: '/roles', requiredPermission: 'roles' },
            { id: 22, name: 'Permisos', url: '/permissions', requiredPermission: 'permissions' },
            { id: 23, name: 'Historial de inicio de sesión', url: '/admin-login-history' },
          ],
        },
      ],
    },
    {
      heading: 'Solo restringido',
      items: [{ id: 3, name: 'Auditoría', url: '/audit-log', requiredPermission: 'audit-log' }],
    },
  ];
}

describe('filterSidebarByPermission', () => {
  it('keeps every entry for a wildcard super-admin', () => {
    const filtered = filterSidebarByPermission(buildMenu(), () => true);

    expect(filtered).toHaveLength(2);
    const seguridad = filtered[0].items?.find((i) => i.name === 'Seguridad');
    expect(seguridad?.items).toHaveLength(3);
  });

  it('hides gated entries the admin lacks permission for, keeps ungated ones', () => {
    const filtered = filterSidebarByPermission(buildMenu(), (permission) => permission === 'roles');

    const seguridad = filtered[0].items?.find((i) => i.name === 'Seguridad');
    const names = seguridad?.items?.map((i) => i.name);

    expect(names).toContain('Roles');
    expect(names).toContain('Historial de inicio de sesión');
    expect(names).not.toContain('Permisos');
  });

  it('drops a whole top-level section when every one of its items is filtered out', () => {
    const filtered = filterSidebarByPermission(buildMenu(), () => false);

    expect(filtered.find((s) => s.heading === 'Solo restringido')).toBeUndefined();
  });

  it('never crashes when hasPermission is based on an empty/undefined permissions array', () => {
    expect(() => filterSidebarByPermission(buildMenu(), () => false)).not.toThrow();
  });
});
