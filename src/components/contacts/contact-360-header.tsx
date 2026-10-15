"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { CalendarPlus, Mail, Sparkles } from "lucide-react";
import type { BuyingRole, Contact } from "@/types/contact";
import { getContactDisplayName, isBuyingRoleUnknown } from "@/types/contact";
import { CompanyLink } from "@/components/relationship/relationship-links";
import { EmailActionMenu, PhoneActionMenu } from "@/components/relationship/relationship-links";
import { BuyingRoleSelect } from "@/components/contacts/contact-form-fields";
import { CompanyOwnerSelect } from "@/components/companies/company-owner-select";
import { ActionableField, SmartCRMIcon } from "@/components/ui/smartcrm-icon";
import { outlookComposeHref, outlookMeetingComposeHref } from "@/lib/compose-actions";
import { useUniversalSearchOptional } from "@/context/universal-search-context";
import { formatAccountOwnerDisplay, hasContactOwner } from "@/lib/company-owner";
import { canReassignContactOwner } from "@/lib/permissions";
import type { Contact360Verdict } from "@/lib/contact-360-verdict";
import type { UserRole } from "@/types/auth";
import type { Company, SharePointPerson } from "@/types/company";
import type { StandardBioUserRecord } from "@/types/user-access";

function localTimeString(timezone: string | undefined, now: Date): string | null {
  if (!timezone?.trim()) return null;
  try {
    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      day: "2-digit",
      month: "short",
      timeZone: timezone,
    }).format(now);
  } catch {
    return null;
  }
}

const ACTION_PRIMARY =
  "inline-flex shrink-0 items-center gap-1.5 border border-upcycle-orange/30 bg-upcycle-orange px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-upcycle-orange/90";
const ACTION_SECONDARY =
  "inline-flex shrink-0 items-center gap-1.5 border border-carbon-blue/15 bg-white px-3 py-1.5 text-[12px] font-semibold text-carbon-blue transition-colors hover:border-upcycle-orange hover:text-upcycle-orange";

/**
 * Contact 360 hero — who, what matters, what next.
 * No status aside: last touch lives in the verdict, employment in the "···" menu,
 * and buying role is the one thing worth fixing here, so it is a selector.
 */
