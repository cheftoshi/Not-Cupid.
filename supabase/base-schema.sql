-- ============================================================================
-- BASE SCHEMA — the CORE love-side tables (users, matches, messages, sessions,
-- otp_codes, match_history). AUTHORITATIVE: this is `pg_dump --schema-only`
-- output from production (PostgreSQL 17.6), captured 2026-06-17.
--
-- These tables were created in the Supabase dashboard and never lived in repo
-- SQL — this file closes that gap. For a from-zero environment, run THIS first,
-- then supabase/apply-all.sql (which ALTERs/indexes these + creates everything
-- else: friend_*, unlocks, push_subscriptions, aux tables, functions).
--
-- Plain pg_dump CREATE statements (no `if not exists`) — meant to run ONCE on a
-- fresh database. The psql \restrict/\unrestrict lines were stripped so it
-- runs in the Supabase SQL editor. Re-capture after schema changes with the
-- pg_dump command in your notes.
-- ============================================================================
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.10 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: match_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.match_history (
    user_a_id uuid NOT NULL,
    user_b_id uuid NOT NULL,
    match_id uuid,
    last_matched_at timestamp with time zone DEFAULT now(),
    outcome text,
    CONSTRAINT match_history_check CHECK ((user_a_id < user_b_id))
);


--
-- Name: matches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.matches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    user_1_id uuid,
    user_2_id uuid,
    compatibility_score integer,
    status text DEFAULT 'pending'::text,
    match_location text,
    match_time timestamp with time zone,
    user_1_accepted boolean DEFAULT false,
    user_2_accepted boolean DEFAULT false,
    expires_at timestamp with time zone DEFAULT (now() + '24:00:00'::interval),
    chat_expires_at timestamp with time zone,
    user_1_date_happened text DEFAULT 'pending'::text,
    user_2_date_happened text DEFAULT 'pending'::text,
    user_1_keep text DEFAULT 'pending'::text,
    user_2_keep text DEFAULT 'pending'::text,
    ended_reason text,
    ended_at timestamp with time zone,
    expiring_reminder_sent_at timestamp with time zone,
    CONSTRAINT matches_ended_reason_check CHECK ((ended_reason = ANY (ARRAY['expired'::text, 'one_passed'::text, 'mutual_pass'::text, 'completed'::text, 'user_deleted'::text, 'user_ended'::text, 'ghosted'::text, 'not_vibing'::text, 'user_requiz'::text, 'reported'::text]))),
    CONSTRAINT matches_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'both_accepted'::text, 'active'::text, 'passed'::text, 'ended'::text, 'expired'::text, 'matched'::text]))),
    CONSTRAINT matches_user_1_date_happened_check CHECK ((user_1_date_happened = ANY (ARRAY['pending'::text, 'yes'::text, 'no'::text]))),
    CONSTRAINT matches_user_1_keep_check CHECK ((user_1_keep = ANY (ARRAY['pending'::text, 'keep'::text, 'pass'::text]))),
    CONSTRAINT matches_user_2_date_happened_check CHECK ((user_2_date_happened = ANY (ARRAY['pending'::text, 'yes'::text, 'no'::text]))),
    CONSTRAINT matches_user_2_keep_check CHECK ((user_2_keep = ANY (ARRAY['pending'::text, 'keep'::text, 'pass'::text])))
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    match_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    read_at timestamp with time zone,
    CONSTRAINT messages_body_check CHECK (((length(body) > 0) AND (length(body) <= 2000)))
);


