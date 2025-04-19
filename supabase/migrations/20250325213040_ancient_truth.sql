/*
  # Initial Schema Setup for Linkhood

  1. New Tables
    - users: User profiles and authentication
    - markers: Points of interest on the map
    - posts: Community forum posts
    - messages: Private messages between users
    - reports: Neighborhood issue reports
    - events: Community events and announcements

  2. Security
    - RLS enabled on all tables
    - Policies for data access control
    - Soft delete support via deleted_at
*/

-- Users table
CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text,
  address text,
  role text DEFAULT 'user' CHECK (role IN ('super_admin', 'admin', 'user')),
  fcm_token text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- Markers table
CREATE TABLE public.markers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  title text NOT NULL,
  description text,
  category text NOT NULL,
  admin_id uuid REFERENCES public.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- Posts table
CREATE TABLE public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  user_id uuid REFERENCES public.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- Messages table
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid REFERENCES public.users(id),
  receiver_id uuid REFERENCES public.users(id),
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- Reports table
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  category text NOT NULL,
  photo_url text,
  status text DEFAULT 'signalé' CHECK (status IN ('signalé', 'en cours', 'résolu')),
  priority text DEFAULT 'LOW' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH')),
  visible boolean DEFAULT true,
  user_id uuid REFERENCES public.users(id),
  resolved_by uuid REFERENCES public.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- Events table
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  date date NOT NULL,
  location text,
  user_id uuid REFERENCES public.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.markers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users policies
CREATE POLICY "Users can read their own data"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR role IN ('admin', 'super_admin'));

-- Markers policies
CREATE POLICY "Anyone can read non-deleted markers"
  ON public.markers
  FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "Admins can create markers"
  ON public.markers
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'super_admin')
  ));

-- Posts policies
CREATE POLICY "Anyone can read non-deleted posts"
  ON public.posts
  FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "Active users can create posts"
  ON public.posts
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.status = 'active'
  ));

-- Messages policies
CREATE POLICY "Users can read their own messages"
  ON public.messages
  FOR SELECT
  TO authenticated
  USING (
    (sender_id = auth.uid() OR receiver_id = auth.uid())
    AND deleted_at IS NULL
  );

CREATE POLICY "Active users can send messages"
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.status = 'active'
  ));

-- Reports policies
CREATE POLICY "Users can read visible non-deleted reports"
  ON public.reports
  FOR SELECT
  TO authenticated
  USING (
    (visible = true OR EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    ))
    AND deleted_at IS NULL
  );

CREATE POLICY "Active users can create reports"
  ON public.reports
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.status = 'active'
  ));

-- Events policies
CREATE POLICY "Anyone can read non-deleted events"
  ON public.events
  FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "Active users can create events"
  ON public.events
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.status = 'active'
  ));