"use client";

import {
  EDITORIAL_BODY,
  EDITORIAL_EMPTY,
  EDITORIAL_GAP_LIST,
  EDITORIAL_LABEL,
} from "@/lib/editorial-design-system";

export function ProjectDiscoveryQuestionsPanel({
  questions,
  validations,
  conversations,
}: {
  questions: string[];
  validations: string[];
  conversations: string[];
}) {
  return (
    <div className="flex flex-col gap-10 py-1">
      <DiscoveryList
        title="Questions to ask"
        description="SmartAssist suggests these questions to build understanding through conversation."
        items={questions}
        emptyLabel="No questions suggested yet — link an account and log a discovery conversation."
      />
      <DiscoveryList
        title="Validations"
        description="Confirm assumptions before generating objectives, risks, or recommendations."
        items={validations}
        emptyLabel="Validations will appear as gaps are identified."
      />
      <DiscoveryList
        title="Recommended conversations"
        description="Who to speak with next to close critical gaps."
        items={conversations}
        emptyLabel="Conversation angles unlock as stakeholder and account context is added."
      />
    </div>
  );
}

function DiscoveryList({
  title,
  description,
  items,
  emptyLabel,
}: {
  title: string;
  description: string;
  items: string[];
  emptyLabel: string;
}) {
  return (
    <section>
      <p className={EDITORIAL_LABEL}>{title}</p>
      <p className="mt-1 text-[13px] text-carbon-blue/55">{description}</p>
      {items.length === 0 ? (
        <p className={`mt-4 ${EDITORIAL_EMPTY}`}>{emptyLabel}</p>
      ) : (
        <ul className={`${EDITORIAL_GAP_LIST} mt-4`}>
          {items.map((item) => (
            <li key={item} className={`${EDITORIAL_BODY} text-carbon-blue/75`}>
              {item}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
