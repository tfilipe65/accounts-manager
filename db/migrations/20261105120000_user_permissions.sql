-- Section permissions. NULL = the user sees every section (the default, and what existing users keep);
-- otherwise the list of section keys (lib/sections.ts) they may open. Admins always see everything.
ALTER TABLE users ADD COLUMN permissions TEXT[];
