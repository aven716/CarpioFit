import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function RootLayout() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);

  const router = useRouter();
  const segments = useSegments();

  // 🔹 Get session + profile
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

  // 🔹 Profile checker function
  const checkProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    setHasProfile(!!data);
  };

  // 🔹 Re-check profile on route changes (prevents bouncing after onboarding)
  useEffect(() => {
    if (!session?.user) return;

    const recheck = async () => {
      await checkProfile(session.user.id);
    };

    recheck();
  }, [segments]);

  // 🔹 Redirect logic
  useEffect(() => {
    if (loading) return;
    if (session && hasProfile === null) return; // wait for profile check

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

  if (loading || (session && hasProfile === null)) {
    return null; // prevents flicker
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}