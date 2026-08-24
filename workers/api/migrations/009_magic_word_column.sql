-- Optional per-video magic word for comment verification
ALTER TABLE videos ADD COLUMN magic_word TEXT;
