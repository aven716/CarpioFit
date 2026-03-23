import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { supabase } from "../lib/supabase";
import SplashScreenComponent from "./components/SplashScreenComponent";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [showSplash, setShowSplash] = useState(true);

  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const initialize = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      if (session?.user) {
        await checkProfile(session.user.id);
      }
      setLoading(false);
    };

    initialize();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        if (session?.user) {
          await checkProfile(session.user.id);
        } else {
          setHasProfile(null);
        }
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  const checkProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    setHasProfile(!!data);
  };

  useEffect(() => {
    if (!session?.user) return;
    const recheck = async () => {
      await checkProfile(session.user.id);
    };
    recheck();
  }, [segments]);

  useEffect(() => {
    if (loading) return;
    if (session && hasProfile === null) return;

    const inAuth = segments[0] === "auth";
    const inOnboarding = segments[0] === "onboarding";

    if (!session && !inAuth) {
      router.replace("/auth/login");
      return;
    }
    if (session && hasProfile === false && !inOnboarding) {
      router.replace("/onboarding");
      return;
    }
    if (session && hasProfile === true && (inAuth || inOnboarding)) {
      router.replace("/tabs");
    }
  }, [session, hasProfile, segments, loading]);

  useEffect(() => {
    if (!loading && (session ? hasProfile !== null : true)) {
      SplashScreen.hideAsync();
    }
  }, [loading, session, hasProfile]);

  // ✅ All hooks above — early returns below
  if (showSplash) {
    return <SplashScreenComponent onFinish={() => setShowSplash(false)} />;
  }

  if (loading || (session && hasProfile === null)) {
    return <View style={{ flex: 1, backgroundColor: "#0a0a0a" }} />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}