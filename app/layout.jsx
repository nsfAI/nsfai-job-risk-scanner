import "./globals.css";
import LaborTicker from "../components/LaborTicker";
import ThemeToggle from "../components/ThemeToggle";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-white text-black dark:bg-[#0f0f0f] dark:text-white transition-colors duration-300">
        <LaborTicker />

        <div className="mx-auto w-full max-w-6xl px-4 pt-4 flex justify-end">
          <ThemeToggle />
        </div>

        <div className="flex-1">
          {children}
        </div>

        <footer className="mt-16 border-t border-black/5 dark:border-white/10 py-6 text-center text-sm text-black/50 dark:text-white/40">
          Built by <span className="font-semibold text-black dark:text-white">rangnfa</span>
        </footer>
      </body>
    </html>
  );
}
