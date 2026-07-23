"use client";

import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { withAuthRoleHeaders } from "@/lib/api-auth";
import { ASSISTED_EVERYTHING } from "@/lib/smart-assist-config";
import { recommendAccessForFunction } from "@/lib/users-access-recommendations";
import { USER_ROLE_LABELS } from "@/types/auth";
import {
  BUSINESS_FUNCTIONS,
  USER_LICENSES,
  USER_TEAMS,
  type AccessRecommendation,
  type BusinessFunction,
  type CreateUserInput,
  type StandardBioUserRecord,
} from "@/types/user-access";

type WizardStep = "function" | "details" | "recommendation";

type UserCreateWizardProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (user: StandardBioUserRecord) => void;
};

export function UserCreateWizard({ open, onClose, onCreated }: UserCreateWizardProps) {
  const { user: authUser } = useAuth();
  const [step, setStep] = useState<WizardStep>("function");
  const [businessFunction, setBusinessFunction] = useState<BusinessFunction | null>(null);
  const [recommendation, setRecommendation] = useState<AccessRecommendation | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [team, setTeam] = useState<(typeof USER_TEAMS)[number]>("Commercial");
  const [license, setLicense] = useState<(typeof USER_LICENSES)[number]>("SmartCRM Standard");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  function reset() {
    setStep("function");
    setBusinessFunction(null);
    setRecommendation(null);
    setDisplayName("");
    setEmail("");
    setTeam("Commercial");
    setLicense("SmartCRM Standard");
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleSelectFunction(fn: BusinessFunction) {
    const rec = recommendAccessForFunction(fn);
    setBusinessFunction(fn);
    setRecommendation(rec);
    setTeam(rec.team);
    setLicense(rec.license);
    setStep("details");
  }

  async function handleCreate() {
    if (!recommendation || !displayName.trim() || !email.trim()) return;
    setSubmitting(true);
    setError(null);

    const payload: CreateUserInput = {
      displayName: displayName.trim(),
      email: email.trim(),
      role: recommendation.role,
      businessFunction,
      team,
      license,
      ownershipScope: recommendation.ownershipScope,
    };

    try {
      const response = await fetch("/api/administration/users", {
        method: "POST",
        headers: withAuthRoleHeaders(authUser.role, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Failed to create user");
      }

      const body = (await response.json()) as { user: StandardBioUserRecord };
      onCreated(body.user);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-carbon-blue/30 p-4 backdrop-blur-[2px]">
      <div
        className="w-full max-w-lg border border-carbon-blue/10 bg-white shadow-lg"
        role="dialog"
        aria-labelledby="user-create-wizard-title"
      >
        <div className="border-b border-carbon-blue/8 px-4 py-3">
          <p
            id="user-create-wizard-title"
            className="text-sm font-semibold text-carbon-blue"
          >
            Add User — SmartAssist
          </p>
          <p className="mt-1 text-[11px] text-carbon-blue/50">
            {ASSISTED_EVERYTHING.smartAssistRole} {ASSISTED_EVERYTHING.mantra}
          </p>
        </div>

        <div className="max-h-[70dvh] space-y-4 overflow-y-auto px-4 py-4">
          {step === "function" ? (
            <>
              <p className="text-sm font-medium text-carbon-blue">What will this user do?</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {BUSINESS_FUNCTIONS.map((fn) => (
                  <button
                    key={fn}
                    type="button"
                    onClick={() => handleSelectFunction(fn)}
                    className="border border-carbon-blue/12 px-3 py-2.5 text-left text-[12px] font-medium text-carbon-blue transition-colors hover:border-upcycle-orange hover:bg-upcycle-orange/[0.04]"
                  >
                    {fn}
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {step === "details" && recommendation ? (
            <>
              <div className="border border-upcycle-orange/20 bg-upcycle-orange/[0.04] p-3">
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-upcycle-orange">
                  SmartAssist recommends
                </p>
                <ul className="mt-2 space-y-1 text-[11px] text-carbon-blue/75">
                  <li>
                    <span className="font-semibold text-carbon-blue">Role:</span>{" "}
                    {recommendation.roleLabel}
                  </li>
                  <li>
                    <span className="font-semibold text-carbon-blue">Permissions:</span>{" "}
                    {recommendation.permissionsSummary}
                  </li>
                  <li>
                    <span className="font-semibold text-carbon-blue">Ownership scope:</span>{" "}
                    {recommendation.ownershipScopeLabel}
                  </li>
                </ul>
                <p className="mt-2 text-[10px] text-carbon-blue/50">{recommendation.rationale}</p>
              </div>

              <label className="block">
                <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
                  Display name
                </span>
                <input
                  type="text"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  className="mt-1 w-full border border-carbon-blue/15 px-3 py-2 text-[12px] text-carbon-blue"
                  placeholder="Full name"
                />
              </label>

              <label className="block">
                <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
                  Email
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-1 w-full border border-carbon-blue/15 px-3 py-2 text-[12px] text-carbon-blue"
                  placeholder="name@standardbio.com"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
                    Team
                  </span>
                  <select
                    value={team}
                    onChange={(event) =>
                      setTeam(event.target.value as (typeof USER_TEAMS)[number])
                    }
                    className="mt-1 w-full border border-carbon-blue/15 px-3 py-2 text-[12px] text-carbon-blue"
                  >
                    {USER_TEAMS.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
                    License
                  </span>
                  <select
                    value={license}
                    onChange={(event) =>
                      setLicense(event.target.value as (typeof USER_LICENSES)[number])
                    }
                    className="mt-1 w-full border border-carbon-blue/15 px-3 py-2 text-[12px] text-carbon-blue"
                  >
                    {USER_LICENSES.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <p className="text-[10px] text-carbon-blue/45">
                Role: {USER_ROLE_LABELS[recommendation.role]} · Function: {businessFunction}
              </p>

              {error ? <p className="text-[11px] text-thermal-red">{error}</p> : null}
            </>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-carbon-blue/8 px-4 py-3">
          <button
            type="button"
            onClick={handleClose}
            className="border border-carbon-blue/15 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/60"
          >
            Cancel
          </button>
          <div className="flex gap-2">
            {step === "details" ? (
              <button
                type="button"
                onClick={() => setStep("function")}
                className="border border-carbon-blue/15 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/60"
              >
                Back
              </button>
            ) : null}
            {step === "details" ? (
              <button
                type="button"
                disabled={submitting || !displayName.trim() || !email.trim()}
                onClick={() => void handleCreate()}
                className="border border-upcycle-orange bg-upcycle-orange px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white disabled:opacity-50"
              >
                {submitting ? "Creating…" : "Create user"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
