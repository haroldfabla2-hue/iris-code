-- IRIS v2.0 Context Memory Database Schema
-- Phase 1: Context Memory Infrastructure
-- Created: 2025-11-10

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create iris_projects table
CREATE TABLE iris_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id UUID NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    context_config JSONB DEFAULT '{}',
    agent_config JSONB DEFAULT '{}',
    memory_retention_days INTEGER DEFAULT 365,
    compression_enabled BOOLEAN DEFAULT true,
    transcendence_level VARCHAR(50) DEFAULT 'basic'
);

-- Create iris_context_events table
CREATE TABLE iris_context_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES iris_projects(id) ON DELETE CASCADE,
    session_id VARCHAR(255) NOT NULL,
    actor_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('conversational', 'blob', 'action', 'system', 'insight')),
    event_data JSONB NOT NULL,
    content TEXT NOT NULL,
    semantic_vector VECTOR(1536), -- OpenAI ada-002 embedding dimension
    context_score FLOAT DEFAULT 0.0,
    importance_score FLOAT DEFAULT 0.5,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '30 days'),
    metadata JSONB DEFAULT '{}'
);

-- Create iris_context_insights table
CREATE TABLE iris_context_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES iris_projects(id) ON DELETE CASCADE,
    insight_type VARCHAR(50) NOT NULL CHECK (insight_type IN ('semantic', 'summary', 'preference', 'project', 'collaborative', 'decision', 'pattern')),
    content JSONB NOT NULL,
    summary TEXT,
    confidence_score FLOAT NOT NULL CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
    related_event_ids UUID[],
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '365 days'),
    metadata JSONB DEFAULT '{}'
);

-- Create iris_context_memory_strategies table
CREATE TABLE iris_context_memory_strategies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES iris_projects(id) ON DELETE CASCADE,
    strategy_type VARCHAR(50) NOT NULL CHECK (strategy_type IN ('semantic', 'summary', 'preference', 'project')),
    configuration JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_execution TIMESTAMP,
    execution_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create iris_conversation_threads table
CREATE TABLE iris_conversation_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES iris_projects(id) ON DELETE CASCADE,
    thread_id VARCHAR(255) NOT NULL,
    title VARCHAR(500),
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'paused', 'completed', 'archived'
    participants TEXT[] DEFAULT '{}',
    total_messages INTEGER DEFAULT 0,
    last_activity TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    context_summary TEXT,
    tags TEXT[] DEFAULT '{}'
);

-- Create iris_knowledge_nodes table (for knowledge graph)
CREATE TABLE iris_knowledge_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES iris_projects(id) ON DELETE CASCADE,
    node_type VARCHAR(50) NOT NULL CHECK (node_type IN ('concept', 'entity', 'relationship', 'event', 'decision', 'insight')),
    properties JSONB NOT NULL,
    name VARCHAR(500) NOT NULL,
    description TEXT,
    embedding VECTOR(1536),
    importance_score FLOAT DEFAULT 0.5,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '365 days')
);

-- Create iris_knowledge_edges table (for knowledge graph)
CREATE TABLE iris_knowledge_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_node_id UUID NOT NULL REFERENCES iris_knowledge_nodes(id) ON DELETE CASCADE,
    to_node_id UUID NOT NULL REFERENCES iris_knowledge_nodes(id) ON DELETE CASCADE,
    relationship_type VARCHAR(100) NOT NULL,
    properties JSONB DEFAULT '{}',
    weight FLOAT DEFAULT 1.0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT no_self_loop CHECK (from_node_id != to_node_id)
);

-- Create iris_user_preferences table
CREATE TABLE iris_user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES iris_projects(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    preferences JSONB NOT NULL,
    interaction_style JSONB DEFAULT '{}',
    communication_pattern JSONB DEFAULT '{}',
    learning_pattern JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);

-- Create indexes for performance
-- Context events indexes
CREATE INDEX idx_context_events_project_session ON iris_context_events (project_id, session_id, created_at);
CREATE INDEX idx_context_events_type_time ON iris_context_events (event_type, created_at DESC);
CREATE INDEX idx_context_events_expires ON iris_context_events (expires_at);
CREATE INDEX idx_context_events_actor ON iris_context_events (actor_id, created_at);

-- Vector search index for context events
CREATE INDEX idx_context_events_vector ON iris_context_events USING ivfflat (semantic_vector vector_cosine_ops) WITH (lists = 100);

-- Context insights indexes
CREATE INDEX idx_context_insights_project_type ON iris_context_insights (project_id, insight_type, created_at DESC);
CREATE INDEX idx_context_insights_expires ON iris_context_insights (expires_at);
CREATE INDEX idx_context_insights_confidence ON iris_context_insights (confidence_score DESC);

