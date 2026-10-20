import { redirect } from "next/navigation";

/** Short, memorable link for home-screen shortcuts and QR codes. */
export default function ScanRedirectPage(): never {
  redirect("/crm/intake");
}
