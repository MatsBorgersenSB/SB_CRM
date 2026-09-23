import { redirect } from "next/navigation";
import { OPPORTUNITY_LIST_HREF } from "@/types/relationship-navigation";

export default function DealsRedirectPage() {
  redirect(OPPORTUNITY_LIST_HREF);
}
