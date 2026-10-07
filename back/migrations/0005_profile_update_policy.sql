-- Preserve the existing ability for users to update their own profile.
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);
