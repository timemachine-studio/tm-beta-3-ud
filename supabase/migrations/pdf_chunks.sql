-- =============================================
-- PDF RAG: Chunked document storage + full-text search
-- Run these SQL statements in the Supabase SQL editor
-- =============================================

-- Table: stores individual text chunks from uploaded PDFs
CREATE TABLE IF NOT EXISTS pdf_chunks (
  id            bigserial PRIMARY KEY,
  document_id   text        NOT NULL,   -- unique ID per uploaded PDF
  user_id       text,                   -- optional, for scoping/cleanup
  chunk_index   int         NOT NULL,   -- ordering within the document
  content       text        NOT NULL,   -- the chunk text
  page_count    int,                    -- total pages in the source PDF
  file_name     text,                   -- original file name
  content_tsv   tsvector    GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_pdf_chunks_document_id ON pdf_chunks (document_id);
CREATE INDEX IF NOT EXISTS idx_pdf_chunks_user_id     ON pdf_chunks (user_id);
CREATE INDEX IF NOT EXISTS idx_pdf_chunks_tsv         ON pdf_chunks USING gin (content_tsv);

-- RPC: search chunks within a specific document by relevance to a query
CREATE OR REPLACE FUNCTION search_pdf_chunks(
  p_document_id text,
  p_query       text,
  p_limit       int DEFAULT 8
)
RETURNS TABLE (
  chunk_id    bigint,
  chunk_index int,
  content     text,
  relevance   real
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    pc.id          AS chunk_id,
    pc.chunk_index,
    pc.content,
    ts_rank_cd(pc.content_tsv, websearch_to_tsquery('english', p_query)) AS relevance
  FROM pdf_chunks pc
  WHERE pc.document_id = p_document_id
    AND pc.content_tsv @@ websearch_to_tsquery('english', p_query)
  ORDER BY relevance DESC
  LIMIT p_limit;
$$;

-- Cleanup: delete chunks older than 7 days (optional, run periodically)
-- DELETE FROM pdf_chunks WHERE created_at < now() - interval '7 days';
