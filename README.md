# ExamBoss V2 — Real Backend

This version uses Supabase for authentication, PostgreSQL storage, row-level security and realtime exam-session updates.

## Setup

1. Create a Supabase project.
2. Open Supabase SQL Editor.
3. Run `supabase/schema.sql`.
4. In Supabase Authentication, configure email sign-up/confirmation as desired.
5. Copy `.env.example` to `.env`.
6. Put your Supabase Project URL and anon/public key in `.env`.
7. Run:
   npm install
   npm run dev

## Production notes

The browser uses only the Supabase anon key. Do NOT put a service-role key in frontend code.

This MVP supports:
- Teacher/student authentication
- Persistent exams/questions/sessions
- Real-time teacher monitoring of exam sessions
- Student answer persistence
- Automatic objective marking
- Exam codes
- RLS security policies

For a production release, add:
- Server-side grading/validation
- Server-side exam start/end enforcement
- Better role provisioning
- Rate limits
- Audit logs
- Email notifications
- AI through a server-side API/edge function
- Stronger exam integrity controls
- Backup/recovery
- Payment/subscription system
