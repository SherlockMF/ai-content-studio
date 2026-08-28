import { AppStoreProvider } from "@/lib/store/app-store";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <AppStoreProvider>{children}</AppStoreProvider>;
}
