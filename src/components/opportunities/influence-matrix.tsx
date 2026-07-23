"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FilterTransparencyBar } from "@/components/ui/filter-transparency-bar";
import { AUTH_ROLE_HEADER } from "@/lib/api-auth";
import { ATTIO_GROUP_ACTIONS } from "@/lib/attio-workspace-surfaces";
import type { UserRole } from "@/types/auth";
import type { FilterSummaryChip } from "@/types/workspace-filters";
import type { InfluenceLevel, SentimentStance } from "@/generated/prisma";

export type InfluenceProfileCard = {
  id: string;
  opportunityId: string;
  contactId: string;
  influenceLevel: InfluenceLevel;
  stance: SentimentStance;
  notes: string | null;
  contact: {
    id: string;
    fullName: string;
    firstName: string | null;
    lastName: string | null;
    jobTitle: string | null;
    email: string;
  };
};

type QuadrantId =
  | "high_blocker"
  | "high_champion"
  | "low_blocker"
  | "low_champion";

const QUADRANTS: Array<{
  id: QuadrantId;
  title: string;
  subtitle: string;
  className: string;
}> = [
  {
    id: "high_blocker",
    title: "High influence · Caution",
    subtitle: "Blocker & Neutral",
    className: "border-thermal-red/25 bg-thermal-red/[0.04]",
  },
  {
    id: "high_champion",
    title: "High influence · Allies",
    subtitle: "Champion & Positive",
    className: "border-upcycle-orange/30 bg-upcycle-orange/[0.05]",
  },
  {
    id: "low_blocker",
    title: "Low influence · Caution",
    subtitle: "Blocker & Neutral",
    className: "border-carbon-blue/15 bg-carbon-blue/[0.02]",
  },
  {
    id: "low_champion",
    title: "Low influence · Allies",
    subtitle: "Champion & Positive",
    className: "border-carbon-blue/15 bg-white",
  },
];

const INFLUENCE_OPTIONS: InfluenceLevel[] = ["high", "medium", "low", "unknown"];
const STANCE_OPTIONS: SentimentStance[] = [
  "champion",
  "positive",
  "neutral",
  "blocker",
  "unknown",
];

function isHighInfluence(level: InfluenceLevel): boolean {
  return level === "high" || level === "medium";
}

function isAllyStance(stance: SentimentStance): boolean {
  return stance === "champion" || stance === "positive";
}

function quadrantFor(profile: InfluenceProfileCard): QuadrantId | "unmapped" {
  if (profile.influenceLevel === "unknown" && profile.stance === "unknown") {
    return "unmapped";
  }
  const high = isHighInfluence(profile.influenceLevel);
  const ally = isAllyStance(profile.stance);
  if (high && ally) return "high_champion";
  if (high && !ally) return "high_blocker";
  if (!high && ally) return "low_champion";
  return "low_blocker";
}

function stanceBadgeClass(stance: SentimentStance): string {
  switch (stance) {
    case "champion":
      return "border-upcycle-orange/40 bg-upcycle-orange/15 text-upcycle-orange";
    case "positive":
      return "border-upcycle-orange/25 bg-upcycle-orange/10 text-carbon-blue";
    case "blocker":
      return "border-thermal-red/35 bg-thermal-red/10 text-thermal-red";
    case "neutral":
      return "border-carbon-blue/20 bg-carbon-blue/[0.04] text-carbon-blue/70";
    default:
      return "border-carbon-blue/15 bg-white text-carbon-blue/45";
  }
}

