create extension if not exists pgcrypto;

create table if not exists candidates (
  id uuid primary key default gen_random_uuid(),
  ticker text not null unique,
  company_name text not null,
  division text not null,
  lane text,
  cik text,
  exchange text,
  status text not null default 'seeded',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists methodology_versions (
  version text primary key,
  effective_at timestamptz not null,
  description text not null,
  config jsonb not null,
  locked boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists universe_versions (
  version text primary key,
  target_size integer not null check (target_size > 0),
  trial_ticks_required integer not null default 1000 check (trial_ticks_required > 0),
  started_at timestamptz not null default now(),
  trial_completed_at timestamptz,
  dynamic_admission_enabled boolean not null default true,
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists research_ticks (
  id uuid primary key default gen_random_uuid(),
  universe_version text not null references universe_versions(version),
  tick_number bigint not null check (tick_number >= 0),
  tick_kind text not null check (tick_kind in ('baseline','observation','prototype_import')),
  captured_at timestamptz not null,
  methodology_version text not null references methodology_versions(version),
  status text not null check (status in ('started','completed','failed')),
  companies_expected integer not null check (companies_expected >= 0),
  companies_observed integer not null default 0 check (companies_observed >= 0),
  source_coverage_ratio numeric(5,4) not null default 0 check (source_coverage_ratio between 0 and 1),
  source_coverage jsonb not null default '{}'::jsonb,
  discovery_scan_completed boolean not null default false,
  qualifies_for_trial boolean not null default false,
  new_discoveries integer not null default 0 check (new_discoveries >= 0),
  material_changes integer not null default 0 check (material_changes >= 0),
  error_note text,
  created_at timestamptz not null default now(),
  unique(universe_version, tick_number, tick_kind)
);

create table if not exists discovery_source_runs (
  id uuid primary key default gen_random_uuid(),
  research_tick_id uuid not null references research_ticks(id) on delete cascade,
  source_id text not null,
  checked_at timestamptz not null,
  status text not null check (status in ('success','partial','failed','not_due')),
  records_seen bigint,
  new_candidates integer not null default 0 check (new_candidates >= 0),
  note text,
  created_at timestamptz not null default now(),
  unique(research_tick_id, source_id)
);

create table if not exists score_snapshots (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  research_tick_id uuid references research_ticks(id) on delete set null,
  captured_at timestamptz not null,
  methodology_version text not null references methodology_versions(version),
  earth_score numeric(5,2) not null check (earth_score between 0 and 100),
  thesis_quality numeric(5,2) not null check (thesis_quality between 0 and 100),
  financial_operating_momentum numeric(5,2) not null check (financial_operating_momentum between 0 and 100),
  market_valuation_opportunity numeric(5,2) not null check (market_valuation_opportunity between 0 and 100),
  catalyst_score numeric(5,2) not null check (catalyst_score between 0 and 100),
  governance_power numeric(5,2) not null check (governance_power between 0 and 100),
  alignment_2036 numeric(5,2) not null check (alignment_2036 between 0 and 100),
  cross_division_leverage numeric(5,2) not null check (cross_division_leverage between 0 and 100),
  bottleneck_control numeric(5,2) not null check (bottleneck_control between 0 and 100),
  scenario_robustness numeric(5,2) not null check (scenario_robustness between 0 and 100),
  substitution_resilience numeric(5,2) not null check (substitution_resilience between 0 and 100),
  supply_chain_resilience numeric(5,2) not null check (supply_chain_resilience between 0 and 100),
  pricing_power numeric(5,2) not null check (pricing_power between 0 and 100),
  data_confidence numeric(5,2) not null check (data_confidence between 0 and 100),
  risk numeric(5,2) not null check (risk between 0 and 100),
  opportunity_score numeric(5,2) check (opportunity_score between 0 and 100),
  publishable boolean not null default false,
  unique(candidate_id, captured_at, methodology_version)
);

create table if not exists ranking_snapshots (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  research_tick_id uuid references research_ticks(id) on delete set null,
  cadence text not null check (cadence in ('tick','weekly','monthly','quarterly','annual')),
  period_key text not null,
  rank integer not null check (rank > 0),
  earth_score numeric(5,2) not null check (earth_score between 0 and 100),
  data_confidence numeric(5,2) not null check (data_confidence between 0 and 100),
  captured_at timestamptz not null default now(),
  unique(candidate_id, cadence, period_key)
);

create table if not exists candidate_observation_state (
  candidate_id uuid primary key references candidates(id) on delete cascade,
  universe_version text not null references universe_versions(version),
  first_tick_number bigint not null check (first_tick_number >= 0),
  latest_tick_number bigint not null check (latest_tick_number >= first_tick_number),
  ticks_observed bigint not null default 0 check (ticks_observed >= 0),
  maturity_status text not null default 'rookie' check (maturity_status in ('rookie','seasoned','trial_complete')),
  updated_at timestamptz not null default now()
);

create table if not exists universe_membership_snapshots (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  universe_version text not null references universe_versions(version),
  slot_class text not null check (slot_class in ('championship','contender')),
  admitted_at timestamptz not null,
  exited_at timestamptz,
  admission_reason text not null,
  exit_reason text,
  unique(candidate_id, universe_version, admitted_at)
);

create table if not exists promotion_events (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  research_tick_id uuid references research_ticks(id) on delete set null,
  event_time timestamptz not null,
  from_rank integer,
  to_rank integer not null check (to_rank > 0),
  from_class text check (from_class in ('championship','contender','outside_universe')),
  to_class text not null check (to_class in ('championship','contender','outside_universe')),
  earth_score numeric(5,2) not null check (earth_score between 0 and 100),
  boundary_margin numeric(6,2),
  reason text not null,
  methodology_version text not null references methodology_versions(version),
  created_at timestamptz not null default now()
);

create table if not exists evidence_events (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references candidates(id) on delete cascade,
  research_tick_id uuid references research_ticks(id) on delete set null,
  event_time timestamptz not null,
  discovered_at timestamptz not null default now(),
  category text not null,
  resource_class text not null check (resource_class in ('wood','hay','iron','gold','diamond')),
  headline text not null,
  concise_note text not null,
  source_id text,
  source_reliability numeric(2,1) not null check (source_reliability between 0 and 5),
  magnitude numeric(2,1) not null check (magnitude between 0 and 5),
  novelty numeric(2,1) not null check (novelty between 0 and 5),
  durability numeric(2,1) not null check (durability between 0 and 5),
  direction numeric(3,2) not null check (direction between -1 and 1),
  confidence numeric(3,2) not null check (confidence between 0 and 1),
  earth_score_impact numeric(6,2),
  risk_impact numeric(6,2),
  primary_source_url text,
  confirming_source_url text,
  next_confirmation text,
  source_fingerprint text,
  created_at timestamptz not null default now()
);

create unique index if not exists evidence_source_fingerprint_idx on evidence_events(source_fingerprint) where source_fingerprint is not null;

create table if not exists forecasts (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  research_tick_id uuid references research_ticks(id) on delete set null,
  issued_at timestamptz not null,
  model_version text not null,
  reference_price numeric(18,6) not null,
  horizon text not null check (horizon in ('24h','72h','7d','15d','21d','28d')),
  expected_return numeric(9,6),
  bear_return numeric(9,6),
  bull_return numeric(9,6),
  probability_up numeric(5,4),
  confidence numeric(5,4),
  actual_return numeric(9,6),
  resolved_at timestamptz,
  unique(candidate_id, issued_at, model_version, horizon)
);

create table if not exists people_power (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  person_name text not null,
  current_role text not null,
  committee_authority text,
  ownership_pct numeric(8,4),
  influence_score numeric(5,2),
  operator_quality numeric(5,2),
  capital_allocation numeric(5,2),
  technical_relevance numeric(5,2),
  governance_alignment numeric(5,2),
  execution_track_record numeric(5,2),
  promise_delivery_pct numeric(5,2),
  source_url text,
  valid_from timestamptz not null default now(),
  valid_to timestamptz
);

create table if not exists discovery_candidates (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  ticker text,
  cik text,
  exchange text,
  primary_division text,
  lane text,
  listing_stage text not null default 'private_signal' check (listing_stage in ('private_signal','filed','registered','priced','trading','otc','delisted')),
  status text not null default 'outside_universe' check (status in ('outside_universe','probation','admitted','rejected','archived')),
  first_detected_at timestamptz not null default now(),
  last_detected_at timestamptz not null default now(),
  detection_source text not null,
  first_source_url text,
  latest_source_url text,
  discovery_score numeric(6,2),
  data_confidence numeric(5,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists discovery_candidates_cik_idx on discovery_candidates(cik) where cik is not null;
create index if not exists discovery_candidates_ticker_exchange_idx on discovery_candidates(ticker, exchange) where ticker is not null;

create table if not exists listing_events (
  id uuid primary key default gen_random_uuid(),
  discovery_candidate_id uuid references discovery_candidates(id) on delete cascade,
  event_time timestamptz not null,
  event_type text not null check (event_type in ('s1','f1','8a','direct_listing','ipo_priced','de_spac','uplist','otc_addition','ticker_change','delisting','other')),
  form_type text,
  source_name text not null,
  source_url text not null,
  verified boolean not null default false,
  source_fingerprint text,
  created_at timestamptz not null default now()
);

create unique index if not exists listing_event_source_fingerprint_idx on listing_events(source_fingerprint) where source_fingerprint is not null;

create table if not exists universe_boundary_events (
  id uuid primary key default gen_random_uuid(),
  universe_version text not null references universe_versions(version),
  research_tick_id uuid references research_ticks(id) on delete set null,
  effective_tick_number bigint not null check (effective_tick_number >= 0),
  incoming_candidate_id uuid not null references candidates(id),
  outgoing_candidate_id uuid references candidates(id),
  incoming_score numeric(6,2),
  outgoing_score numeric(6,2),
  confidence_adjusted_margin numeric(6,2),
  reason text not null,
  evidence_bundle jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists causal_nodes (
  id uuid primary key default gen_random_uuid(),
  node_type text not null check (node_type in ('company','technology','resource','infrastructure','human_need','regulation','geography','market')),
  canonical_key text not null,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(node_type, canonical_key)
);

create table if not exists causal_edges (
  id uuid primary key default gen_random_uuid(),
  source_node_id uuid not null references causal_nodes(id) on delete cascade,
  target_node_id uuid not null references causal_nodes(id) on delete cascade,
  relationship text not null check (relationship in ('depends_on','enables','supplies','substitutes_for','competes_with','benefits_from','threatened_by','constrained_by','serves_need')),
  strength numeric(5,2) not null check (strength between 0 and 100),
  confidence numeric(5,2) not null check (confidence between 0 and 100),
  direction numeric(3,2) not null default 1 check (direction between -1 and 1),
  methodology_version text not null references methodology_versions(version),
  source_urls jsonb not null default '[]'::jsonb,
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  created_at timestamptz not null default now(),
  unique(source_node_id, target_node_id, relationship, valid_from)
);
