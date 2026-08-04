import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { UserCog, UserPlus, Trash2, Loader2, Save, RotateCcw, Mail, ShieldCheck, Users as UsersIcon, KeyRound } from 'lucide-react';

import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ROLES, ROLE_PERMISSIONS, setRolePermissions, logAudit } from '@/lib/gym';
import InviteStaffDialog from '@/components/gym/InviteStaffDialog';
import RolesMatrix from '@/components/gym/RolesMatrix';

const ROLE_TONE = {
  owner: 'bg-primary/15 text-primary',
  admin: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  reception: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
};

const STAT_TONE = {
  primary: 'bg-primary/10 text-primary',
  info: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
};

function RoleStat({ icon: Icon, label, value, tone }) {
  return (
    <div className="glass-card flex items-center gap-3 rounded-2xl p-3.5">
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${STAT_TONE[tone]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-lg font-bold leading-none tnum text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const { settings, setSettings } = useOutletContext();
  const { user: me } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [perms, setPerms] = useState({ admin: [...(ROLE_PERMISSIONS.admin || [])], reception: [...(ROLE_PERMISSIONS.reception || [])] });
  const [saving, setSaving] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const u = await db.entities.User.list('-created_date', 100);
      setUsers(u);
    } catch (e) {
      toast({ title: 'Failed to load users', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  useEffect(() => {
    const s = settings?.role_permissions;
    setPerms({
      admin: Array.isArray(s?.admin) ? [...s.admin] : [...(ROLE_PERMISSIONS.admin || [])],
      reception: Array.isArray(s?.reception) ? [...s.reception] : [...(ROLE_PERMISSIONS.reception || [])],
    });
  }, [settings]);

  const changeRole = async (u, role) => {
    if (u.id === me?.id) { toast({ title: "You can't change your own role", variant: 'destructive' }); return; }
    try {
      await db.entities.User.update(u.id, { role });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, role } : x)));
      toast({ title: 'Role updated' });
      logAudit({ action: 'user.role', entity: 'User', entity_id: u.id, new_value: { role }, reason: `Role set to ${ROLES[role]}` });
    } catch (e) {
      toast({ title: 'Failed to update role', description: e.message, variant: 'destructive' });
    }
  };

  const remove = async (u) => {
    if (u.id === me?.id) { toast({ title: "You can't remove yourself", variant: 'destructive' }); return; }
    if (!window.confirm(`Remove ${u.full_name || u.email} from staff?`)) return;
    try {
      await db.entities.User.delete(u.id);
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      toast({ title: 'User removed' });
    } catch (e) {
      toast({ title: 'Failed to remove user', description: e.message, variant: 'destructive' });
    }
  };

  const invite = async (email, role) => {
    // Note: Supabase admin.inviteUserByEmail requires a service-role key which
    // must NOT be exposed client-side. For production, proxy this through a
    // Supabase Edge Function. For now we use signUp so the user gets an email.
    const { error } = await globalThis.db.supabase.auth.signUp({
      email,
      password: Math.random().toString(36).slice(2) + 'Aa1!', // temp password
      options: {
        data: { role },
        emailRedirectTo: `${window.location.origin}/reset-password`,
      },
    });
    if (error) throw new Error(error.message);
    toast({ title: 'Invitation sent', description: `${email} invited as ${ROLES[role]}. They'll receive a confirmation email.` });
    setInviteOpen(false);
    loadUsers();
  };

  const savePerms = async () => {
    if (!settings?.id) {
      toast({ title: 'Settings not loaded', description: 'Please wait a moment and try again.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const saved = await db.entities.Setting.update(settings.id, { ...settings, role_permissions: perms });
      setSettings(saved);
      setRolePermissions(perms);
      await logAudit({ action: 'roles.update', entity: 'Setting', entity_id: settings.id, new_value: perms, reason: 'Role permissions updated' });
      toast({ title: 'Permissions saved' });
    } catch (e) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const resetPerms = () => setPerms({ admin: [...ROLE_PERMISSIONS.admin], reception: [...ROLE_PERMISSIONS.reception] });

  const counts = users.reduce((acc, u) => {
    const r = u.role || 'reception';
    acc[r] = (acc[r] || 0) + 1;
    return acc;
  }, { owner: 0, admin: 0, reception: 0 });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <UserCog className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Users & Roles</h1>
          <p className="text-sm text-muted-foreground">Invite staff and control what each role can access</p>
        </div>
      </div>

      {/* role summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <RoleStat icon={UsersIcon} label="Total staff" value={users.length} tone="primary" />
        <RoleStat icon={ShieldCheck} label="Owners" value={counts.owner} tone="primary" />
        <RoleStat icon={KeyRound} label="Admins" value={counts.admin} tone="info" />
        <RoleStat icon={UserCog} label="Reception" value={counts.reception} tone="warning" />
      </div>

      <Tabs defaultValue="staff">
        <TabsList>
          <TabsTrigger value="staff">Staff <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 text-xs font-semibold text-primary tnum">{users.length}</span></TabsTrigger>
          <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
        </TabsList>

        {/* Staff tab */}
        <TabsContent value="staff" className="mt-5">
          <div className="mb-4 flex justify-end">
            <Button onClick={() => setInviteOpen(true)}><UserPlus className="mr-2 h-4 w-4" /> Invite staff</Button>
          </div>
          <div className="glass-card rounded-2xl">
            {loading ? (
              <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : users.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <UserPlus className="h-7 w-7" />
                </div>
                <h3 className="font-heading text-base font-semibold text-foreground">No staff yet</h3>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">Invite your first team member to start managing the gym together.</p>
                <Button className="mt-5" onClick={() => setInviteOpen(true)}><UserPlus className="mr-2 h-4 w-4" /> Invite staff</Button>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {users.map((u) => {
                  const role = u.role || 'reception';
                  const isMe = u.id === me?.id;
                  const isOwner = role === 'owner';
                  return (
                    <li key={u.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-fuchsia-500 text-sm font-semibold text-primary-foreground">
                          {(u.full_name || u.email || '?').slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {u.full_name || '(no name)'} {isMe && <span className="text-xs font-normal text-muted-foreground">(you)</span>}
                          </p>
                          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground"><Mail className="h-3 w-3" /> {u.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${ROLE_TONE[role] || ROLE_TONE.reception}`}>{ROLES[role]}</span>
                        <Select value={role} onValueChange={(r) => changeRole(u, r)} disabled={isMe || isOwner}>
                          <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="reception">{ROLES.reception}</SelectItem>
                            <SelectItem value="admin">{ROLES.admin}</SelectItem>
                            <SelectItem value="owner">{ROLES.owner}</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" disabled={isMe} onClick={() => remove(u)} aria-label="Remove user">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </TabsContent>

        {/* Roles tab */}
        <TabsContent value="roles" className="mt-5">
          <div className="glass-card rounded-2xl p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-heading text-base font-bold text-foreground">Role permissions</h3>
                <p className="text-xs text-muted-foreground">Owner always has full access. Toggle what Admin and Reception can do.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={resetPerms}><RotateCcw className="mr-1.5 h-4 w-4" /> Reset to defaults</Button>
            </div>
            <RolesMatrix perms={perms} onChange={setPerms} />
            <div className="mt-5 flex justify-end">
              <Button onClick={savePerms} disabled={saving || !settings?.id}>
                <Save className="mr-2 h-4 w-4" /> {saving ? 'Saving…' : 'Save permissions'}
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <InviteStaffDialog open={inviteOpen} onOpenChange={setInviteOpen} onInvited={invite} />
    </div>
  );
}