import { useEffect, useMemo, useState } from 'react';
import {
  addTeamMember,
  fetchTeamMembers,
  fetchUsers,
  removeTeamMember,
  updateTeamMember,
  type TeamMember,
  type TeamRef,
  type UserRef
} from '../api/client';
import type { Role } from '../types';

const TEAM_ROLES = ['AGENT', 'LEAD', 'ADMIN'];

export function TeamPage({
  refreshKey,
  teamsList,
  role
}: {
  refreshKey: number;
  teamsList: TeamRef[];
  role: Role;
}) {
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);

  const [allUsers, setAllUsers] = useState<UserRef[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [newMemberId, setNewMemberId] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('AGENT');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const isAdmin = role === 'OWNER' || role === 'TEAM_ADMIN';
  const isOwner = role === 'OWNER';

  useEffect(() => {
    if (!isAdmin) {
      return;
    }
    loadUsers();
  }, [isAdmin]);

  useEffect(() => {
    if (!selectedTeamId) {
      setMembers([]);
      return;
    }
    loadMembers(selectedTeamId);
  }, [selectedTeamId, refreshKey]);

  useEffect(() => {
    if (!selectedTeamId) {
      return;
    }
    const exists = teamsList.some((team) => team.id === selectedTeamId);
    if (!exists) {
      setSelectedTeamId('');
    }
  }, [teamsList, selectedTeamId]);

  async function loadUsers() {
    setLoadingUsers(true);
    setActionError(null);
    try {
      const response = await fetchUsers();
      setAllUsers(response.data);
    } catch (error) {
      setActionError('Unable to load users.');
    } finally {
      setLoadingUsers(false);
    }
  }

  async function loadMembers(teamId: string) {
    setLoadingMembers(true);
    setMemberError(null);
    try {
      const response = await fetchTeamMembers(teamId);
      setMembers(response.data);
    } catch (error) {
      setMemberError('Unable to load team members.');
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  }

  async function handleAddMember() {
    if (!selectedTeamId || !newMemberId) {
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      await addTeamMember(selectedTeamId, { userId: newMemberId, role: newMemberRole });
      setNewMemberId('');
      await loadMembers(selectedTeamId);
    } catch (error) {
      setActionError('Unable to add team member.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRoleChange(member: TeamMember, roleValue: string) {
    if (!selectedTeamId) {
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      await updateTeamMember(selectedTeamId, member.id, { role: roleValue });
      setMembers((prev) =>
        prev.map((item) => (item.id === member.id ? { ...item, role: roleValue } : item))
      );
    } catch (error) {
      setActionError('Unable to update member role.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRemove(member: TeamMember) {
    if (!selectedTeamId) {
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      await removeTeamMember(selectedTeamId, member.id);
      setMembers((prev) => prev.filter((item) => item.id !== member.id));
    } catch (error) {
      setActionError('Unable to remove team member.');
    } finally {
      setActionLoading(false);
    }
  }

  const availableUsers = useMemo(() => {
    if (!isAdmin) {
      return [];
    }
    const existingUserIds = new Set(members.map((member) => member.user.id));
    return allUsers.filter((user) => !existingUserIds.has(user.id));
  }, [allUsers, members, isAdmin]);

  return (
    <section className="mt-8 space-y-6 animate-fade-in">
      <div className="glass-card p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Team directory</h3>
            <p className="text-sm text-slate-500">View and manage team membership.</p>
          </div>
          {!isAdmin && (
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-500">
              Read-only access
            </span>
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <select
            className="rounded-full border border-slate-200 bg-white/80 px-3 py-2 text-sm"
            value={selectedTeamId}
            onChange={(event) => setSelectedTeamId(event.target.value)}
          >
            <option value="">Select department</option>
            {teamsList.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
          {memberError && <span className="text-xs text-red-600">{memberError}</span>}
        </div>
      </div>

      {teamsList.length === 0 && (
        <div className="glass-card p-6">
          <p className="text-sm font-semibold text-slate-900">No departments yet</p>
          <p className="text-sm text-slate-500 mt-1">
            {isOwner
              ? 'Create a department to start adding members.'
              : 'No departments available. Contact an owner to create departments.'}
          </p>
        </div>
      )}

      {teamsList.length > 0 && !selectedTeamId && (
        <div className="glass-card p-6">
          <p className="text-sm font-semibold text-slate-900">Select a department</p>
          <p className="text-sm text-slate-500 mt-1">
            Choose a team to view members and manage access.
          </p>
        </div>
      )}

      {selectedTeamId && (
        <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="glass-card p-6">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-900">Members</h4>
              {loadingMembers && <span className="text-xs text-slate-400">Loading…</span>}
            </div>
            <div className="mt-4 space-y-3">
              {loadingMembers && (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div
                      key={`member-skeleton-${index}`}
                      className="rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-2">
                          <div className="h-3 w-28 rounded-full skeleton-shimmer" />
                          <div className="h-3 w-40 rounded-full skeleton-shimmer" />
                        </div>
                        <div className="h-6 w-20 rounded-full skeleton-shimmer" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {members.length === 0 && !loadingMembers && (
                <p className="text-sm text-slate-500">No members found.</p>
              )}
              {members.map((member) => (
                <div
                  key={member.id}
                  className="rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{member.user.displayName}</p>
                      <p className="text-xs text-slate-500">{member.user.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs"
                        value={member.role}
                        onChange={(event) => handleRoleChange(member, event.target.value)}
                        disabled={!isAdmin || actionLoading}
                      >
                        {TEAM_ROLES.map((teamRole) => (
                          <option key={teamRole} value={teamRole}>
                            {teamRole}
                          </option>
                        ))}
                      </select>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleRemove(member)}
                          disabled={actionLoading}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-6">
            <h4 className="text-sm font-semibold text-slate-900">Add member</h4>
            <p className="text-xs text-slate-500">Invite an existing user to this team.</p>
            {!isAdmin && (
              <p className="mt-3 text-xs text-slate-500">
                Admin access is required to manage memberships.
              </p>
            )}
            {isAdmin && (
              <div className="mt-4 space-y-3">
                <select
                  className="w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-700"
                  value={newMemberId}
                  onChange={(event) => setNewMemberId(event.target.value)}
                  disabled={loadingUsers || actionLoading}
                >
                  <option value="">{loadingUsers ? 'Loading users…' : 'Select user'}</option>
                  {availableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.displayName} ({user.email})
                    </option>
                  ))}
                </select>
                {loadingUsers && (
                  <div className="rounded-xl border border-slate-200/70 bg-white/80 p-3">
                    <div className="h-3 w-32 rounded-full skeleton-shimmer" />
                    <div className="mt-2 h-3 w-24 rounded-full skeleton-shimmer" />
                  </div>
                )}
                <select
                  className="w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-700"
                  value={newMemberRole}
                  onChange={(event) => setNewMemberRole(event.target.value)}
                  disabled={actionLoading}
                >
                  {TEAM_ROLES.map((teamRole) => (
                    <option key={teamRole} value={teamRole}>
                      {teamRole}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddMember}
                  disabled={!newMemberId || actionLoading}
                  className="w-full rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Add member
                </button>
                {actionError && <p className="text-xs text-red-600">{actionError}</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
