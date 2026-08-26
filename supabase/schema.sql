-- ExamBoss V2 database
create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null check (role in ('teacher','student','admin')),
  created_at timestamptz default now()
);

create table if not exists exams (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  subject text not null,
  duration_minutes integer not null check (duration_minutes between 1 and 600),
  pass_mark integer not null default 50 check (pass_mark between 0 and 100),
  join_code text unique not null,
  status text not null default 'draft' check (status in ('draft','live','closed')),
  created_at timestamptz default now()
);

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references exams(id) on delete cascade,
  position integer not null,
  question_text text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_option text not null check (correct_option in ('A','B','C','D')),
  created_at timestamptz default now()
);

create table if not exists exam_sessions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references exams(id) on delete cascade,
  student_user_id uuid references profiles(id) on delete set null,
  student_name text not null,
  status text not null default 'writing' check (status in ('writing','submitted','expired')),
  answered_count integer not null default 0,
  score integer,
  started_at timestamptz default now(),
  submitted_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists student_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references exam_sessions(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  selected_option text not null check (selected_option in ('A','B','C','D')),
  updated_at timestamptz default now(),
  unique(session_id, question_id)
);

alter table profiles enable row level security;
alter table exams enable row level security;
alter table questions enable row level security;
alter table exam_sessions enable row level security;
alter table student_answers enable row level security;

-- Profiles
create policy "profiles self read" on profiles for select using (auth.uid()=id);
create policy "profiles self insert" on profiles for insert with check (auth.uid()=id);
create policy "profiles self update" on profiles for update using (auth.uid()=id);

-- Teachers manage their own exams/questions
create policy "teacher create exams" on exams for insert with check (auth.uid()=teacher_id);
create policy "teacher read own exams" on exams for select using (auth.uid()=teacher_id or status='live');
create policy "teacher update own exams" on exams for update using (auth.uid()=teacher_id);
create policy "teacher delete own exams" on exams for delete using (auth.uid()=teacher_id);

create policy "teacher manage questions" on questions for all
using (exists(select 1 from exams e where e.id=exam_id and e.teacher_id=auth.uid()))
with check (exists(select 1 from exams e where e.id=exam_id and e.teacher_id=auth.uid()));

-- Students may read questions belonging to live exams
create policy "read live questions" on questions for select
using (exists(select 1 from exams e where e.id=exam_id and e.status='live'));

-- Sessions: allow creation and student-owned updates; teachers can read sessions for their exams
create policy "student create session" on exam_sessions for insert with check (student_user_id is null or student_user_id=auth.uid());
create policy "student read own session" on exam_sessions for select using (student_user_id=auth.uid());
create policy "student update own session" on exam_sessions for update using (student_user_id=auth.uid());
create policy "teacher read exam sessions" on exam_sessions for select
using (exists(select 1 from exams e where e.id=exam_id and e.teacher_id=auth.uid()));

create policy "student manage answers" on student_answers for all
using (exists(select 1 from exam_sessions s where s.id=session_id and s.student_user_id=auth.uid()))
with check (exists(select 1 from exam_sessions s where s.id=session_id and s.student_user_id=auth.uid()));

-- Enable realtime for teacher monitoring
alter publication supabase_realtime add table exam_sessions;
