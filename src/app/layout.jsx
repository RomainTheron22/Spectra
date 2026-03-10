import "../styles/tokens.css";
import "../styles/globals.css";

import AppShell from "../components/layout/AppShell";
import { ensureAuthSetup } from "../lib/auth";

export const metadata = {
  title: "Spectra",
  description: "Spectra internal app",
};

export default async function RootLayout({ children }) {
  await ensureAuthSetup();

  return (
    <html lang="fr">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
