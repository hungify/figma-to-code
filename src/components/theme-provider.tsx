import { createContext, use, useEffect } from "react";

type Theme = "dark" | "light" | "system";

type ThemeProviderProps = {
  children: React.ReactNode;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeProviderContext = createContext<ThemeProviderState>({
  theme: "light",
  setTheme: () => {},
});

function applyLightTheme() {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add("light");
  root.style.colorScheme = "light";
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  useEffect(() => {
    applyLightTheme();
  }, []);

  return (
    <ThemeProviderContext value={{ theme: "light", setTheme: () => {} }}>
      {children}
    </ThemeProviderContext>
  );
}

export function useTheme() {
  const context = use(ThemeProviderContext);

  if (context === undefined) throw new Error("useTheme must be used within a ThemeProvider");

  return context;
}