export function Contact360Header({
  contact,
  companyId,
  companyName,
  companies = [],
  assignableUsers = [],
  role,
  trailing,
  verdict,
  onBuyingRoleChange,
  onOwnerChange,
}: {
  contact: Contact;
  companyId: string;
  companyName: string;
  companies?: Company[];
  assignableUsers?: StandardBioUserRecord[];
  role?: UserRole;
  trailing?: ReactNode;
  verdict?: Contact360Verdict;
  /** Persist a buying-role decision; absent → read-only chip. */
  onBuyingRoleChange?: (role: BuyingRole | undefined) => Promise<void>;
  onOwnerChange?: (owner: SharePointPerson) => Promise<void>;
}) {
  const displayName = getContactDisplayName(contact);
  const position = contact.JobTitle || contact.Role || "—";
  const phone = contact.Mobile || contact.Phone;
  const [clockNow, setClockNow] = useState(() => new Date());
  const [buyingRoleBusy, setBuyingRoleBusy] = useState(false);
  const [ownerBusy, setOwnerBusy] = useState(false);
  const buyingRoleUnknown = isBuyingRoleUnknown(contact.buyingRole);
  const ownerAssigned = hasContactOwner(contact);
  const ownerLabel = formatAccountOwnerDisplay(contact.ContactOwner);
  const canEditOwner = Boolean(role && onOwnerChange && canReassignContactOwner(role));

  useEffect(() => {
    const timer = setInterval(() => setClockNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const localTime = localTimeString(contact.timezone, clockNow);
  const search = useUniversalSearchOptional();
  const email = contact.Email?.trim() ?? "";
  const firstName = contact.FirstName?.trim() || displayName.split(" ")[0] || displayName;
  const meetingSubject = `${companyName} × Standard Bio`;

  return (
    <div className="border border-carbon-blue/10 bg-white p-4">
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <h1 className="flex min-w-0 items-center gap-2.5 text-2xl font-semibold tracking-tight text-carbon-blue xl:text-[1.85rem]">
            <SmartCRMIcon name="contact" size="lg" label="Contact" />
            <span className="truncate">{displayName}</span>
            {contact.IsArchived ? (
              <span className="shrink-0 border border-carbon-blue/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/65">
                Archived
              </span>
            ) : null}
          </h1>
          {trailing ? <div className="shrink-0 pt-1">{trailing}</div> : null}
        </div>

        <p className="mt-2 text-sm text-carbon-blue/65">{position}</p>

        <p className="mt-1.5 text-sm text-carbon-blue/60">
          <CompanyLink companyId={companyId} className="font-medium hover:text-upcycle-orange">
            {companyName}
          </CompanyLink>
        </p>

        <div className="mt-3 flex flex-col gap-1.5 text-[13px] text-carbon-blue/65">
          {contact.Email ? (
            <ActionableField icon="email">
              <EmailActionMenu email={contact.Email} />
            </ActionableField>
          ) : (
            <p className="text-carbon-blue/65">No email on file</p>
          )}
          {phone ? (
            <ActionableField icon="phone">
              <PhoneActionMenu phone={phone} />
            </ActionableField>
          ) : (
            <p className="text-carbon-blue/65">No phone on file</p>
          )}
        </div>

        {verdict ? (
          <div className="mt-3 max-w-xl">
            <p className="text-[15px] leading-snug text-carbon-blue">{verdict.summary}</p>
            <p className="mt-1 text-[13px] leading-snug text-carbon-blue/70">
              <span className="font-medium text-upcycle-orange">Next </span>
              {verdict.nextAction}
            </p>
          </div>
        ) : null}

        {/* What you can do right now — one row, no hunting. */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {email ? (
            <a
              href={outlookComposeHref(email)}
              target="_blank"
              rel="noreferrer"
              className={ACTION_PRIMARY}
            >
              <Mail className="size-3.5" strokeWidth={2} aria-hidden />
              Email {firstName}
            </a>
          ) : (
            <span className={`${ACTION_SECONDARY} cursor-not-allowed opacity-50`} title="No email on file">
              <Mail className="size-3.5" strokeWidth={2} aria-hidden />
              Email {firstName}
            </span>
          )}
          {email ? (
            <a
              href={outlookMeetingComposeHref(email, meetingSubject)}
              target="_blank"
              rel="noreferrer"
              className={ACTION_SECONDARY}
            >
              <CalendarPlus className="size-3.5" strokeWidth={2} aria-hidden />
              Book meeting
            </a>
          ) : (
            <span className={`${ACTION_SECONDARY} cursor-not-allowed opacity-50`} title="No email on file">
              <CalendarPlus className="size-3.5" strokeWidth={2} aria-hidden />
              Book meeting
            </span>
          )}
          {search ? (
            <button
              type="button"
              onClick={() =>
                search.openSearch({ mode: "ask", query: `What do we know about ${companyName}?` })
              }
              className={ACTION_SECONDARY}
            >
              <Sparkles className="size-3.5" strokeWidth={2} aria-hidden />
              Ask SmartAssist
            </button>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {/* Buying role — a decision the user can make here in two seconds. */}
          <label className="inline-flex items-center gap-2 text-[12px] font-medium text-carbon-blue/70">
            <span className={buyingRoleUnknown ? "text-upcycle-orange" : undefined}>
              {buyingRoleUnknown
                ? `Is ${firstName} a decision maker at ${companyName}?`
                : "Buying role"}
            </span>
            {onBuyingRoleChange ? (
              <BuyingRoleSelect
                value={contact.buyingRole}
                disabled={buyingRoleBusy}
                onChange={(next) => {
                  setBuyingRoleBusy(true);
                  void onBuyingRoleChange(next as BuyingRole | undefined).finally(() =>
                    setBuyingRoleBusy(false),
                  );
                }}
                className={`border bg-white px-2 py-1 text-[12px] font-medium outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40 ${
                  buyingRoleUnknown
                    ? "border-upcycle-orange/40 text-upcycle-orange"
                    : "border-carbon-blue/15 text-carbon-blue"
                }`}
              />
            ) : (
              <span className="border border-carbon-blue/12 bg-carbon-blue/[0.03] px-2.5 py-1">
                {contact.buyingRole ?? "Unknown"}
              </span>
            )}
          </label>
          {canEditOwner ? (
            <span
              className={`inline-flex min-w-0 items-center gap-1.5 text-[12px] font-medium ${
                ownerAssigned ? "text-carbon-blue/70" : "text-thermal-red"
              }`}
            >
              <span>Owner</span>
              <CompanyOwnerSelect
                appearance="inline"
                label="Contact owner"
                companies={companies}
                assignableUsers={assignableUsers}
                extraUsers={contact.ContactOwner ? [contact.ContactOwner] : []}
                value={ownerAssigned ? contact.ContactOwner ?? null : null}
                disabled={ownerBusy}
                onChange={(owner) => {
                  setOwnerBusy(true);
                  void onOwnerChange?.(owner).finally(() => setOwnerBusy(false));
                }}
              />
            </span>
          ) : (
            <span
              className={`border border-carbon-blue/12 bg-carbon-blue/[0.03] px-2.5 py-1 text-[12px] font-medium ${
                ownerAssigned ? "text-carbon-blue/70" : "text-thermal-red"
              }`}
            >
              {ownerAssigned ? `Owner ${ownerLabel}` : "Owner unassigned"}
            </span>
          )}
          {localTime ? (
            <span className="border border-carbon-blue/12 bg-carbon-blue/[0.03] px-2.5 py-1 text-[12px] font-medium text-carbon-blue/70">
              Local time {localTime}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
