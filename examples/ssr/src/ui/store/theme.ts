import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';
import type {StateStorage} from 'zustand/middleware';

const cookieStorage: StateStorage = {
    getItem: (name: string): string | null => {
        const cookie = document.cookie.split('; ').find((str) => str.startsWith(name));
        return cookie?.split('=')?.[1] ?? null;
    },
    setItem: (name: string, value: string): void => {
        document.cookie = `${name}=${value}; path=${'/'}; max-age=${365 * 24 * 60 * 60}`;
    },
    removeItem: (name: string): void => {
        document.cookie = `${name}=; path=${'/'}; max-age=${-99999999}`;
    },
};

export type Theme = 'light' | 'dark';

interface ThemeState {
    theme: Theme;
    setTheme: (theme: Theme) => void;
}

let initialTheme: Theme = 'light';
if (typeof document !== 'undefined') {
    const cookie = document.cookie.split('; ').find((str) => str.startsWith('theme-storage'));
    const v = cookie?.split('=')?.[1] ?? null;
    if (v) {
        const {
            state: {theme},
        } = JSON.parse(v);
        initialTheme = theme;
    }
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set) => ({
            theme: initialTheme,
            setTheme: (theme: 'light' | 'dark') => set({theme}),
        }),
        {
            name: 'theme-storage',
            storage: createJSONStorage(() => cookieStorage),
        },
    ),
);