function labelize(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function InfluenceMatrix({
  opportunityId,
  role = "superuser",
  readOnly = false,
}: {
  opportunityId: string;
  role?: UserRole;
  readOnly?: boolean;
}) {
  const [profiles, setProfiles] = useState<InfluenceProfileCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [influenceFilter, setInfluenceFilter] = useState<"all" | InfluenceLevel>("all");
  const [stanceFilter, setStanceFilter] = useState<"all" | SentimentStance>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/opportunities/${encodeURIComponent(opportunityId)}/influence`, {
        headers: { [AUTH_ROLE_HEADER]: role },
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Could not load influence profiles");
      }
      const payload = (await response.json()) as { profiles: InfluenceProfileCard[] };
      setProfiles(payload.profiles ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [opportunityId, role]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredProfiles = useMemo(() => {
    return profiles.filter((profile) => {
      if (influenceFilter !== "all" && profile.influenceLevel !== influenceFilter) {
        return false;
      }
      if (stanceFilter !== "all" && profile.stance !== stanceFilter) {
        return false;
      }
      return true;
    });
  }, [profiles, influenceFilter, stanceFilter]);

  const activeFilters = useMemo((): FilterSummaryChip[] => {
    const chips: FilterSummaryChip[] = [];
    if (influenceFilter !== "all") {
      chips.push({
        id: "influence",
        label: "Influence",
        value: labelize(influenceFilter),
        onRemove: () => setInfluenceFilter("all"),
      });
    }
    if (stanceFilter !== "all") {
      chips.push({
        id: "stance",
        label: "Stance",
        value: labelize(stanceFilter),
        onRemove: () => setStanceFilter("all"),
      });
    }
    return chips;
  }, [influenceFilter, stanceFilter]);

  const grouped = useMemo(() => {
    const buckets: Record<QuadrantId | "unmapped", InfluenceProfileCard[]> = {
      high_blocker: [],
      high_champion: [],
      low_blocker: [],
      low_champion: [],
      unmapped: [],
    };
    for (const profile of filteredProfiles) {
      buckets[quadrantFor(profile)].push(profile);
    }
    return buckets;
  }, [filteredProfiles]);

  const updateProfile = async (
    profile: InfluenceProfileCard,
    patch: { influenceLevel?: InfluenceLevel; stance?: SentimentStance },
  ) => {
    if (readOnly) return;
    setSavingId(profile.contactId);
    setError(null);
    try {
      const response = await fetch(`/api/opportunities/${encodeURIComponent(opportunityId)}/influence`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          [AUTH_ROLE_HEADER]: role,
        },
        body: JSON.stringify({
          contactId: profile.contactId,
          ...patch,
        }),
      });
      if (!response.ok) {
        throw new Error("Could not save influence update");
      }
      const payload = (await response.json()) as { profile: InfluenceProfileCard };
      setProfiles((current) =>
        current.map((entry) =>
          entry.contactId === payload.profile.contactId ? payload.profile : entry,
        ),
      );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Save failed");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section aria-label="Influence mapping" className="flex flex-col gap-4">
      <div>
        <p className="text-[11px] font-medium text-carbon-blue/45">FS-006 Influence Mapping</p>
        <h3 className="mt-1 text-base font-semibold text-carbon-blue">
          Stakeholder influence matrix
        </h3>
        <p className="mt-1 text-[13px] text-carbon-blue/55">
          Place people by influence and stance. SmartAssist never invents stakeholders — update
          what you know.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 border border-carbon-blue/10 bg-white px-3 py-3">
        <label className="flex min-w-[10rem] flex-col gap-1 text-[11px] font-semibold text-carbon-blue/55">
          Influence
          <select
            value={influenceFilter}
            onChange={(event) =>
              setInfluenceFilter(event.target.value as "all" | InfluenceLevel)
            }
            className="border border-carbon-blue/15 bg-white px-2 py-1.5 text-[12px] font-medium text-carbon-blue"
          >
            <option value="all">All levels</option>
            {INFLUENCE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {labelize(option)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[10rem] flex-col gap-1 text-[11px] font-semibold text-carbon-blue/55">
          Stance
          <select
            value={stanceFilter}
            onChange={(event) => setStanceFilter(event.target.value as "all" | SentimentStance)}
            className="border border-carbon-blue/15 bg-white px-2 py-1.5 text-[12px] font-medium text-carbon-blue"
          >
            <option value="all">All stances</option>
            {STANCE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {labelize(option)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <FilterTransparencyBar
        entityLabel="Stakeholders"
        filteredCount={filteredProfiles.length}
        totalCount={profiles.length}
        activeFilters={activeFilters}
        onClearAll={
          activeFilters.length >= 2
            ? () => {
                setInfluenceFilter("all");
                setStanceFilter("all");
              }
            : undefined
        }
      />

      {error ? (
        <p className="border border-thermal-red/25 bg-thermal-red/[0.06] px-3 py-2 text-[12px] text-thermal-red">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-[13px] text-carbon-blue/45">Loading influence profiles…</p>
      ) : profiles.length === 0 ? (
        <p className="border border-carbon-blue/10 bg-white px-4 py-6 text-[13px] text-carbon-blue/55">
          No influence profiles yet. Seeded opportunities include sample profiles — or add
          stakeholders and map influence here.
        </p>
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            {QUADRANTS.map((quadrant) => (
              <div
                key={quadrant.id}
                className={`group min-h-[12rem] rounded-lg border border-slate-200/80 px-3 py-3 shadow-sm dark:border-slate-800 ${quadrant.className}`}
              >
                <div className="mb-3 flex items-baseline justify-between gap-2">
                  <div>
                    <p className="text-[12px] font-semibold text-carbon-blue">{quadrant.title}</p>
                    <p className="text-[11px] text-carbon-blue/50">{quadrant.subtitle}</p>
                  </div>
                  <span className="tabular-nums text-[11px] text-carbon-blue/40">
                    {grouped[quadrant.id].length}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {grouped[quadrant.id].length === 0 ? (
                    <p className="text-[11px] text-carbon-blue/35">Empty</p>
                  ) : (
                    grouped[quadrant.id].map((profile) => (
                      <InfluenceCard
                        key={profile.id}
                        profile={profile}
                        readOnly={readOnly}
                        saving={savingId === profile.contactId}
                        onChange={updateProfile}
                      />
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>

          {grouped.unmapped.length > 0 ? (
            <div className="border border-dashed border-carbon-blue/20 bg-white px-3 py-3">
              <p className="text-[12px] font-semibold text-carbon-blue">Needs placement</p>
              <p className="mb-2 text-[11px] text-carbon-blue/50">
                Influence and stance still unknown — set both to place on the matrix.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {grouped.unmapped.map((profile) => (
                  <InfluenceCard
                    key={profile.id}
                    profile={profile}
                    readOnly={readOnly}
                    saving={savingId === profile.contactId}
                    onChange={updateProfile}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function InfluenceCard({
  profile,
  readOnly,
  saving,
  onChange,
}: {
  profile: InfluenceProfileCard;
  readOnly: boolean;
  saving: boolean;
  onChange: (
    profile: InfluenceProfileCard,
    patch: { influenceLevel?: InfluenceLevel; stance?: SentimentStance },
  ) => Promise<void>;
}) {
  return (
    <article className="group rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 shadow-sm transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-700">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-carbon-blue">
            {profile.contact.fullName}
          </p>
          <p className="truncate text-[11px] text-carbon-blue/55">
            {profile.contact.jobTitle?.trim() || "Role unknown"}
          </p>
        </div>
        <span
          className={`shrink-0 border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] ${stanceBadgeClass(profile.stance)}`}
        >
          {labelize(profile.stance)}
        </span>
      </div>

      <div className={`mt-2 flex flex-wrap gap-2 ${ATTIO_GROUP_ACTIONS}`}>
        <label className="flex min-w-[7.5rem] flex-1 flex-col gap-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-carbon-blue/40">
          Influence
          <select
            value={profile.influenceLevel}
            disabled={readOnly || saving}
            onChange={(event) =>
              void onChange(profile, {
                influenceLevel: event.target.value as InfluenceLevel,
              })
            }
            className="border border-carbon-blue/15 bg-white px-2 py-1 text-[12px] font-medium normal-case tracking-normal text-carbon-blue disabled:opacity-60"
          >
            {INFLUENCE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {labelize(option)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[7.5rem] flex-1 flex-col gap-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-carbon-blue/40">
          Stance
          <select
            value={profile.stance}
            disabled={readOnly || saving}
            onChange={(event) =>
              void onChange(profile, {
                stance: event.target.value as SentimentStance,
              })
            }
            className="border border-carbon-blue/15 bg-white px-2 py-1 text-[12px] font-medium normal-case tracking-normal text-carbon-blue disabled:opacity-60"
          >
            {STANCE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {labelize(option)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {saving ? (
        <p className="mt-1.5 text-[10px] text-carbon-blue/40">Saving…</p>
      ) : null}
    </article>
  );
}
