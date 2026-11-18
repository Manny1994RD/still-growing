-- Friends Circle: friends-only sharing, prayers and encouragement.

ALTER TABLE users ADD COLUMN friend_code text UNIQUE;
-- Circle is off until the user turns it on.
ALTER TABLE users ADD COLUMN circle_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN share_identity boolean NOT NULL DEFAULT false;
-- Lets friends see a gentle "needs encouragement" nudge after 3+ quiet days.
ALTER TABLE users ADD COLUMN share_struggling boolean NOT NULL DEFAULT false;
-- 'everyone' = friends can write custom messages · 'templates' = ready-made blessings only
ALTER TABLE users ADD COLUMN allow_messages text NOT NULL DEFAULT 'everyone' CHECK (allow_messages IN ('everyone', 'templates'));

CREATE TABLE friendships (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  -- for 'blocked', the user who blocked
  blocked_by   uuid REFERENCES users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (requester_id <> addressee_id)
);
-- One row per pair regardless of direction.
CREATE UNIQUE INDEX friendships_pair_idx ON friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));

CREATE TABLE encouragements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN ('prayer', 'message', 'verse')),
  template_id text,
  text        text NOT NULL DEFAULT '',
  ref         text,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX encouragements_to_idx ON encouragements (to_id, created_at DESC);
CREATE INDEX encouragements_from_idx ON encouragements (from_id, created_at DESC);

CREATE TABLE prayer_requests (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text       text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX prayer_requests_user_idx ON prayer_requests (user_id, expires_at);

CREATE TABLE prayer_responses (
  request_id uuid NOT NULL REFERENCES prayer_requests(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (request_id, user_id)
);

CREATE TABLE reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('user', 'encouragement', 'prayer_request')),
  target_id   uuid NOT NULL,
  reason      text NOT NULL DEFAULT '',
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'actioned')),
  created_at  timestamptz NOT NULL DEFAULT now()
);
