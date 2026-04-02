import { supabase } from "./supabase";

const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY;
const GROQ_MODEL = "llama-3.1-8b-instant";

export interface Exercise {
    name: string;
    sets: number;
    reps: string | null;
    duration: string | null;
    
}

export interface DayPlan {
    day: string;
    isRest: boolean;
    focus: string;
    exercises: Exercise[];
}

export interface WorkoutPlan {
    weekPlan: DayPlan[];
}

export async function fetchOrGenerateWorkoutPlan(
    userId: string,
    profile: any
): Promise<WorkoutPlan | null> {
    try {
        // Always check DB first — if a plan exists, return it immediately, no generation
        const { data, error } = await supabase
            .from("workout_plans")
            .select("plan")
            .eq("user_id", userId)
            .maybeSingle(); // maybeSingle returns null instead of error if no row found

        if (data?.plan) {
            // Plan already exists — return it, do NOT generate a new one
            return data.plan as WorkoutPlan;
        }

        // Only reaches here if no plan exists at all (first time user)
        return await generateAndSavePlan(userId, profile);
    } catch {
        return null;
    }
}

export async function generateAndSavePlan(
    userId: string,
    profile: any,
    instruction?: string
): Promise<WorkoutPlan | null> {
    try {
        const prompt = `
User profile:
- Age: ${profile.age}, Gender: ${profile.gender}
- Weight: ${profile.weight_kg}kg, Height: ${profile.height_cm}cm
- Fitness goal: ${profile.goal}
- Activity level: ${profile.activity_level}
- Daily calories: ${profile.daily_calories} kcal

${instruction ? `User's specific request: "${instruction}"` : "Generate a balanced weekly workout plan."}

Respond ONLY with valid JSON. No explanation, no markdown, no extra text before or after.
{
  "weekPlan": [
    {
      "day": "Monday",
      "isRest": false,
      "focus": "Chest & Triceps",
      "exercises": [
        { "name": "Push-ups", "sets": 3, "reps": "12-15", "duration": null },
        { "name": "Running", "sets": 1, "reps": null, "duration": "20 min" }
      ]
    },
    {
      "day": "Sunday",
      "isRest": true,
      "focus": "Rest & Recovery",
      "exercises": []
    }
  ]
}
All 7 days Monday through Sunday must be included.
`;

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${GROQ_API_KEY}`,
            },
            body: JSON.stringify({
                model: GROQ_MODEL,
                messages: [
                    {
                        role: "system",
                        content: "You are a fitness plan generator. Respond ONLY with valid JSON. No markdown, no explanation.",
                    },
                    { role: "user", content: prompt },
                ],
                max_tokens: 1500,
                temperature: 0.7,
            }),
        });

        const data = await response.json();
        const raw = data.choices[0].message.content;
        const clean = raw.replace(/```json|```/g, "").trim();
        const plan: WorkoutPlan = JSON.parse(clean);

        // Delete any existing plan for this user first, then insert fresh
        await supabase.from("workout_plans").delete().eq("user_id", userId);
        await supabase.from("workout_plans").insert({
            user_id: userId,
            plan,
            updated_at: new Date().toISOString(),
        });

        return plan;
    } catch {
        return null;
    }
}