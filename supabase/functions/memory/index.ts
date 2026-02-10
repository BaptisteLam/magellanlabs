import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProjectMemory {
  sessionId: string;
  architecture: {
    framework: string;
    patterns: string[];
    conventions: Record<string, string>;
  };
  recentChanges: Array<{
    timestamp: string;
    description: string;
    filesAffected: string[];
    lessons: string[];
  }>;
  knownIssues: Array<{
    issue: string;
    solution: string;
    frequency: number;
  }>;
  userPreferences: {
    codingStyle: string;
    preferredLibraries: string[];
    avoidances: string[];
  };
}

interface CodeChange {
  path: string;
  type: 'create' | 'modify' | 'delete';
  description: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Vérifier l'authentification de l'utilisateur
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, sessionId, prompt, changes, errors } = await req.json();

    switch (action) {
      case 'load':
        return await loadMemory(supabase, sessionId);
      
      case 'build_context':
        return await buildContextWithMemory(supabase, sessionId, prompt);
      
      case 'update':
        return await updateMemory(supabase, sessionId, changes, errors);
      
      case 'init':
        return await initializeMemory(supabase, sessionId);
      
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

  } catch (error) {
    console.error('Memory function error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function loadMemory(supabase: any, sessionId: string) {
  const { data, error } = await supabase
    .from('project_memory')
    .select('*')
    .eq('session_id', sessionId)
    .maybeSingle();

  if (error) {
    console.error('Load memory error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (!data) {
    // Initialize new memory
    return await initializeMemory(supabase, sessionId);
  }

  return new Response(JSON.stringify({ memory: data }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function initializeMemory(supabase: any, sessionId: string) {
  const initialMemory = {
    session_id: sessionId,
    architecture: {
      framework: 'react',
      patterns: ['component-based', 'hooks'],
      conventions: {
        naming: 'camelCase for functions, PascalCase for components',
        imports: 'absolute imports with @ alias',
        styling: 'tailwind utility classes'
      }
    },
    recent_changes: [],
    known_issues: [],
    user_preferences: {
      codingStyle: 'modern',
      preferredLibraries: ['react', 'tailwindcss', 'typescript'],
      avoidances: []
    }
  };

  const { data, error } = await supabase
    .from('project_memory')
    .insert(initialMemory)
    .select()
    .single();

  if (error) {
    console.error('Initialize memory error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ memory: data }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function buildContextWithMemory(supabase: any, sessionId: string, prompt: string) {
  const memoryResponse = await loadMemory(supabase, sessionId);
  const memoryData = await memoryResponse.json();
  
  if (memoryData.error) {
    return memoryResponse;
  }

  const memory = memoryData.memory;
  
  const context = `
# PROJECT ARCHITECTURE
Framework: ${memory.architecture.framework}
Patterns: ${memory.architecture.patterns.join(', ')}
Conventions:
${Object.entries(memory.architecture.conventions)
  .map(([key, value]) => `  - ${key}: ${value}`)
  .join('\n')}

# RECENT CHANGES (Last 10)
${memory.recent_changes.slice(-10).map((c: any) => 
  `- ${c.description} (${c.filesAffected.join(', ')})\n  Lessons: ${c.lessons.join(', ')}`
).join('\n') || 'No recent changes'}

# LESSONS LEARNED
${memory.recent_changes
  .flatMap((c: any) => c.lessons)
  .slice(-5)
  .join('\n') || 'No lessons learned yet'}

# KNOWN ISSUES & SOLUTIONS
${memory.known_issues.map((i: any) => 
  `Issue: ${i.issue} (occurred ${i.frequency} times)\nSolution: ${i.solution}`
).join('\n\n') || 'No known issues'}

# USER PREFERENCES
Coding Style: ${memory.user_preferences.codingStyle}
Preferred Libraries: ${memory.user_preferences.preferredLibraries.join(', ')}
Avoidances: ${memory.user_preferences.avoidances.join(', ') || 'None'}

# CURRENT REQUEST
${prompt}
`;

  return new Response(JSON.stringify({ context, memory }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function updateMemory(supabase: any, sessionId: string, changes: CodeChange[], errors: any[]) {
  // Load existing memory
  const memoryResponse = await loadMemory(supabase, sessionId);
  const memoryData = await memoryResponse.json();
  
  if (memoryData.error) {
    return memoryResponse;
  }

  const memory = memoryData.memory;

  // Add new changes
  const newChange = {
    timestamp: new Date().toISOString(),
    description: summarizeChanges(changes),
    filesAffected: changes.map(c => c.path),
    lessons: extractLessons(changes, errors)
  };

  const updatedChanges = [...memory.recent_changes, newChange];
  
  // Keep only last 50 changes
  const recentChanges = updatedChanges.slice(-50);

  // Update known issues
  const knownIssues = [...memory.known_issues];
  
  for (const error of errors) {
    const errorMessage = error.message || String(error);
    const existing = knownIssues.find(i => i.issue === errorMessage);
    
    if (existing) {
      existing.frequency++;
    } else {
      knownIssues.push({
        issue: errorMessage,
        solution: await generateSolution(error),
        frequency: 1
      });
    }
  }

  // Update database
  const { data, error: updateError } = await supabase
    .from('project_memory')
    .update({
      recent_changes: recentChanges,
      known_issues: knownIssues
    })
    .eq('session_id', sessionId)
    .select()
    .single();

  if (updateError) {
    console.error('Update memory error:', updateError);
    return new Response(JSON.stringify({ error: updateError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ memory: data, updated: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

function summarizeChanges(changes: CodeChange[]): string {
  const counts = {
    create: changes.filter(c => c.type === 'create').length,
    modify: changes.filter(c => c.type === 'modify').length,
    delete: changes.filter(c => c.type === 'delete').length
  };

  const parts: string[] = [];
  if (counts.create > 0) parts.push(`Created ${counts.create} file(s)`);
  if (counts.modify > 0) parts.push(`Modified ${counts.modify} file(s)`);
  if (counts.delete > 0) parts.push(`Deleted ${counts.delete} file(s)`);

  return parts.join(', ') || 'No changes';
}

function extractLessons(changes: CodeChange[], errors: any[]): string[] {
  const lessons: string[] = [];

  // Learn from errors
  if (errors.length > 0) {
    lessons.push(`Encountered ${errors.length} error(s) - ensure proper validation before applying changes`);
    
    // Specific error patterns
    errors.forEach(error => {
      const errorMsg = error.message || String(error);
      
      if (errorMsg.includes('import')) {
        lessons.push('Double-check import paths and ensure all dependencies exist');
      }
      if (errorMsg.includes('syntax')) {
        lessons.push('Validate syntax before applying modifications');
      }
      if (errorMsg.includes('undefined')) {
        lessons.push('Ensure all referenced variables and functions are defined');
      }
    });
  }

  // Learn from changes
  const modifiedFiles = changes.filter(c => c.type === 'modify').map(c => c.path);
  if (modifiedFiles.length > 5) {
    lessons.push('Large-scale changes detected - consider breaking into smaller modifications');
  }

  // Pattern detection
  const componentChanges = changes.filter(c => c.path.includes('components/'));
  if (componentChanges.length > 0) {
    lessons.push('Component modifications require checking for prop usage and imports');
  }

  return lessons;
}

async function generateSolution(error: any): Promise<string> {
  const errorMsg = error.message || String(error);

  // Common error patterns and solutions
  if (errorMsg.includes('Cannot find module')) {
    return 'Check import path and ensure the module exists. Use absolute imports with @ alias.';
  }
  
  if (errorMsg.includes('is not defined')) {
    return 'Ensure the variable/function is imported or defined before use.';
  }
  
  if (errorMsg.includes('syntax error')) {
    return 'Review code syntax - check for missing brackets, semicolons, or invalid characters.';
  }
  
  if (errorMsg.includes('Type')) {
    return 'Type mismatch detected - ensure proper TypeScript types are used.';
  }
  
  if (errorMsg.includes('undefined')) {
    return 'Check for null/undefined values - add proper null checks or optional chaining.';
  }

  return 'Review the error context and ensure all dependencies and references are correct.';
}