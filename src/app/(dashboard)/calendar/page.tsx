import { redirect } from "next/navigation";

/** The calendar is a view inside Activities. Keep old links working. */
export default function CalendarPage() {
  redirect("/activities?mode=calendar");
}
