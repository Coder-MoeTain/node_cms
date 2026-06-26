-- Multiple images per slider (up to 3 photos per carousel group)
ALTER TABLE sliders
  ADD COLUMN IF NOT EXISTS images JSON NULL AFTER image;