-- Memory strategies indexes
CREATE INDEX idx_memory_strategies_project_type ON iris_context_memory_strategies (project_id, strategy_type, is_active);

-- Conversation threads indexes
CREATE INDEX idx_conversation_threads_project ON iris_conversation_threads (project_id, last_activity DESC);
CREATE INDEX idx_conversation_threads_status ON iris_conversation_threads (status, updated_at);

-- Knowledge graph indexes
CREATE INDEX idx_knowledge_nodes_project_type ON iris_knowledge_nodes (project_id, node_type, importance_score DESC);
CREATE INDEX idx_knowledge_edges_relationship ON iris_knowledge_edges (relationship_type, weight DESC);
CREATE INDEX idx_knowledge_nodes_vector ON iris_knowledge_nodes USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

-- User preferences indexes
CREATE INDEX idx_user_preferences_project_user ON iris_user_preferences (project_id, user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_iris_projects_updated_at BEFORE UPDATE ON iris_projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_iris_context_events_updated_at BEFORE UPDATE ON iris_context_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_iris_context_insights_updated_at BEFORE UPDATE ON iris_context_insights FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_iris_context_memory_strategies_updated_at BEFORE UPDATE ON iris_context_memory_strategies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_iris_conversation_threads_updated_at BEFORE UPDATE ON iris_conversation_threads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_iris_knowledge_nodes_updated_at BEFORE UPDATE ON iris_knowledge_nodes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_iris_knowledge_edges_updated_at BEFORE UPDATE ON iris_knowledge_edges FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_iris_user_preferences_updated_at BEFORE UPDATE ON iris_user_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to automatically create project threads
CREATE OR REPLACE FUNCTION create_default_project_thread()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO iris_conversation_threads (project_id, thread_id, title, participants)
    VALUES (NEW.id, 'main-thread', 'Main Project Thread', ARRAY[NEW.owner_id]);
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to create default thread for new projects
CREATE TRIGGER create_default_project_thread_trigger AFTER INSERT ON iris_projects FOR EACH ROW EXECUTE FUNCTION create_default_project_thread();

-- Create function for context relevance scoring
CREATE OR REPLACE FUNCTION calculate_context_relevance(
    input_text TEXT,
    existing_vectors VECTOR[],
    weights FLOAT[] DEFAULT ARRAY[0.4, 0.35, 0.25]
)
RETURNS FLOAT AS $$
DECLARE
    max_similarity FLOAT := 0.0;
    avg_similarity FLOAT := 0.0;
    recency_bonus FLOAT := 0.0;
    result_score FLOAT;
BEGIN
    -- Calculate average similarity with existing vectors
    SELECT AVG((input_vector <=> embedding)) INTO avg_similarity
    FROM unnest(existing_vectors) AS input_vector;
    
    -- Get maximum similarity for diversity
    SELECT MIN((input_vector <=> embedding)) INTO max_similarity
    FROM unnest(existing_vectors) AS input_vector;
    
    -- Apply recency bonus (recent events get higher scores)
    recency_bonus := 0.1;
    
    -- Combine factors
    result_score := (
        (1.0 - avg_similarity) * weights[1] + -- semantic similarity
        (1.0 - max_similarity) * weights[2] + -- diversity
        recency_bonus * weights[3]            -- recency
    );
    
    RETURN LEAST(GREATEST(result_score, 0.0), 1.0);
END;
$$ LANGUAGE plpgsql;

-- Create view for active context with insights
CREATE VIEW iris_active_context AS
SELECT 
    e.id,
    e.project_id,
    e.session_id,
    e.event_type,
    e.content,
    e.context_score,
    e.importance_score,
    e.created_at,
    e.metadata,
    (SELECT ARRAY_AGG(i.summary) 
     FROM iris_context_insights i 
     WHERE i.project_id = e.project_id 
     AND i.expires_at > NOW() 
     AND e.id = ANY(i.related_event_ids)) as related_insights
FROM iris_context_events e
WHERE e.expires_at > NOW()
ORDER BY e.importance_score DESC, e.created_at DESC;

-- Create function for batch context cleanup
CREATE OR REPLACE FUNCTION cleanup_expired_context()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete expired context events
    DELETE FROM iris_context_events WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Delete expired insights
    DELETE FROM iris_context_insights WHERE expires_at < NOW();
    
    -- Log cleanup
    INSERT INTO iris_knowledge_nodes (project_id, node_type, properties, name, description)
    SELECT '00000000-0000-0000-0000-000000000000', 'system', 
           jsonb_build_object('action', 'cleanup', 'deleted_events', deleted_count),
           'System Cleanup', 
           'Automatic cleanup of expired context data'
    WHERE deleted_count > 0;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;