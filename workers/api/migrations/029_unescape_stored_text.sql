-- Repair text that was HTML-escaped on write.
--
-- `lib/sanitize.ts` used to escape `& < > " '` before storing user text. React
-- escapes again when rendering, so stored values showed up literally ("R&amp;D",
-- "You completed &#039;Mission&#039;"). The writer now stores raw text (see
-- migration note in lib/sanitize.ts); this migration decodes rows written by the
-- old code so existing data renders correctly.
--
-- Safe to run once: rows written after the fix contain no entities, so the
-- UPDATEs are no-ops for them.

UPDATE notifications
SET title = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(title,
      '&amp;', '&'), '&lt;', '<'), '&gt;', '>'), '&quot;', '"'), '&#039;', '''')
WHERE title LIKE '%&amp;%' OR title LIKE '%&lt;%' OR title LIKE '%&gt;%'
   OR title LIKE '%&quot;%' OR title LIKE '%&#039;%';

UPDATE notifications
SET message = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(message,
      '&amp;', '&'), '&lt;', '<'), '&gt;', '>'), '&quot;', '"'), '&#039;', '''')
WHERE message LIKE '%&amp;%' OR message LIKE '%&lt;%' OR message LIKE '%&gt;%'
   OR message LIKE '%&quot;%' OR message LIKE '%&#039;%';

UPDATE users
SET display_name = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(display_name,
      '&amp;', '&'), '&lt;', '<'), '&gt;', '>'), '&quot;', '"'), '&#039;', '''')
WHERE display_name LIKE '%&amp;%' OR display_name LIKE '%&lt;%' OR display_name LIKE '%&gt;%'
   OR display_name LIKE '%&quot;%' OR display_name LIKE '%&#039;%';

UPDATE communities
SET name = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(name,
      '&amp;', '&'), '&lt;', '<'), '&gt;', '>'), '&quot;', '"'), '&#039;', '''')
WHERE name LIKE '%&amp;%' OR name LIKE '%&lt;%' OR name LIKE '%&gt;%'
   OR name LIKE '%&quot;%' OR name LIKE '%&#039;%';

UPDATE communities
SET description = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(description,
      '&amp;', '&'), '&lt;', '<'), '&gt;', '>'), '&quot;', '"'), '&#039;', '''')
WHERE description LIKE '%&amp;%' OR description LIKE '%&lt;%' OR description LIKE '%&gt;%'
   OR description LIKE '%&quot;%' OR description LIKE '%&#039;%';

UPDATE creator_profiles
SET bio = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(bio,
      '&amp;', '&'), '&lt;', '<'), '&gt;', '>'), '&quot;', '"'), '&#039;', '''')
WHERE bio LIKE '%&amp;%' OR bio LIKE '%&lt;%' OR bio LIKE '%&gt;%'
   OR bio LIKE '%&quot;%' OR bio LIKE '%&#039;%';
