import type { Metadata } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import "mapbox-gl/dist/mapbox-gl.css";
import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/session";
import { users } from "@/lib/data";

export const metadata: Metadata = { title: "Billboard Exchange", description: "Programmatic digital billboard marketplace for Hyderabad" };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();
  const user = session ? users.find((item) => item.id === session.userId) : undefined;
  return (
    <html lang="en">
      <body>
        <AppShell session={session && user ? { userId: user.id, name: user.name, role: session.role } : null}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
