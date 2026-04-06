import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState } from "react";

export type Lang = "en" | "tl";
export type ThemeMode = "dark" | "light";

interface AppContextValue {
    lang: Lang;
    setLang: (l: Lang) => void;
    theme: ThemeMode;
    setTheme: (t: ThemeMode) => void;
    isDark: boolean;
    colors: typeof DARK;
}

export const DARK = {
    bg: "#0a0a0a",
    surface: "#111",
    surface2: "#1a1a1a",
    surface3: "#2a2a2a",
    border: "#2a2a2a",
    border2: "#1a1a1a",
    text: "#ffffff",
    textSub: "#888888",
    textMuted: "#555555",
    green: "#22c55e",
    orange: "#f97316",
    blue: "#3b82f6",
    purple: "#a855f7",
    red: "#ef4444",
    cardGreen: "#1a3329",
    cardGreenBorder: "#1a2e22",
    inputBg: "#1a1a1a",
    modalBg: "#111111",
    overlayBg: "rgba(0,0,0,0.80)",
};

export const LIGHT = {
    bg: "#f4f4f5",
    surface: "#ffffff",
    surface2: "#f1f5f9",
    surface3: "#e2e8f0",
    border: "#e2e8f0",
    border2: "#f1f5f9",
    text: "#0f172a",
    textSub: "#64748b",
    textMuted: "#94a3b8",
    green: "#16a34a",
    orange: "#ea580c",
    blue: "#2563eb",
    purple: "#9333ea",
    red: "#dc2626",
    cardGreen: "#dcfce7",
    cardGreenBorder: "#bbf7d0",
    inputBg: "#f8fafc",
    modalBg: "#ffffff",
    overlayBg: "rgba(0,0,0,0.50)",
};

