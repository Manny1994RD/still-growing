-- v0.5: personal habits, notes, rewards, achievements, challenges, password reset.

-- Personal touches on each habit.
ALTER TABLE habits ADD COLUMN emoji text NOT NULL DEFAULT '';
ALTER TABLE habits ADD COLUMN color text NOT NULL DEFAULT '';
ALTER TABLE habits ADD COLUMN why text NOT NULL DEFAULT '';
ALTER TABLE habits ADD COLUMN part_of_day text NOT NULL DEFAULT 'any'
  CHECK (part_of_day IN ('any', 'morning', 'afternoon', 'evening'));
-- Several reminder times per habit, as ["07:00","12:00"].
ALTER TABLE habits ADD COLUMN reminders jsonb NOT NULL DEFAULT '[]'::jsonb;
UPDATE habits SET reminders = jsonb_build_array(reminder_time) WHERE reminder_time IS NOT NULL;
-- Habits created by a guided challenge end on a set date.
ALTER TABLE habits ADD COLUMN challenge_key text;
ALTER TABLE habits ADD COLUMN end_date date;

-- A short note with a check-in ("Read Psalm 23").
ALTER TABLE check_ins ADD COLUMN note text NOT NULL DEFAULT '';

CREATE TABLE achievements (
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key         text NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

-- Personal reward goals: "At 30 days of walking, I'll buy new running shoes."
CREATE TABLE reward_goals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  habit_id    uuid REFERENCES habits(id) ON DELETE CASCADE,
  title       text NOT NULL,
  target_days integer NOT NULL CHECK (target_days BETWEEN 1 AND 1000),
  start_date  date NOT NULL DEFAULT CURRENT_DATE,
  achieved_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reward_goals_user_idx ON reward_goals (user_id);

CREATE TABLE user_challenges (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge_key text NOT NULL,
  start_date    date NOT NULL,
  end_date      date NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_challenges_user_idx ON user_challenges (user_id);
CREATE INDEX user_challenges_key_idx ON user_challenges (challenge_key, end_date);

CREATE TABLE password_resets (
  user_id    uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  code_hash  text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts   integer NOT NULL DEFAULT 0
);
