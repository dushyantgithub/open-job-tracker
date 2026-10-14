ALTER TABLE requests ADD COLUMN target INTEGER;
ALTER TABLE requests ADD COLUMN base_total INTEGER;
ALTER TABLE requests ADD COLUMN worker_id TEXT;
ALTER TABLE requests ADD COLUMN completed_at TEXT;
CREATE UNIQUE INDEX requests_one_active ON requests ((1)) WHERE status IN ('queued', 'acknowledged', 'pausing');
CREATE TABLE submission_keys (
  canonical_url TEXT PRIMARY KEY NOT NULL,
  job_id TEXT NOT NULL UNIQUE
);
