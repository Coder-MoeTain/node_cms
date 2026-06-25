-- Add scheduled status to pages (WordPress parity)
ALTER TABLE pages
  MODIFY COLUMN status ENUM('draft', 'published', 'private', 'scheduled') NOT NULL DEFAULT 'draft';
