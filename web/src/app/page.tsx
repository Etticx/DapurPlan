import { redirect } from "next/navigation";
import { getOwnerSession } from "@/lib/auth";

export default async function Page() {
  redirect((await getOwnerSession()) ? "/home" : "/login");
}
