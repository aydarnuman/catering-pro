-- Enable pgvector extension for semantic memory
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- Add embedding column to ai_memory for semantic search
ALTER TABLE ai_memory ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Create HNSW index for fast similarity search
CREATE INDEX IF NOT EXISTS idx_ai_memory_embedding ON ai_memory
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Add embedding column to agent_knowledge_base for RAG
ALTER TABLE agent_knowledge_base ADD COLUMN IF NOT EXISTS embedding vector(1536);
ALTER TABLE agent_knowledge_base ADD COLUMN IF NOT EXISTS chunk_text TEXT;

CREATE INDEX IF NOT EXISTS idx_agent_knowledge_embedding ON agent_knowledge_base
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Add embedding column to shared_learnings
ALTER TABLE shared_learnings ADD COLUMN IF NOT EXISTS embedding vector(1536);

CREATE INDEX IF NOT EXISTS idx_shared_learnings_embedding ON shared_learnings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Semantic search function for ai_memory
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
  SELECT m.id, m.memory_type, m.category, m.key, m.value, m.importance, m.usage_count,
    1 - (m.embedding <=> query_embedding) AS similarity
  FROM ai_memory m
  WHERE m.user_id = p_user_id AND m.embedding IS NOT NULL
    AND 1 - (m.embedding <=> query_embedding) > match_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
END; $$;

-- Semantic search function for agent_knowledge_base
CREATE OR REPLACE FUNCTION search_knowledge_semantic(
  query_embedding vector(1536),
  p_agent_id text DEFAULT NULL,
  match_threshold float DEFAULT 0.6,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id int, agent_id text, title text, content_type text,
  chunk_text text, summary text, similarity float
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT k.id, k.agent_id, k.title, k.content_type, k.chunk_text, k.summary,
    1 - (k.embedding <=> query_embedding) AS similarity
  FROM agent_knowledge_base k
  WHERE k.is_active = true AND k.embedding IS NOT NULL
    AND (p_agent_id IS NULL OR k.agent_id = p_agent_id)
    AND 1 - (k.embedding <=> query_embedding) > match_threshold
  ORDER BY k.embedding <=> query_embedding
  LIMIT match_count;
END; $$;