--
-- Name: otp_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.otp_codes (
    email text NOT NULL,
    code text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    verified boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    token text NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone DEFAULT (now() + '30 days'::interval),
    last_used_at timestamp with time zone DEFAULT now()
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    name text,
    age integer,
    gender text,
    seeking text,
    zip text,
    score_honesty integer DEFAULT 0,
    score_emotionality integer DEFAULT 0,
    score_extraversion integer DEFAULT 0,
    score_agreeableness integer DEFAULT 0,
    score_conscientiousness integer DEFAULT 0,
    score_openness integer DEFAULT 0,
    archetype text,
    status text DEFAULT 'waiting'::text,
    hexaco_unlocked boolean DEFAULT false,
    email text,
    age_min integer DEFAULT 18,
    age_max integer DEFAULT 99,
    auto_rematch boolean DEFAULT true,
    bio text,
    photo_url text,
    height_cm integer,
    occupation text,
    education text,
    music text[] DEFAULT '{}'::text[],
    food text[] DEFAULT '{}'::text[],
    hobbies text[] DEFAULT '{}'::text[],
    prompts jsonb DEFAULT '[]'::jsonb,
    last_seen_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    ghost_reports_received integer DEFAULT 0 NOT NULL,
    matching_cooldown_until timestamp with time zone,
    matching_disabled_at timestamp with time zone,
    pool_active boolean DEFAULT true NOT NULL,
    pool_drop_at timestamp with time zone,
    vibes jsonb,
    friend_waitlist_at timestamp with time zone,
    relationship_style text,
    email_notifications boolean DEFAULT true NOT NULL,
    notifications_paused_at timestamp with time zone,
    gallery text[] DEFAULT '{}'::text[] NOT NULL,
    match_radius integer DEFAULT 15 NOT NULL,
    radius_nudge_sent_at timestamp with time zone,
    balance_hold_at timestamp with time zone,
    last_matched_at timestamp with time zone,
    is_blocked boolean DEFAULT false NOT NULL,
    roster_snapshot text[] DEFAULT '{}'::text[] NOT NULL,
    roster_refreshed_at timestamp with time zone,
    relaunch_blast_sent_at timestamp with time zone,
    quiz_blast_sent_at timestamp with time zone,
    is_test boolean DEFAULT false NOT NULL,
    friend_opted_in_at timestamp with time zone,
    friend_vibes jsonb,
    friend_seeking text[] DEFAULT '{}'::text[] NOT NULL,
    friend_paid_at timestamp with time zone,
    friend_pro_until timestamp with time zone,
    stripe_customer_id text,
    friend_sub_id text,
    friend_blast_sent_at timestamp with time zone,
    friend_age_min integer,
    friend_age_max integer,
    profile_refresh_count integer DEFAULT 0 NOT NULL,
    ghost_strikes integer DEFAULT 0 NOT NULL,
    friend_digest_sent_at timestamp with time zone,
    is_lgbtq boolean,
    attach_anxiety integer,
    attach_avoidance integer,
    attach_style text,
    values_profile jsonb,
    CONSTRAINT users_gender_check CHECK ((gender = ANY (ARRAY['m'::text, 'f'::text]))),
    CONSTRAINT users_relationship_style_check CHECK (((relationship_style IS NULL) OR (relationship_style = ANY (ARRAY['marriage_track'::text, 'dink'::text, 'enm_poly'::text, 'casual'::text, 'open'::text])))),
    CONSTRAINT users_seeking_check CHECK ((seeking = ANY (ARRAY['m'::text, 'f'::text]))),
    CONSTRAINT users_status_check CHECK ((status = ANY (ARRAY['waiting'::text, 'matched'::text, 'expired'::text])))
);


--
-- Name: match_history match_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_history
    ADD CONSTRAINT match_history_pkey PRIMARY KEY (user_a_id, user_b_id);


--
-- Name: matches matches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: otp_codes otp_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.otp_codes
    ADD CONSTRAINT otp_codes_pkey PRIMARY KEY (email);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (token);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: match_history_user_a_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX match_history_user_a_idx ON public.match_history USING btree (user_a_id);


--
-- Name: match_history_user_b_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX match_history_user_b_idx ON public.match_history USING btree (user_b_id);


--
-- Name: matches_expiring_lookup_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX matches_expiring_lookup_idx ON public.matches USING btree (expires_at) WHERE ((status = 'pending'::text) AND (expiring_reminder_sent_at IS NULL));


