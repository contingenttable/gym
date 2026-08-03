import React from 'react';
import { Lock } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { PERMISSION_GROUPS } from '@/lib/gym';

const EDITABLE_ROLES = ['admin', 'reception'];

export default function RolesMatrix({ perms, onChange }) {
  const toggle = (role, key) => {
    const cur = Array.isArray(perms[role]) ? perms[role] : [];
    const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
    onChange({ ...perms, [role]: next });
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="py-2 pr-4 font-medium text-muted-foreground">Permission</th>
            <th className="px-3 py-2 text-center font-medium">
              <span className="flex flex-col items-center text-foreground">Owner <Lock className="mt-0.5 h-3 w-3 text-muted-foreground" /></span>
            </th>
            <th className="px-3 py-2 text-center font-medium text-foreground">Admin / Manager</th>
            <th className="px-3 py-2 text-center font-medium text-foreground">Reception</th>
          </tr>
        </thead>
        <tbody>
          {PERMISSION_GROUPS.map((g) => (
            <React.Fragment key={g.group}>
              <tr>
                <td colSpan={4} className="pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g.group}</td>
              </tr>
              {g.perms.map((p) => (
                <tr key={p.key} className="border-b border-border/50">
                  <td className="py-2 pr-4 text-foreground">{p.label}</td>
                  <td className="px-3 py-2 text-center"><Switch checked disabled /></td>
                  {EDITABLE_ROLES.map((role) => (
                    <td key={role} className="px-3 py-2 text-center">
                      <Switch
                        checked={(perms[role] || []).includes(p.key)}
                        onCheckedChange={() => toggle(role, p.key)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}