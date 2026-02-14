-- Fix search_memory_semantic function return type mismatch
-- The original function declared RETURNS TABLE with text types but
-- the underlying ai_memory table has varchar columns, causing
-- "structure of query does not match function result type" error.
-- Solution: cast varchar columns to text explicitly.

CREATE OR REPLACE FUNCTION search_memory_semantic(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  p_user_id text DEFAULT 'default'
)
RETURNS TABLE (
  id int, memory_type text, category text, key text, value text,
  importance int, usage_count int, similarity float
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT m.id, m.memory_type::text, m.category::text, m.key::text, m.value::text, m.importance, m.usage_count,
    (1 - (m.embedding <=> query_embedding))::float AS similarity
  FROM ai_memory m
  WHERE m.user_id = p_user_id AND m.embedding IS NOT NULL
    AND 1 - (m.embedding <=> query_embedding) > match_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
END; $$;
