
-- Add username column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text UNIQUE;

-- Populate existing profiles with username from their email (prefix before @)
UPDATE public.profiles p
SET username = LOWER(SPLIT_PART(au.email, '@', 1))
FROM auth.users au
WHERE au.id = p.user_id AND p.username IS NULL;

-- Create function to resolve username to email (SECURITY DEFINER to access auth.users)
CREATE OR REPLACE FUNCTION public.get_email_by_username(_username text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT au.email
  FROM public.profiles p
  JOIN auth.users au ON au.id = p.user_id
  WHERE p.username = _username
  LIMIT 1;
$$;

-- Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION public.get_email_by_username(text) TO anon, authenticated;
