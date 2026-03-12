"use client";

export const dynamic = "force-dynamic";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { useAuth } from "@/auth/clerk";

import { ApiError } from "@/api/mutator";
import {
  type getAgentApiV1AgentsAgentIdGetResponse,
  useGetAgentApiV1AgentsAgentIdGet,
  useUpdateAgentApiV1AgentsAgentIdPatch,
} from "@/api/generated/agents/agents";
import {
  type listBoardsApiV1BoardsGetResponse,
  useListBoardsApiV1BoardsGet,
} from "@/api/generated/boards/boards";
import {
  type listBoardGroupsApiV1BoardGroupsGetResponse,
  useListBoardGroupsApiV1BoardGroupsGet,
} from "@/api/generated/board-groups/board-groups";
import type {
  AgentRead,
  AgentUpdate,
  BoardRead,
  BoardGroupRead,
} from "@/api/generated/model";
import { DashboardPageLayout } from "@/components/templates/DashboardPageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SearchableSelect, {
  type SearchableSelectOption,
} from "@/components/ui/searchable-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AGENT_EMOJI_OPTIONS } from "@/lib/agent-emoji";
import { DEFAULT_IDENTITY_PROFILE } from "@/lib/agent-templates";

type IdentityProfile = {
  role: string;
  communication_style: string;
  emoji: string;
};

const getBoardOptions = (boards: BoardRead[]): SearchableSelectOption[] =>
  boards.map((board) => ({
    value: board.id,
    label: board.name,
  }));

const mergeIdentityProfile = (
  existing: unknown,
  patch: IdentityProfile,
): Record<string, unknown> | null => {
  const resolved: Record<string, unknown> =
    existing && typeof existing === "object"
      ? { ...(existing as Record<string, unknown>) }
      : {};
  const updates: Record<string, string> = {
    role: patch.role.trim(),
    communication_style: patch.communication_style.trim(),
    emoji: patch.emoji.trim(),
  };
  for (const [key, value] of Object.entries(updates)) {
    if (value) {
      resolved[key] = value;
    } else {
      delete resolved[key];
    }
  }
  return Object.keys(resolved).length > 0 ? resolved : null;
};

const withIdentityDefaults = (
  profile: Partial<IdentityProfile> | null | undefined,
): IdentityProfile => ({
  role: profile?.role ?? DEFAULT_IDENTITY_PROFILE.role,
  communication_style:
    profile?.communication_style ??
    DEFAULT_IDENTITY_PROFILE.communication_style,
  emoji: profile?.emoji ?? DEFAULT_IDENTITY_PROFILE.emoji,
});

