import "./globals.css";
import LaborTicker from "./components/LaborTicker";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-white text-black">
        <LaborTicker />

        <div className="flex-1">{children}</div>

        <footer className="mt-16 border-t border-black/5 py-6 text-center text-sm text-black/50">
          Built by <span className="font-semibold text-black">rangnfa</span>
        </footer>
      </body>
    </html>
  );
}