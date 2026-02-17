"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "dark") {
      document.documentElement.classList.add("dark");
      setDark(true);
    }
  }, []);

  function toggle() {
    if (dark) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
      setDark(false);
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
      setDark(true);
    }
  }

  return (
    <button
      onClick={toggle}
      className="rounded-xl border border-black/10 dark:border-white/20 bg-white dark:bg-[#141414] px-4 py-2 text-sm font-semibold transition hover:bg-black/5 dark:hover:bg-white/10"
    >
      {dark ? "Light Mode" : "Dark Mode"}
    </button>
  );
}
