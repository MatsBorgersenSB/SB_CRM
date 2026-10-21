"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { OfferingCategory, StandardBioOffering } from "@/types/offering";
import { OFFERING_CATEGORIES, OFFERING_CATEGORY_LABELS } from "@/types/offering";
import { buildCustomOffering } from "@/lib/custom-offering";
import {
  catalogOfferingsByCategory,
  resolveOfferings,
  STANDARD_BIO_OFFERINGS,
} from "@/lib/standard-bio-offerings";
import { SmartCRMIcon } from "@/components/ui/smartcrm-icon";

type CategoryFilter = "all" | OfferingCategory;

function FilterChip({
  label,
  active,
  onClick,
  disabled,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`border px-2 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
        active
          ? "border-upcycle-orange/35 bg-upcycle-orange/10 text-upcycle-orange"
          : "border-carbon-blue/10 text-carbon-blue/50 hover:text-carbon-blue"
      }`}
    >
      {label}
    </button>
  );
}

function OfferingChip({
  offering,
  onRemove,
  disabled,
}: {
  offering: StandardBioOffering;
  onRemove?: () => void;
  disabled?: boolean;
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 border border-carbon-blue/12 bg-carbon-blue/[0.03] py-1 pl-2.5 pr-1 text-[13px] text-carbon-blue">
      <span className="truncate font-medium">{offering.name}</span>
      <span className="sr-only">({OFFERING_CATEGORY_LABELS[offering.category]})</span>
      {onRemove ? (
        <button
          type="button"
          disabled={disabled}
          onClick={onRemove}
          aria-label={`Remove ${offering.name}`}
          className="inline-flex size-5 shrink-0 items-center justify-center text-carbon-blue/60 transition-colors hover:text-thermal-red disabled:opacity-50"
        >
          ×
        </button>
      ) : null}
    </span>
  );
}

const ADD_AS_LABEL: Record<OfferingCategory, string> = {
  system: "System",
  product: "Product",
  service: "Service",
};