--
-- Name: matches_pending_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX matches_pending_created_idx ON public.matches USING btree (created_at) WHERE (status = 'pending'::text);


--
-- Name: matches_user1_open_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX matches_user1_open_idx ON public.matches USING btree (user_1_id) WHERE (ended_at IS NULL);


--
-- Name: matches_user2_open_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX matches_user2_open_idx ON public.matches USING btree (user_2_id) WHERE (ended_at IS NULL);


--
-- Name: messages_match_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_match_created_idx ON public.messages USING btree (match_id, created_at);


--
-- Name: messages_match_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_match_idx ON public.messages USING btree (match_id, created_at);


--
-- Name: otp_codes_email_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX otp_codes_email_created_idx ON public.otp_codes USING btree (email, created_at DESC);


--
-- Name: sessions_expires_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_expires_idx ON public.sessions USING btree (expires_at);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_user_id_idx ON public.sessions USING btree (user_id);


--
-- Name: sessions_user_last_used_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_user_last_used_idx ON public.sessions USING btree (user_id, last_used_at DESC);


--
-- Name: users_balance_hold_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_balance_hold_idx ON public.users USING btree (balance_hold_at) WHERE (balance_hold_at IS NOT NULL);


--
-- Name: users_friend_blast_unsent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_friend_blast_unsent_idx ON public.users USING btree (id) WHERE (friend_blast_sent_at IS NULL);


--
-- Name: users_friend_pool_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_friend_pool_idx ON public.users USING btree (friend_opted_in_at) WHERE (friend_opted_in_at IS NOT NULL);


--
-- Name: users_friend_waitlist_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_friend_waitlist_idx ON public.users USING btree (friend_waitlist_at) WHERE (friend_waitlist_at IS NOT NULL);


--
-- Name: users_gender_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_gender_idx ON public.users USING btree (gender);


--
-- Name: users_is_test_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_is_test_idx ON public.users USING btree (is_test) WHERE (is_test = true);


--
-- Name: users_pool_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_pool_active_idx ON public.users USING btree (pool_active, status);


--
-- Name: users_pool_drop_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_pool_drop_at_idx ON public.users USING btree (pool_drop_at);


--
-- Name: users_quiz_blast_unsent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_quiz_blast_unsent_idx ON public.users USING btree (id) WHERE (quiz_blast_sent_at IS NULL);


--
-- Name: users_relationship_style_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_relationship_style_idx ON public.users USING btree (relationship_style);


--
-- Name: users_relaunch_blast_unsent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_relaunch_blast_unsent_idx ON public.users USING btree (id) WHERE (relaunch_blast_sent_at IS NULL);


--
-- Name: users_seeking_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_seeking_idx ON public.users USING btree (seeking);


--
-- Name: users_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_status_idx ON public.users USING btree (status);


--
-- Name: users_vibes_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_vibes_idx ON public.users USING gin (vibes);


--
-- Name: users_zip_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_zip_idx ON public.users USING btree (zip);


--
-- Name: match_history match_history_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_history
    ADD CONSTRAINT match_history_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE SET NULL;


--
-- Name: match_history match_history_user_a_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_history
    ADD CONSTRAINT match_history_user_a_id_fkey FOREIGN KEY (user_a_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: match_history match_history_user_b_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_history
    ADD CONSTRAINT match_history_user_b_id_fkey FOREIGN KEY (user_b_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: matches matches_user_1_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_user_1_id_fkey FOREIGN KEY (user_1_id) REFERENCES public.users(id);


--
-- Name: matches matches_user_2_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_user_2_id_fkey FOREIGN KEY (user_2_id) REFERENCES public.users(id);


--
-- Name: messages messages_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE;


--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: otp_codes allow all on otp_codes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow all on otp_codes" ON public.otp_codes USING (true) WITH CHECK (true);


--
-- Name: match_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.match_history ENABLE ROW LEVEL SECURITY;

--
-- Name: matches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: otp_codes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--
