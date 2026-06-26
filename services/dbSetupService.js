// dbSetupService.js
const { runSQL } = require("../config/supabaseAdmin");

async function setupDatabase() {
  console.log("🚀 Setting up database...");

  // ✅ Create table (safe)
  await runSQL(`
    create table if not exists tasks (
      id uuid primary key default gen_random_uuid(),
      department text,
      person text,
      task text,
      assigned_telegram_id text,
      created_by_telegram_id text,
      completed boolean default false,
      chat_id text,
      message_id text,
      reminder_frequency text,
      reminder_interval_days integer,
      next_reminder_at timestamptz,
      last_reminded_at timestamptz,
      created_at timestamp default now()
    );
  `);

  await runSQL(`
    alter table tasks
    add column if not exists assigned_telegram_id text,
    add column if not exists created_by_telegram_id text,
    add column if not exists reminder_frequency text,
    add column if not exists reminder_interval_days integer,
    add column if not exists next_reminder_at timestamptz,
    add column if not exists last_reminded_at timestamptz;
  `);

  // ✅ Enable RLS (safe)
  await runSQL(`
    alter table tasks enable row level security;
  `);

  // ✅ FIXED POLICY (no duplicate error)
  await runSQL(`
    DROP POLICY IF EXISTS "public access" ON tasks;

    CREATE POLICY "public access"
    ON tasks
    FOR ALL
    USING (true);
  `);

  // ✅ Index (safe)
  await runSQL(`
    create index if not exists idx_tasks_completed
    on tasks(completed);
  `);

  await runSQL(`
    create index if not exists idx_tasks_assigned_telegram_id
    on tasks(assigned_telegram_id);
  `);

  await runSQL(`
    create index if not exists idx_tasks_next_reminder_at
    on tasks(next_reminder_at)
    where completed = false;
  `);

  console.log("✅ Database Ready");
}

module.exports = { setupDatabase };
