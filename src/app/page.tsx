import { headers } from "next/headers";
import { Chat } from "@/components/chat";
import { isBlockedRegion } from "@/lib/geo";

export default async function Home() {
  return <Chat blocked={isBlockedRegion(await headers())} />;
}