export default function EditAgentPage() {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const params = useParams();
  const agentIdParam = params?.agentId;
  const agentId = Array.isArray(agentIdParam) ? agentIdParam[0] : agentIdParam;

  const [name, setName] = useState<string | undefined>(undefined);
  const [boardId, setBoardId] = useState<string | undefined>(undefined);
  const [isGatewayMain, setIsGatewayMain] = useState<boolean | undefined>(
    undefined,
  );
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | undefined>(
    undefined,
  );
  const [isBoardGroupLead, setIsBoardGroupLead] = useState<
    boolean | undefined
  >(undefined);
  const [boardGroupId, setBoardGroupId] = useState<string | undefined>(
    undefined,
  );
  const [heartbeatEvery, setHeartbeatEvery] = useState<string | undefined>(
    undefined,
  );
  const [identityProfile, setIdentityProfile] = useState<
    IdentityProfile | undefined
  >(undefined);
  const [error, setError] = useState<string | null>(null);

  const boardsQuery = useListBoardsApiV1BoardsGet<
    listBoardsApiV1BoardsGetResponse,
    ApiError
  >(undefined, {
    query: {
      enabled: Boolean(isSignedIn),
      refetchOnMount: "always",
      retry: false,
    },
  });

  const groupsQuery = useListBoardGroupsApiV1BoardGroupsGet<
    listBoardGroupsApiV1BoardGroupsGetResponse,
    ApiError
  >(undefined, {
    query: {
      enabled: Boolean(isSignedIn),
      refetchOnMount: "always",
      retry: false,
    },
  });

  const agentQuery = useGetAgentApiV1AgentsAgentIdGet<
    getAgentApiV1AgentsAgentIdGetResponse,
    ApiError
  >(agentId ?? "", {
    query: {
      enabled: Boolean(isSignedIn && agentId),
      refetchOnMount: "always",
      retry: false,
    },
  });

  const updateMutation = useUpdateAgentApiV1AgentsAgentIdPatch<ApiError>({
    mutation: {
      onSuccess: () => {
        if (agentId) {
          router.push(`/agents/${agentId}`);
        }
      },
      onError: (err) => {
        setError(err.message || "Something went wrong.");
      },
    },
  });

  const boards = useMemo<BoardRead[]>(() => {
    if (boardsQuery.data?.status !== 200) return [];
    return boardsQuery.data.data.items ?? [];
  }, [boardsQuery.data]);
  const boardGroups = useMemo<BoardGroupRead[]>(() => {
    if (groupsQuery.data?.status !== 200) return [];
    return groupsQuery.data.data.items ?? [];
  }, [groupsQuery.data]);
  const loadedAgent: AgentRead | null =
    agentQuery.data?.status === 200 ? agentQuery.data.data : null;
  const loadedAgentFlags = loadedAgent as (AgentRead & {
    is_super_admin?: boolean;
    is_board_group_lead?: boolean;
    board_group_id?: string | null;
  });

  const loadedHeartbeat = useMemo(() => {
    const heartbeat = loadedAgent?.heartbeat_config;
    if (heartbeat && typeof heartbeat === "object") {
      const record = heartbeat as Record<string, unknown>;
      const every = record.every;
      return {
        every: typeof every === "string" && every.trim() ? every : "10m",
      };
    }
    return { every: "10m" };
  }, [loadedAgent?.heartbeat_config]);

  const loadedIdentityProfile = useMemo(() => {
    const identity = loadedAgent?.identity_profile;
    if (identity && typeof identity === "object") {
      const record = identity as Record<string, unknown>;
      return withIdentityDefaults({
        role: typeof record.role === "string" ? record.role : undefined,
        communication_style:
          typeof record.communication_style === "string"
            ? record.communication_style
            : undefined,
        emoji: typeof record.emoji === "string" ? record.emoji : undefined,
      });
    }
    return withIdentityDefaults(null);
  }, [loadedAgent?.identity_profile]);

  const isLoading =
    boardsQuery.isLoading ||
    groupsQuery.isLoading ||
    agentQuery.isLoading ||
    updateMutation.isPending;
  const errorMessage =
    error ??
    agentQuery.error?.message ??
    boardsQuery.error?.message ??
    groupsQuery.error?.message ??
    null;

  const resolvedName = name ?? loadedAgent?.name ?? "";
  const resolvedIsGatewayMain =
    isGatewayMain ?? Boolean(loadedAgent?.is_gateway_main);
  const resolvedIsSuperAdmin =
    isSuperAdmin ?? Boolean(loadedAgentFlags?.is_super_admin);
  const resolvedIsBoardGroupLead =
    isBoardGroupLead ?? Boolean(loadedAgentFlags?.is_board_group_lead);
  const resolvedBoardGroupId =
    boardGroupId ?? loadedAgentFlags?.board_group_id ?? "";
  const resolvedHeartbeatEvery = heartbeatEvery ?? loadedHeartbeat.every;
  const resolvedIdentityProfile = identityProfile ?? loadedIdentityProfile;

  const resolvedBoardId = useMemo(() => {
    if (resolvedIsGatewayMain) return boardId ?? "";
    return boardId ?? loadedAgent?.board_id ?? boards[0]?.id ?? "";
  }, [boardId, boards, loadedAgent?.board_id, resolvedIsGatewayMain]);

  const groupOptions = useMemo(
    () =>
      boardGroups.map((group) => ({
        value: group.id,
        label: group.name,
      })),
    [boardGroups],
  );

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isSignedIn || !agentId || !loadedAgent) return;
    const trimmed = resolvedName.trim();
    if (!trimmed) {
      setError("Agent name is required.");
      return;
    }
    if (!resolvedIsGatewayMain && !resolvedBoardId) {
      setError("Select a board or mark this agent as the gateway main.");
      return;
    }
    if (resolvedIsBoardGroupLead && !resolvedBoardGroupId) {
      setError("Select a board group for board-group leads.");
      return;
    }
    if (
      resolvedIsGatewayMain &&
      !resolvedBoardId &&
      !loadedAgent.is_gateway_main &&
      !loadedAgent.board_id
    ) {
      setError(
        "Select a board once so we can resolve the gateway main session key.",
      );
      return;
    }
    setError(null);

    const existingHeartbeat =
      loadedAgent.heartbeat_config &&
      typeof loadedAgent.heartbeat_config === "object"
        ? (loadedAgent.heartbeat_config as Record<string, unknown>)
        : {};

    const payload: AgentUpdate = {
      name: trimmed,
      heartbeat_config: {
        ...existingHeartbeat,
        every: resolvedHeartbeatEvery.trim() || "10m",
        target: "last",
        includeReasoning:
          typeof existingHeartbeat.includeReasoning === "boolean"
            ? existingHeartbeat.includeReasoning
            : false,
      } as unknown as Record<string, unknown>,
      identity_profile: mergeIdentityProfile(
        loadedAgent.identity_profile,
        resolvedIdentityProfile,
      ) as unknown as Record<string, unknown> | null,
    };
    (payload as AgentUpdate & {
      is_super_admin?: boolean;
      is_board_group_lead?: boolean;
      board_group_id?: string | null;
    }).is_super_admin = resolvedIsSuperAdmin;
    (payload as AgentUpdate & {
      is_super_admin?: boolean;
      is_board_group_lead?: boolean;
      board_group_id?: string | null;
    }).is_board_group_lead = resolvedIsBoardGroupLead;
    (payload as AgentUpdate & {
      is_super_admin?: boolean;
      is_board_group_lead?: boolean;
      board_group_id?: string | null;
    }).board_group_id = resolvedIsBoardGroupLead
      ? resolvedBoardGroupId || null
      : null;
    if (!resolvedIsGatewayMain) {
      payload.board_id = resolvedBoardId || null;
    } else if (resolvedBoardId) {
      payload.board_id = resolvedBoardId;
    }
    if (Boolean(loadedAgent.is_gateway_main) !== resolvedIsGatewayMain) {
      payload.is_gateway_main = resolvedIsGatewayMain;
    }

    updateMutation.mutate({ agentId, params: { force: true }, data: payload });
  };

  return (
    <DashboardPageLayout
      signedOut={{
        message: "Sign in to edit agents.",
        forceRedirectUrl: `/agents/${agentId}/edit`,
        signUpForceRedirectUrl: `/agents/${agentId}/edit`,
      }}
      title={
        resolvedName.trim() ? resolvedName : (loadedAgent?.name ?? "Edit agent")
      }
      description="Status is controlled by agent heartbeat."
    >
      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Basic configuration
          </p>
          <div className="mt-4 space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">
                  Agent name <span className="text-red-500">*</span>
                </label>
                <Input
                  value={resolvedName}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Deploy bot"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">
                  Role
                </label>
                <Input
                  value={resolvedIdentityProfile.role}
                  onChange={(event) =>
                    setIdentityProfile({
                      ...resolvedIdentityProfile,
                      role: event.target.value,
                    })
                  }
                  placeholder="e.g. Founder, Social Media Manager"
                  disabled={isLoading}
                />
              </div>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-900">
                    Board
                    {resolvedIsGatewayMain ? (
                      <span className="ml-2 text-xs font-normal text-slate-500">
                        optional
                      </span>
                    ) : (
                      <span className="text-red-500"> *</span>
                    )}
                  </label>
                  {resolvedBoardId ? (
                    <button
                      type="button"
                      className="text-xs font-medium text-slate-600 hover:text-slate-900"
                      onClick={() => {
                        setBoardId("");
                      }}
                      disabled={isLoading}
                    >
                      Clear board
                    </button>
                  ) : null}
                </div>
                <SearchableSelect
                  ariaLabel="Select board"
                  value={resolvedBoardId}
                  onValueChange={(value) => setBoardId(value)}
                  options={getBoardOptions(boards)}
                  placeholder={
                    resolvedIsGatewayMain
                      ? "No board (main agent)"
                      : "Select board"
                  }
                  searchPlaceholder="Search boards..."
                  emptyMessage="No matching boards."
                  triggerClassName="w-full h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  contentClassName="rounded-xl border border-slate-200 shadow-lg"
                  itemClassName="px-4 py-3 text-sm text-slate-700 data-[selected=true]:bg-slate-50 data-[selected=true]:text-slate-900"
                  disabled={boards.length === 0}
                />
                {resolvedIsGatewayMain ? (
                  <p className="text-xs text-slate-500">
                    Main agents are not attached to a board. If a board is
                    selected, it is only used to resolve the gateway main
                    session key and will be cleared on save.
                  </p>
                ) : boards.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Create a board before assigning agents.
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">
                  Emoji
                </label>
                <Select
                  value={resolvedIdentityProfile.emoji}
                  onValueChange={(value) =>
                    setIdentityProfile({
                      ...resolvedIdentityProfile,
                      emoji: value,
                    })
                  }
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select emoji" />
                  </SelectTrigger>
                  <SelectContent>
                    {AGENT_EMOJI_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.glyph} {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="mt-6 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
            <label className="flex items-start gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-200"
                checked={resolvedIsGatewayMain}
                onChange={(event) => setIsGatewayMain(event.target.checked)}
                disabled={isLoading}
              />
              <span>
                <span className="block font-medium text-slate-900">
                  Gateway main agent
                </span>
                <span className="block text-xs text-slate-500">
                  Uses the gateway main session key and is not tied to a single
                  board.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-200"
                checked={resolvedIsSuperAdmin}
                onChange={(event) => setIsSuperAdmin(event.target.checked)}
                disabled={isLoading}
              />
              <span>
                <span className="block font-medium text-slate-900">
                  Super admin
                </span>
                <span className="block text-xs text-slate-500">
                  Can create agents and manage board-group leadership.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-200"
                checked={resolvedIsBoardGroupLead}
                onChange={(event) => setIsBoardGroupLead(event.target.checked)}
                disabled={isLoading}
              />
              <span>
                <span className="block font-medium text-slate-900">
                  Board-group lead
                </span>
                <span className="block text-xs text-slate-500">
                  Can create boards and manage tasks within their group.
                </span>
              </span>
            </label>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-900">
                Board group
              </label>
              <SearchableSelect
                ariaLabel="Select board group"
                value={resolvedBoardGroupId}
                onValueChange={(value) => setBoardGroupId(value)}
                options={groupOptions}
                placeholder="Select board group"
                searchPlaceholder="Search groups..."
                emptyMessage="No groups found."
                triggerClassName="w-full h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                contentClassName="rounded-xl border border-slate-200 shadow-lg"
                itemClassName="px-4 py-3 text-sm text-slate-700 data-[selected=true]:bg-slate-50 data-[selected=true]:text-slate-900"
                disabled={!resolvedIsBoardGroupLead || isLoading}
              />
              <p className="text-xs text-slate-500">
                Required when board-group lead is enabled.
              </p>
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Personality & behavior
          </p>
          <div className="mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-900">
                Communication style
              </label>
              <Input
                value={resolvedIdentityProfile.communication_style}
                onChange={(event) =>
                  setIdentityProfile({
                    ...resolvedIdentityProfile,
                    communication_style: event.target.value,
                  })
                }
                disabled={isLoading}
              />
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Schedule & notifications
          </p>
          <div className="mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-900">
                Interval
              </label>
              <Input
                value={resolvedHeartbeatEvery}
                onChange={(event) => setHeartbeatEvery(event.target.value)}
                placeholder="e.g. 10m"
                disabled={isLoading}
              />
              <p className="text-xs text-slate-500">
                Set how often this agent runs HEARTBEAT.md.
              </p>
            </div>
          </div>
        </div>

        {errorMessage ? (
          <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600 shadow-sm">
            {errorMessage}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Saving…" : "Save changes"}
          </Button>
          <Button
            variant="outline"
            type="button"
            onClick={() => router.push(`/agents/${agentId}`)}
          >
            Back to agent
          </Button>
        </div>
      </form>
    </DashboardPageLayout>
  );
}
