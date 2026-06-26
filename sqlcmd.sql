-- =========================================
-- 🚀 EXTENSIONS (REQUIRED)
-- =========================================
create extension if not exists "pgcrypto";


-- =========================================
-- 🏢 DEPARTMENTS TABLE
-- Stores all company departments
-- =========================================
create table if not exists departments (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  created_at timestamp default now()
);

-- Insert default departments
insert into departments (name) values
('overall'),
('hr dept'),
('immigration'),
('finance'),
('healthcare'),
('bench sales'),
('software developers')
on conflict (name) do nothing;


-- =========================================
-- 👥 USERS TABLE (EMPLOYEES)
-- Stores employees and their roles
-- =========================================
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  telegram_username text, -- for tagging (@username)
  telegram_id text,       -- Telegram user ID
  department_id uuid references departments(id),
  role text default 'employee', -- admin, manager, employee
  is_active boolean default true,
  created_at timestamp default now()
);


-- =========================================
-- 📋 TASKS TABLE (MAIN CORE)
-- Stores all tasks assigned to users
-- =========================================
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  
  title text,
  description text,

  department_id uuid references departments(id),
  assigned_to uuid references users(id),
  created_by uuid references users(id),

  status text default 'pending', -- pending, in_progress, completed
  priority text default 'medium', -- low, medium, high

  due_date timestamp,
  completed boolean default false,

  chat_id text,      -- Telegram group ID
  message_id text,   -- Telegram message ID

  created_at timestamp default now(),
  updated_at timestamp default now()
);


-- =========================================
-- 🔄 TASK HISTORY TABLE
-- Tracks changes in tasks (audit trail)
-- =========================================
create table if not exists task_history (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade,
  action text, -- created, updated, completed
  old_value jsonb,
  new_value jsonb,
  changed_by uuid references users(id),
  created_at timestamp default now()
);


-- =========================================
-- 🧾 ACTIVITY LOGS TABLE
-- Logs system-level actions
-- =========================================
create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  action text,
  entity text, -- task, user, department
  entity_id uuid,
  metadata jsonb,
  created_at timestamp default now()
);


-- =========================================
-- 🔔 REMINDERS TABLE
-- Stores scheduled reminders
-- =========================================
create table if not exists reminders (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade,
  remind_at timestamp,
  is_sent boolean default false,
  created_at timestamp default now()
);


-- =========================================
-- 📊 ESCALATIONS TABLE
-- Handles escalation if task not completed
-- =========================================
create table if not exists escalations (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade,
  escalated_to uuid references users(id),
  level int default 1,
  reason text,
  created_at timestamp default now()
);


-- =========================================
-- 🔐 ROLES & PERMISSIONS (ADVANCED)
-- Optional for enterprise-level control
-- =========================================
create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  name text unique
);

create table if not exists permissions (
  id uuid primary key default gen_random_uuid(),
  name text unique
);

create table if not exists role_permissions (
  role_id uuid references roles(id) on delete cascade,
  permission_id uuid references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);


-- =========================================
-- ⚡ INDEXES (PERFORMANCE)
-- =========================================
create index if not exists idx_tasks_status on tasks(status);
create index if not exists idx_tasks_assigned on tasks(assigned_to);
create index if not exists idx_tasks_department on tasks(department_id);
create index if not exists idx_tasks_due_date on tasks(due_date);


-- =========================================
-- 🔐 ENABLE ROW LEVEL SECURITY (RLS)
-- =========================================
alter table users enable row level security;
alter table tasks enable row level security;
alter table departments enable row level security;


-- =========================================
-- 🔓 BASIC POLICIES (FOR DEVELOPMENT)
-- ⚠️ In production, restrict properly
-- =========================================
create policy "public access users"
on users for all using (true);

create policy "public access tasks"
on tasks for all using (true);

create policy "public access departments"
on departments for all using (true);


-- =========================================
-- 🔥 ADMIN FUNCTION (RUN SQL FROM NODE)
-- Required for supabaseAdmin.js
-- =========================================
create or replace function exec_sql(sql text)
returns void
language plpgsql
security definer
as $$
begin
  execute sql;
end;
$$;

-- Imp command to run
await runSQL(`
-- Drop if exists (prevents duplicate error)
DROP POLICY IF EXISTS "public access" ON tasks;

-- Recreate safely
CREATE POLICY "public access"
ON tasks
FOR ALL
USING (true);
`);