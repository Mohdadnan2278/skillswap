export type ThemePreference = "light" | "dark" | "system";
export const themeStorageKey = "skillswap-theme";

// Fixed script: validate stored preferences and apply the theme before first paint.
export const themeBootScript = `(function(){var p="system";try{var s=localStorage.getItem("skillswap-theme");if(s==="light"||s==="dark")p=s}catch(e){}document.documentElement.dataset.theme=p==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):p})()`;
