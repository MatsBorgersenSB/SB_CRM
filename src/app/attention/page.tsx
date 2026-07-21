import { redirect } from "next/navigation";

/** My Attention lives on the home dashboard — keep /attention as a stable alias. */
export default function AttentionPage() {
  redirect("/");
}
