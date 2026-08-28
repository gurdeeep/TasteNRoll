import { redirect } from "next/navigation";

// The counter opens on the live board. Everything else is one tap away in the
// navbar, but an unattended online order is the thing that cannot wait.
export default function OwnerIndex() {
  redirect("/owner/live");
}
