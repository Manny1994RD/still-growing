-- Still Growing: initial schema

CREATE TABLE users (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email              text NOT NULL UNIQUE,
  password_hash      text NOT NULL,
  name               text NOT NULL DEFAULT '',
  tone               text NOT NULL DEFAULT 'gentle' CHECK (tone IN ('gentle', 'scripture', 'coach')),
  vision             text NOT NULL DEFAULT '',
  identity_statement text NOT NULL DEFAULT '',
  morning_time       text NOT NULL DEFAULT '07:00',
  evening_time       text NOT NULL DEFAULT '20:00',
  onboarded          boolean NOT NULL DEFAULT false,
  -- highest growth season reached; seasons never go backwards
  season             text NOT NULL DEFAULT 'seed',
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- Built-in categories have user_id NULL; custom categories belong to a user.
CREATE TABLE categories (
  id                 text PRIMARY KEY,
  user_id            uuid REFERENCES users(id) ON DELETE CASCADE,
  name               text NOT NULL,
  icon               text NOT NULL,
  sort               integer NOT NULL DEFAULT 100,
  private_by_default boolean NOT NULL DEFAULT false
);

CREATE TABLE habits (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id   text NOT NULL REFERENCES categories(id),
  name          text NOT NULL,
  -- do: yes/no · count: reach a number · time: reach minutes · weekly: N times a week · refrain: stay free
  type          text NOT NULL CHECK (type IN ('do', 'count', 'time', 'weekly', 'refrain')),
  target        integer NOT NULL DEFAULT 1 CHECK (target > 0),
  unit          text NOT NULL DEFAULT '',
  -- bitmask of scheduled weekdays, bit 0 = Sunday … bit 6 = Saturday (127 = every day)
  days_mask     integer NOT NULL DEFAULT 127 CHECK (days_mask BETWEEN 1 AND 127),
  reminder_time text,
  share_name    boolean NOT NULL DEFAULT false,
  archived      boolean NOT NULL DEFAULT false,
  sort          integer NOT NULL DEFAULT 0,
  start_date    date NOT NULL DEFAULT CURRENT_DATE,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX habits_user_idx ON habits (user_id) WHERE NOT archived;

CREATE TABLE check_ins (
  habit_id   uuid NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date       date NOT NULL,
  value      integer NOT NULL DEFAULT 1 CHECK (value >= 0),
  -- done: progress logged · rest: planned rest day · slipped: refrain habit broken
  status     text NOT NULL DEFAULT 'done' CHECK (status IN ('done', 'rest', 'slipped')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (habit_id, date)
);
CREATE INDEX check_ins_user_date_idx ON check_ins (user_id, date);

CREATE TABLE reflections (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date       date NOT NULL,
  type       text NOT NULL CHECK (type IN ('evening', 'ping', 'missed_reason')),
  answers    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reflections_user_date_idx ON reflections (user_id, date);

INSERT INTO categories (id, name, icon, sort, private_by_default) VALUES
  ('faith',         'Faith',                  'book-open',  1,  false),
  ('church',        'Church & Community',     'home',       2,  false),
  ('outreach',      'Outreach & Service',     'heart',      3,  false),
  ('health',        'Health & Nutrition',     'droplet',    4,  false),
  ('fitness',       'Fitness & Movement',     'activity',   5,  false),
  ('rest',          'Rest & Self-care',       'moon',       6,  false),
  ('freedom',       'Freedom',                'unlock',     7,  true),
  ('mind',          'Mind & Growth',          'feather',    8,  false),
  ('relationships', 'Family & Relationships', 'users',      9,  false),
  ('stewardship',   'Stewardship',            'briefcase',  10, false);
