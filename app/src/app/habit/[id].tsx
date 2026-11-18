import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Habit } from "@/lib/types";
import { ErrorText, Loading, Screen } from "@/ui/components";
import { HabitForm } from "@/ui/HabitForm";

export default function EditHabit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [habit, setHabit] = useState<Habit | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .habits()
      .then((r) => {
        const h = r.habits.find((x) => x.id === id);
        if (h) setHabit(h);
        else setError("Habit not found.");
      })
      .catch((e) => setError(e.message));
  }, [id]);

  if (error)
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
      </Screen>
    );
  if (!habit) return <Loading />;
  return <HabitForm habit={habit} />;
}
