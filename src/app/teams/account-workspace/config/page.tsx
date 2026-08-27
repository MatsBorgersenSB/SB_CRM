"use client";

import { useEffect, useMemo, useState } from "react";
import { ensureTeamsSdk } from "@/lib/teams-sdk";

type BindOption = {
  id: string;
  label: string;
  kind: "company" | "project";
  subtitle?: string;
};

/**
 * FS-018 Phase 2 — configure channel Account Workspace binding.
 * Saves contentUrl with companyId or projectId so the channel opens living context.
 */
export default function TeamsAccountWorkspaceConfigPage() {
  const [status, setStatus] = useState("Loading companies and projects…");
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<BindOption[]>([]);
  const [selected, setSelected] = useState<BindOption | null>(null);
  const [teamsReady, setTeamsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [companiesRes, projectsRes] = await Promise.all([
          fetch("/api/companies", { credentials: "include", cache: "no-store" }),
          fetch("/api/projects", { credentials: "include", cache: "no-store" }),
        ]);

        const companies = companiesRes.ok
          ? ((await companiesRes.json()) as Array<{
              CompanyID?: string;
              Title?: string;
              code?: string;
              City?: string;
              CompanyTypes?: string[];
            }>)
          : [];
        const projectsBody = projectsRes.ok
          ? ((await projectsRes.json()) as
              | { projects?: Array<{ id: string; name: string; status?: string }> }
              | Array<{ id: string; name: string; status?: string }>)
          : [];
        const projects = Array.isArray(projectsBody)
          ? projectsBody
          : (projectsBody.projects ?? []);

        if (cancelled) return;

        const companyOptions: BindOption[] = (Array.isArray(companies) ? companies : [])
          .slice(0, 200)
          .map((c) => ({
            id: String(c.code || c.CompanyID || ""),
            label: c.Title || c.code || "Company",
            kind: "company" as const,
            subtitle: [c.City, (c.CompanyTypes ?? []).slice(0, 2).join(", ")]
              .filter(Boolean)
              .join(" · "),
          }))
          .filter((o) => o.id);

        const projectOptions: BindOption[] = projects.slice(0, 100).map((p) => ({
          id: p.id,
          label: p.name,
          kind: "project" as const,
          subtitle: p.status || "Project",
        }));

        setOptions([...projectOptions, ...companyOptions]);
        setStatus(
          companyOptions.length + projectOptions.length > 0
            ? "Choose a company or project for this channel."
            : "Sign in to SmartCRM first, then reopen this configuration.",
        );
      } catch {
        if (!cancelled) setStatus("Could not load bind options. Sign in and try again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const teams = await ensureTeamsSdk();
        const config = teams?.pages?.config;
        if (!teams || !config || cancelled) {
          setTeamsReady(false);
          return;
        }
        await teams.app.initialize();
        setTeamsReady(true);

        config.registerOnSaveHandler((saveEvent) => {
          if (!selected) {
            saveEvent.notifyFailure("Select a company or project first");
            return;
          }
          const origin = window.location.origin;
          const params = new URLSearchParams();
          if (selected.kind === "project") params.set("projectId", selected.id);
          else params.set("companyId", selected.id);
          const contentUrl = `${origin}/teams/account-workspace?${params.toString()}`;
          void config
            .setConfig({
              entityId: `smartcrm.accountWorkspace.${selected.kind}.${selected.id}`,
              contentUrl,
              websiteUrl: contentUrl,
              suggestedDisplayName: selected.label.slice(0, 40),
            })
            .then(() => saveEvent.notifySuccess())
            .catch((err: unknown) => {
              saveEvent.notifyFailure(
                err instanceof Error ? err.message : "Could not save tab",
              );
            });
        });
      } catch {
        if (!cancelled) setTeamsReady(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  useEffect(() => {
    void (async () => {
      const teams = await ensureTeamsSdk();
      teams?.pages?.config?.setValidityState(Boolean(selected));
    })();
  }, [selected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 40);
    return options
      .filter(
        (o) =>
          o.label.toLowerCase().includes(q) ||
          o.id.toLowerCase().includes(q) ||
          (o.subtitle?.toLowerCase().includes(q) ?? false),
      )
      .slice(0, 40);
  }, [options, query]);

  return (
    <main className="min-h-screen bg-[#faf9f8] p-4 text-carbon-blue">
      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-upcycle-orange">
        SmartCRM · Channel tab
      </p>
      <h1 className="mt-1 text-base font-semibold">Account Workspace</h1>
      <p className="mt-1 text-[12px] text-carbon-blue/55">{status}</p>
      {!teamsReady ? (
        <p className="mt-2 text-[11px] text-carbon-blue/40">
          Open this page from Teams → Add tab → SmartCRM to save the binding.
        </p>
      ) : null}

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search Escalante, company name…"
        className="mt-4 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-sm outline-none focus:border-upcycle-orange"
      />

      <ul className="mt-3 max-h-[50vh] divide-y divide-carbon-blue/8 overflow-auto border border-carbon-blue/10 bg-white">
        {filtered.map((option) => {
          const active =
            selected?.id === option.id && selected.kind === option.kind;
          return (
            <li key={`${option.kind}-${option.id}`}>
              <button
                type="button"
                onClick={() => setSelected(option)}
                className={`flex w-full flex-col px-3 py-2.5 text-left ${
                  active ? "bg-upcycle-orange/[0.08]" : "hover:bg-carbon-blue/[0.02]"
                }`}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                  {option.kind}
                </span>
                <span className="text-sm font-medium text-carbon-blue">{option.label}</span>
                {option.subtitle ? (
                  <span className="text-[11px] text-carbon-blue/45">{option.subtitle}</span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      {selected ? (
        <p className="mt-3 text-[11px] text-carbon-blue/60">
          Selected: <strong>{selected.label}</strong> — click Save in Teams to bind.
        </p>
      ) : null}
    </main>
  );
}
