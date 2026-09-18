create table if not exists candidate_aliases (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  alias_type text not null check (alias_type in ('ticker','company_name','cik','exchange_symbol')),
  alias_value text not null,
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  source_url text,
  unique(candidate_id, alias_type, alias_value, valid_from)
);

create table if not exists source_health (
  id uuid primary key default gen_random_uuid(),
  source_id text not null,
  checked_at timestamptz not null,
  authority text not null,
  cadence text not null,
  required_for_tick boolean not null default false,
  status text not null check (status in ('healthy','degraded','unhealthy','failed','unknown')),
  coverage numeric(5,4) not null default 0 check (coverage between 0 and 1),
  latency_ms integer,
  last_success timestamptz,
  last_failure timestamptz,
  fallback_source_id text,
  note text,
  unique(source_id, checked_at)
);

create table if not exists score_input_snapshots (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  research_tick_id uuid references research_ticks(id) on delete set null,
  captured_at timestamptz not null,
  methodology_version text not null references methodology_versions(version),
  component text not null,
  factor_key text not null,
  factor_value numeric(5,2) not null check (factor_value between 0 and 100),
  factor_weight numeric(6,5) not null check (factor_weight > 0 and factor_weight <= 1),
  source_ids jsonb not null default '[]'::jsonb,
  note text not null,
  created_at timestamptz not null default now(),
  unique(candidate_id, captured_at, methodology_version, component, factor_key)
);

create table if not exists evidence_review_queue (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references candidates(id) on delete cascade,
  source_id text not null,
  source_fingerprint text not null,
  detected_at timestamptz not null,
  source_url text not null,
  event_type text,
  status text not null default 'pending' check (status in ('pending','reviewing','resolved','rejected')),
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now(),
  unique(source_fingerprint)
);

create table if not exists structural_signals (
  id uuid primary key default gen_random_uuid(),
  signal_key text not null,
  signal_kind text not null check (signal_kind in ('abundance','scarcity','substitution','premiumization','dependency','displacement','human_demand_shift')),
  subject_node_id uuid not null references causal_nodes(id) on delete cascade,
  direction numeric(3,2) not null check (direction between -1 and 1),
  magnitude numeric(5,2) not null check (magnitude between 0 and 100),
  confidence numeric(5,2) not null check (confidence between 0 and 100),
  time_horizon text not null check (time_horizon in ('0-12m','1-3y','3-5y','5-10y')),
  thesis text not null,
  falsifier text not null,
  source_urls jsonb not null default '[]'::jsonb,
  observed_at timestamptz not null,
  valid_to timestamptz,
  unique(signal_key, observed_at)
);

create table if not exists roadmap_milestones (
  id uuid primary key default gen_random_uuid(),
  milestone_key text not null,
  target_year integer not null check (target_year between 2026 and 2100),
  theme text not null,
  hypothesis text not null,
  metric text not null,
  target_or_trigger text not null,
  current_value text,
  direction text check (direction in ('ahead','on_track','behind','unknown')),
  confidence numeric(5,2) not null check (confidence between 0 and 100),
  linked_node_ids jsonb not null default '[]'::jsonb,
  source_urls jsonb not null default '[]'::jsonb,
  last_updated timestamptz not null,
  unique(milestone_key, last_updated)
);

create index if not exists source_health_source_checked_idx on source_health(source_id, checked_at desc);
create index if not exists score_input_candidate_idx on score_input_snapshots(candidate_id, captured_at desc);
create index if not exists evidence_review_status_idx on evidence_review_queue(status, detected_at desc);
create index if not exists structural_signal_subject_idx on structural_signals(subject_node_id, observed_at desc);
