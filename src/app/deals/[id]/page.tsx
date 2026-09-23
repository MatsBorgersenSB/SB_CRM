import { redirect } from "next/navigation";
import { deal360Href } from "@/types/relationship-navigation";

type DealRedirectPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DealRedirectPage({
  params,
  searchParams,
}: DealRedirectPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      for (const item of value) qs.append(key, item);
    } else if (value) {
      qs.set(key, value);
    }
  }
  const canonical = deal360Href(id);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  redirect(`${canonical}${suffix}`);
}
