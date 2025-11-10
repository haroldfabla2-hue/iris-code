#!/bin/bash
set -e

echo "Inicializando IRIS v2.0 Context Memory Database..."

# Create database extensions
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Enable necessary extensions
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS vector;
    CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
    
    -- Set optimal PostgreSQL settings for vector operations
    ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
    ALTER SYSTEM SET max_connections = 200;
    ALTER SYSTEM SET shared_buffers = '1GB';
    ALTER SYSTEM SET effective_cache_size = '3GB';
    ALTER SYSTEM SET maintenance_work_mem = '256MB';
    ALTER SYSTEM SET checkpoint_completion_target = 0.9;
    ALTER SYSTEM SET wal_buffers = '16MB';
    ALTER SYSTEM SET default_statistics_target = 100;
    ALTER SYSTEM SET random_page_cost = 1.1;
    ALTER SYSTEM SET effective_io_concurrency = 200;
    
    -- Reload configuration
    SELECT pg_reload_conf();
    
    -- Create sample project for testing
    INSERT INTO iris_projects (id, name, description, owner_id, context_config, agent_config)
    VALUES (
        '00000000-0000-0000-0000-000000000001',
        'IRIS v2.0 Demo Project',
        'Sample project for context memory infrastructure testing',
        'demo-user',
        '{
            "memory_retention_days": 365,
            "compression_enabled": true,
            "transcendence_level": "enhanced",
            "context_strategies": {
                "semantic": {"enabled": true, "weight": 0.4},
                "summary": {"enabled": true, "weight": 0.3},
                "preference": {"enabled": true, "weight": 0.2},
                "project": {"enabled": true, "weight": 0.1}
            }
        }',
        '{
            "agents": {
                "context_agent": {"enabled": true, "priority": "high"},
                "memory_agent": {"enabled": true, "priority": "medium"},
                "analysis_agent": {"enabled": true, "priority": "low"}
            }
        }'
    ) ON CONFLICT (id) DO NOTHING;
    
    -- Create memory strategies for the demo project
    INSERT INTO iris_context_memory_strategies (project_id, strategy_type, configuration, is_active)
    VALUES 
        ('00000000-0000-0000-0000-000000000001', 'semantic', 
         '{"threshold": 0.75, "max_results": 10, "weight": 0.4}', true),
        ('00000000-0000-0000-0000-000000000001', 'summary', 
         '{"interval": "1h", "max_length": 500, "weight": 0.3}', true),
        ('00000000-0000-0000-0000-000000000001', 'preference', 
         '{"learning_rate": 0.1, "adaptation_period": "7d", "weight": 0.2}', true),
        ('00000000-0000-0000-0000-000000000001', 'project', 
         '{"isolation_level": "strict", "cross_project_sharing": false, "weight": 0.1}', true)
    ON CONFLICT DO NOTHING;
    
    -- Insert sample context events for testing
    INSERT INTO iris_context_events (project_id, session_id, actor_id, event_type, event_data, content, context_score, importance_score)
    VALUES 
        ('00000000-0000-0000-0000-000000000001', 'demo-session-001', 'demo-user', 'conversational', 
         '{"intent": "planning", "entities": ["context_memory", "infrastructure"]}',
         'We need to implement context transcendence for the IRIS project. This will enable cross-session continuity and improve collaborative efficiency.',
         0.85, 0.9),
        ('00000000-0000-0000-0000-000000000001', 'demo-session-001', 'ai-assistant', 'system',
         '{"action": "acknowledgment", "suggestions": ["setup_vector_db", "implement_pipeline"]}',
         'I understand the importance of context transcendence. Based on our analysis, implementing vector search and context engineering will be key components.',
         0.75, 0.7),
        ('00000000-0000-0000-0000-000000000001', 'demo-session-001', 'demo-user', 'decision',
         '{"decision_type": "technical", "impact": "high", "stakeholders": ["dev-team", "product"]}',
         'We will proceed with Phase 1 implementation starting with PostgreSQL + pgvector setup and Kafka for event streaming.',
         0.90, 0.95)
    ON CONFLICT DO NOTHING;
    
    -- Create sample insights
    INSERT INTO iris_context_insights (project_id, insight_type, content, summary, confidence_score, related_event_ids, tags)
    VALUES 
        ('00000000-0000-0000-0000-000000000001', 'collaborative',
         '{"pattern": "decision_making", "efficiency": 0.85, "consensus_rate": 0.9}',
         'User demonstrates efficient collaborative decision-making with high consensus building',
         0.88,
         ARRAY['00000000-0000-0000-0000-000000000001'],
         ARRAY['collaboration', 'decision_making', 'efficiency']),
        ('00000000-0000-0000-0000-000000000001', 'project',
         '{"phase": "infrastructure_setup", "priority": "high", "complexity": "medium"}',
         'Current project phase: Infrastructure setup with high priority',
         0.92,
         ARRAY['00000000-0000-0000-0000-000000000001'],
         ARRAY['infrastructure', 'setup', 'priority'])
    ON CONFLICT DO NOTHING;
    
    -- Create knowledge graph nodes
    INSERT INTO iris_knowledge_nodes (project_id, node_type, properties, name, description, importance_score)
    VALUES 
        ('00000000-0000-0000-0000-000000000001', 'concept',
         '{"category": "technical", "relevance": "high", "status": "active"}',
         'Context Transcendence',
         'The ability to maintain and restore conversational context across sessions, enabling long-term collaborative intelligence',
         0.95),
        ('00000000-0000-0000-0000-000000000001', 'technology',
         '{"type": "database", "version": "pg15", "extension": "pgvector"}',
         'PostgreSQL with pgvector',
         'Vector database extension for semantic search and similarity matching',
         0.85),
        ('00000000-0000-0000-0000-000000000001', 'process',
         '{"phase": 1, "duration": "3 weeks", "status": "planned"}',
         'Phase 1 Implementation',
         'Context Memory Infrastructure setup including vector database and processing pipeline',
         0.90)
    ON CONFLICT DO NOTHING;
    
    -- Create knowledge graph edges
    INSERT INTO iris_knowledge_edges (from_node_id, to_node_id, relationship_type, properties, weight)
    SELECT 
        n1.id, n2.id, 'enables', '{"confidence": 0.9}', 0.9
    FROM iris_knowledge_nodes n1, iris_knowledge_nodes n2
    WHERE n1.name = 'Context Transcendence' 
    AND n2.name = 'PostgreSQL with pgvector'
    ON CONFLICT DO NOTHING;
    
    -- Create sample user preferences
    INSERT INTO iris_user_preferences (project_id, user_id, preferences, interaction_style, communication_pattern)
    VALUES (
        '00000000-0000-0000-0000-000000000001',
        'demo-user',
        '{
            "context_retention": "long_term",
            "detail_level": "high",
            "response_style": "comprehensive",
            "collaboration_preference": "structured"
        }',
        '{
            "decision_making": "collaborative",
            "information_processing": "detailed",
            "problem_solving": "systematic",
            "communication": "direct"
        }',
        '{
            "prefers_summaries": true,
            "detail_tolerance": "high",
            "complexity_preference": "moderate",
            "feedback_style": "constructive"
        }'
    ) ON CONFLICT (project_id, user_id) DO NOTHING;
    
    -- Create initial conversation thread
    INSERT INTO iris_conversation_threads (project_id, thread_id, title, participants, total_messages, context_summary, tags)
    VALUES (
        '00000000-0000-0000-0000-000000000001',
        'main-thread',
        'IRIS v2.0 Context Memory Implementation',
        ARRAY['demo-user', 'ai-assistant'],
        3,
        'Initial discussion about implementing context transcendence for IRIS project. Key decisions made about Phase 1 technical approach.',
        ARRAY['implementation', 'context_transcendence', 'infrastructure']
    ) ON CONFLICT DO NOTHING;
    
    -- Set optimal configuration for pgvector
    ALTER SYSTEM SET max_parallel_workers_per_gather = 4;
    ALTER SYSTEM SET max_parallel_workers = 8;
    ALTER SYSTEM SET max_parallel_maintenance_workers = 4;
    
    -- Create monitoring view
    CREATE OR REPLACE VIEW iris_context_monitoring AS
    SELECT 
        p.id as project_id,
        p.name as project_name,
        COUNT(e.id) as total_events,
        COUNT(CASE WHEN e.created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as events_last_24h,
        COUNT(i.id) as total_insights,
        COUNT(CASE WHEN i.created_at > NOW() - INTERVAL '7 days' THEN 1 END) as insights_last_7d,
        COUNT(DISTINCT e.session_id) as active_sessions,
        COUNT(DISTINCT e.actor_id) as active_actors,
        AVG(e.context_score) as avg_context_score,
        AVG(e.importance_score) as avg_importance_score
    FROM iris_projects p
    LEFT JOIN iris_context_events e ON p.id = e.project_id AND e.expires_at > NOW()
    LEFT JOIN iris_context_insights i ON p.id = i.project_id AND i.expires_at > NOW()
    WHERE p.status = 'active'
    GROUP BY p.id, p.name
    ORDER BY p.created_at DESC;
    
    -- Grant necessary permissions
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO iris_user;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO iris_user;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO iris_user;
    
    -- Create indexes for better performance
    CLUSTER iris_context_events USING idx_context_events_project_session;
    CLUSTER iris_context_insights USING idx_context_insights_project_type;
    CLUSTER iris_knowledge_nodes USING idx_knowledge_nodes_project_type;
    
    -- Analyze tables for better query planning
    ANALYZE iris_context_events;
    ANALYZE iris_context_insights;
    ANALYZE iris_knowledge_nodes;
    ANALYZE iris_knowledge_edges;
    ANALYZE iris_context_memory_strategies;
    ANALYZE iris_conversation_threads;
    ANALYZE iris_user_preferences;
    
    -- Log successful initialization
    INSERT INTO iris_knowledge_nodes (project_id, node_type, properties, name, description)
    VALUES (
        '00000000-0000-0000-0000-000000000001',
        'system',
        '{"status": "initialized", "timestamp": "' || NOW() || '"}',
        'Database Initialization',
        'IRIS v2.0 Context Memory Database successfully initialized with sample data'
    );
    
EOSQL

echo "Database initialization completed successfully!"

# Create a health check function
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Test vector extension
    SELECT extname FROM pg_extension WHERE extname = 'vector';
    
    -- Test basic functionality
    SELECT COUNT(*) as total_projects FROM iris_projects;
    SELECT COUNT(*) as total_events FROM iris_context_events;
    SELECT COUNT(*) as total_insights FROM iris_context_insights;
    
EOSQL

echo "Database health check passed!"