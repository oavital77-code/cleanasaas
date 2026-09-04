-- get_advisors flagged btree_gist as installed in the public schema
-- (extension_in_public). pgcrypto already lives in `extensions` — move
-- btree_gist there too. Safe post-creation: EXCLUDE constraints on
-- bookings/room_blocks store resolved operator OIDs in pg_constraint, not
-- names, so they don't need to re-resolve via search_path afterwards.
-- Verified after applying to the live project: both no_overlap and
-- block_no_overlap exclusion constraints remain valid.
alter extension btree_gist set schema extensions;
