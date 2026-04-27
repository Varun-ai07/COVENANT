-- Database schema for payments table
-- This should be run in your Supabase database

-- Create payments table
create table payments (
  id uuid primary key default gen_random_uuid(),
  task_id text not null,
  stripe_session_id text unique not null,
  amount integer not null, -- in cents
  currency text not null default 'usd',
  status text not null default 'pending',
  created_at timestamp with time zone default now(),
  completed_at timestamp with time zone,
  refunded_at timestamp with time zone,
  refund_id text,
  constraint valid_status check (status in ('pending', 'completed', 'refunded', 'failed'))
);

-- Create indexes
create index payments_task_id_idx on payments (task_id);
create index payments_stripe_session_id_idx on payments (stripe_session_id);
create index payments_status_idx on payments (status);