export const T: Record<Lang, Record<string, string>> = {
    en: {
        settings: "Settings",
        notifications: "Workout Reminders",
        language: "Language",
        darkMode: "Dark Mode",
        helpSupport: "Help & Support",
        logout: "Logout",
        logoutConfirm: "Are you sure you want to logout?",
        activityStats: "Activity Stats",
        achievements: "Achievements",
        personalInfo: "Personal Information",
        weightProgress: "Weight Progress",
        totalBurned: "Total Burned",
        workouts: "Workouts",
        totalDistance: "Total Distance",
        activeDays: "Active Days",
        age: "Age",
        gender: "Gender",
        currentWeight: "Current Weight",
        goalWeight: "Goal Weight",
        dayStreak: "day streak",
        noAchievements: "No achievements yet",
        noWorkouts: "No workouts logged today",
        reminderTimeSub: "Pick when you want your daily workout reminder (PHT)",
        save: "Save",
        cancel: "Cancel",
        chooseTime: "Choose reminder time",
        ticketSubject: "Subject",
        ticketMessage: "Describe your issue or question",
        sendTicket: "Send Ticket",
        sending: "Sending...",
        ticketSent: "Ticket sent! We'll get back to you soon.",
        ticketError: "Could not send ticket. Please try again.",
        chatDev: "Chat with Developers",
        orLabel: "or",
        helpTitle: "Help & Support",
        years: "years",
        km: "km",
        greeting: "Hey",
        readyToCrush: "Ready to crush your goals today?",
        dailyCalories: "Daily Calories",
        remaining: "remaining",
        goalExceeded: "Goal exceeded",
        logFood: "Log Food",
        goal: "Goal",
        eaten: "Eaten",
        burned: "Burned",
        left: "Left",
        protein: "Protein",
        carbs: "Carbs",
        fat: "Fat",
        community: "Community",
        createPost: "Create Post",
        trendingTopics: "Trending Topics",
        foodLogging: "Food Logging",
        addFood: "Add Food",
        noItemsLogged: "No items logged yet",
    },
    tl: {
        settings: "Mga Setting",
        notifications: "Paalala sa Workout",
        language: "Wika",
        darkMode: "Dark Mode",
        helpSupport: "Tulong at Suporta",
        logout: "Mag-logout",
        logoutConfirm: "Sigurado ka bang gusto mong mag-logout?",
        activityStats: "Mga Istatistika",
        achievements: "Mga Tagumpay",
        personalInfo: "Personal na Impormasyon",
        weightProgress: "Progreso ng Timbang",
        totalBurned: "Kabuuang Nasunog",
        workouts: "Mga Ehersisyo",
        totalDistance: "Kabuuang Distansya",
        activeDays: "Aktibong Araw",
        age: "Edad",
        gender: "Kasarian",
        currentWeight: "Kasalukuyang Timbang",
        goalWeight: "Target na Timbang",
        dayStreak: "araw na streak",
        noAchievements: "Wala pang tagumpay",
        noWorkouts: "Walang ehersisyo ngayong araw",
        reminderTimeSub: "Piliin kung kailan mo gustong matanggap ang paalala sa workout (PHT)",
        save: "I-save",
        cancel: "Kanselahin",
        chooseTime: "Piliin ang oras ng paalala",
        ticketSubject: "Paksa",
        ticketMessage: "Ilarawan ang iyong isyu o tanong",
        sendTicket: "Magpadala ng Ticket",
        sending: "Nagpapadala...",
        ticketSent: "Naipadala! Makikipag-ugnayan kami sa iyo.",
        ticketError: "Hindi mapadala. Subukan muli.",
        chatDev: "Makipag-chat sa mga Developer",
        orLabel: "o",
        helpTitle: "Tulong at Suporta",
        years: "taon",
        km: "km",
        greeting: "Hoy",
        readyToCrush: "Handa ka na bang lampasan ang iyong mga layunin ngayon?",
        dailyCalories: "Araw-araw na Calories",
        remaining: "natitira",
        goalExceeded: "Nalampasan ang layunin",
        logFood: "Itala ang Pagkain",
        goal: "Layunin",
        eaten: "Kinain",
        burned: "Nasunog",
        left: "Natitira",
        protein: "Protina",
        carbs: "Carbs",
        fat: "Taba",
        community: "Komunidad",
        createPost: "Gumawa ng Post",
        trendingTopics: "Mga Trending na Paksa",
        foodLogging: "Pagtatala ng Pagkain",
        addFood: "Magdagdag ng Pagkain",
        noItemsLogged: "Wala pang naitala",
    },
};

const AppContext = createContext<AppContextValue>({
    lang: "en",
    setLang: () => { },
    theme: "dark",
    setTheme: () => { },
    isDark: true,
    colors: DARK,
});

export function AppProvider({ children }: { children: React.ReactNode }) {
    const [lang, setLangState] = useState<Lang>("en");
    const [theme, setThemeState] = useState<ThemeMode>("dark");

    useEffect(() => {
        (async () => {
            try {
                const [savedLang, savedTheme] = await Promise.all([
                    AsyncStorage.getItem("appLang"),
                    AsyncStorage.getItem("appTheme"),
                ]);
                if (savedLang === "en" || savedLang === "tl") setLangState(savedLang);
                if (savedTheme === "dark" || savedTheme === "light") setThemeState(savedTheme);
            } catch { }
        })();
    }, []);

    const setLang = async (l: Lang) => {
        setLangState(l);
        await AsyncStorage.setItem("appLang", l).catch(() => { });
    };

    const setTheme = async (t: ThemeMode) => {
        setThemeState(t);
        await AsyncStorage.setItem("appTheme", t).catch(() => { });
    };

    const isDark = theme === "dark";
    const colors = isDark ? DARK : LIGHT;

    return (
        <AppContext.Provider value={{ lang, setLang, theme, setTheme, isDark, colors }}>
            {children}
        </AppContext.Provider>
    );
}

export function useApp() {
    return useContext(AppContext);
}
// NO default export here