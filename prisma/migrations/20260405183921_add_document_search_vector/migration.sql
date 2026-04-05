-- Add tsvector column for full-text search
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "searchVector" tsvector;

-- Populate existing rows
UPDATE "Document" SET "searchVector" =
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(content, '')), 'B');

-- GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS "Document_searchVector_idx" ON "Document" USING GIN ("searchVector");

-- Trigger to auto-update searchVector on insert/update
CREATE OR REPLACE FUNCTION document_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.content, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS document_search_vector_trigger ON "Document";
CREATE TRIGGER document_search_vector_trigger
  BEFORE INSERT OR UPDATE OF title, content ON "Document"
  FOR EACH ROW
  EXECUTE FUNCTION document_search_vector_update();