function CompactOfferingSelector({
  selectedIds,
  extraOfferings,
  onAdd,
  onCreate,
  onClose,
  disabled,
}: {
  selectedIds: string[];
  extraOfferings: StandardBioOffering[];
  onAdd: (id: string) => void;
  onCreate: (offering: StandardBioOffering) => void;
  onClose: () => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = new Set(selectedIds);
  const catalog = useMemo(() => {
    const grouped = catalogOfferingsByCategory();
    for (const offering of extraOfferings) {
      if (grouped[offering.category].some((entry) => entry.id === offering.id)) continue;
      grouped[offering.category] = [...grouped[offering.category], offering];
    }
    return grouped;
  }, [extraOfferings]);
  const named = query.trim().replace(/\s+/g, " ");

  const options = useMemo(() => {
    const categories =
      category === "all" ? OFFERING_CATEGORIES : ([category] as OfferingCategory[]);
    const needle = query.trim().toLowerCase();
    const results: StandardBioOffering[] = [];

    for (const cat of categories) {
      for (const offering of catalog[cat]) {
        if (selected.has(offering.id)) continue;
        if (
          needle &&
          !offering.name.toLowerCase().includes(needle) &&
          !offering.summary.toLowerCase().includes(needle)
        ) {
          continue;
        }
        results.push(offering);
      }
    }

    return results.slice(0, 8);
  }, [catalog, category, query, selected]);

  const addNamed = (entry: OfferingCategory) => {
    if (disabled || named.length < 2) return;
    const known = [...STANDARD_BIO_OFFERINGS, ...extraOfferings].find(
      (offering) =>
        offering.category === entry && offering.name.toLowerCase() === named.toLowerCase(),
    );
    if (known) {
      onAdd(known.id);
      setQuery("");
      inputRef.current?.focus();
      return;
    }
    const created = buildCustomOffering(entry, named);
    if (!created) return;
    onCreate(created);
    onAdd(created.id);
    setQuery("");
    inputRef.current?.focus();
  };

  return (
    <div className="mt-2 border border-carbon-blue/12 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] font-semibold text-carbon-blue">Add offering</p>
        <button
          type="button"
          onClick={onClose}
          className="text-[12px] font-semibold text-carbon-blue/65 hover:text-carbon-blue"
        >
          Done
        </button>
      </div>

      <label className="mt-2 block">
        <span className="sr-only">Search offerings</span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          autoFocus
          disabled={disabled}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            addNamed(category === "all" ? "product" : category);
          }}
          placeholder="Search or type a new name, then press Enter"
          className="w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[13px] text-carbon-blue placeholder:text-carbon-blue/50"
        />
      </label>

      <div className="mt-2 flex flex-wrap gap-1">
        <FilterChip
          label="All"
          active={category === "all"}
          disabled={disabled}
          onClick={() => setCategory("all")}
        />
        {OFFERING_CATEGORIES.map((entry) => (
          <FilterChip
            key={entry}
            label={OFFERING_CATEGORY_LABELS[entry]}
            active={category === entry}
            disabled={disabled}
            onClick={() => setCategory(entry)}
          />
        ))}
      </div>

      <ul className="mt-2 max-h-48 overflow-y-auto border-t border-carbon-blue/8 pt-2">
        {named.length >= 2
          ? (category === "all"
              ? (["product", "system", "service"] as OfferingCategory[])
              : [category]
            ).map((entry) => {
              const alreadyListed = [...STANDARD_BIO_OFFERINGS, ...extraOfferings].some(
                (offering) =>
                  offering.category === entry &&
                  offering.name.toLowerCase() === named.toLowerCase(),
              );
              if (alreadyListed) return null;
              return (
                <li key={`new-${entry}`}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => addNamed(entry)}
                    className="flex w-full items-start justify-between gap-2 px-1 py-2 text-left transition-colors hover:bg-upcycle-orange/[0.06] disabled:opacity-50"
                  >
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold text-carbon-blue">
                        {named}
                      </span>
                      <span className="mt-0.5 block text-[12px] text-upcycle-orange">
                        New {ADD_AS_LABEL[entry].toLowerCase()}
                      </span>
                    </span>
                    <span className="shrink-0 text-[12px] font-semibold text-upcycle-orange">
                      Add
                    </span>
                  </button>
                </li>
              );
            })
          : null}
        {options.length === 0 && named.length < 2 ? (
          <li className="px-1 py-2 text-[13px] text-carbon-blue/65">
            {selectedIds.length > 0 && !query.trim() && category === "all"
              ? "All offerings selected."
              : "Type a name such as Biochar, then choose Add."}
          </li>
        ) : (
          options.map((offering) => (
            <li key={offering.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  onAdd(offering.id);
                  setQuery("");
                  inputRef.current?.focus();
                }}
                className="flex w-full items-start justify-between gap-2 px-1 py-2 text-left transition-colors hover:bg-carbon-blue/[0.03] disabled:opacity-50"
              >
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-carbon-blue">
                    {offering.name}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-carbon-blue/50">
                    {OFFERING_CATEGORY_LABELS[offering.category]}
                  </span>
                </span>
                <span className="shrink-0 text-[12px] font-semibold text-upcycle-orange">
                  Add
                </span>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

/**
 * Selected offerings as chips. Catalog appears only while adding.
 */
export function OpportunityOfferingsPicker({
  selectedIds,
  onChange,
  disabled = false,
  required = false,
  label = "Selected offerings",
  helper,
  defaultOpen = false,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  /** Show validation when empty (create form). */
  required?: boolean;
  label?: string;
  helper?: string;
  /** Open the add selector immediately (e.g. empty create form). */
  defaultOpen?: boolean;
}) {
  const [addOpen, setAddOpen] = useState(
    defaultOpen || (required && selectedIds.length === 0),
  );
  const [extraOfferings, setExtraOfferings] = useState<StandardBioOffering[]>([]);
  const selectedOfferings = useMemo(
    () => resolveOfferings(selectedIds),
    [selectedIds],
  );

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/offerings")
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { offerings?: { id: string }[] } | null) => {
        if (cancelled || !body?.offerings) return;
        const next = body.offerings.flatMap((entry) => {
          const offering = resolveOfferings([entry.id])[0];
          return offering ? [offering] : [];
        });
        setExtraOfferings(next);
      })
      .catch(() => {
        /* The typed name can still be added on this opportunity. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const remove = (id: string) => {
    if (disabled) return;
    onChange(selectedIds.filter((entry) => entry !== id));
  };

  const add = (id: string) => {
    if (disabled || selectedIds.includes(id)) return;
    onChange([...selectedIds, id]);
  };

  return (
    <div className="space-y-2">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-carbon-blue/65">
          {label}
        </p>
        {helper ? (
          <p className="mt-1 text-[13px] text-carbon-blue/55">{helper}</p>
        ) : null}
      </div>

      {selectedOfferings.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selectedOfferings.map((offering) => (
            <OfferingChip
              key={offering.id}
              offering={offering}
              disabled={disabled}
              onRemove={disabled ? undefined : () => remove(offering.id)}
            />
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-carbon-blue/65">No offerings selected.</p>
      )}

      {required && selectedIds.length === 0 ? (
        <p className="text-[13px] text-thermal-red/80">Select at least one offering.</p>
      ) : null}

      {addOpen && !disabled ? (
        <CompactOfferingSelector
          selectedIds={selectedIds}
          extraOfferings={extraOfferings}
          onAdd={add}
          onCreate={(offering) =>
            setExtraOfferings((current) =>
              current.some((entry) => entry.id === offering.id)
                ? current
                : [...current, offering],
            )
          }
          onClose={() => setAddOpen(false)}
          disabled={disabled}
        />
      ) : !disabled ? (
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-1.5 border border-carbon-blue/12 px-3 py-1.5 text-[12px] font-semibold text-carbon-blue/65 transition-colors hover:border-upcycle-orange/30 hover:text-upcycle-orange"
        >
          <SmartCRMIcon name="add" size="xs" />
          Add Offering
        </button>
      ) : null}
    </div>
  );
}
