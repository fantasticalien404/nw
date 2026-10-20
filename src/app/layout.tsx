import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import { Navbar } from "@/components/ui/navbar";
import { UserProfile, UserProfileFallback } from "@/components/ui/user-profile";
import { loadCachedAppSettings } from "./load-app-settings";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Site name and description come from `costants`; pages add their own title before the name. */
export async function generateMetadata(): Promise<Metadata> {
  const { appName, appDescription } = await loadCachedAppSettings();
  return { title: { default: appName, template: `%s · ${appName}` }, description: appDescription };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Navbar
          profile={
            <Suspense fallback={<UserProfileFallback />}>
              <UserProfile />
            </Suspense>
          }
        />
        {children}
      </body>
    </html>
  );
}
