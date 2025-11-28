/**
 * Service d'optimisation du contexte pour l'agent AI
 * Combine chunking intelligent et embeddings pour sélectionner le meilleur contexte
 */

import { CodeChunker, CodeChunk } from './codeChunker';
import { EmbeddingService } from './embeddingService';

export interface OptimizedContext {
  relevantFiles: Array<{ path: string; content: string; score: number }>;
  chunks: CodeChunk[];
  totalTokens: number;
  optimizationStrategy: 'full' | 'chunked' | 'filtered';
}

export class ContextOptimizer {
  private static readonly MAX_CONTEXT_TOKENS = 20000; // ~15k pour le contexte projet
  private static readonly CHARS_PER_TOKEN = 4; // Approximation Claude
  private static readonly MIN_RELEVANCE_SCORE = 0.3;

  /**
   * Optimise le contexte pour une requête utilisateur
   * Sélectionne intelligemment les fichiers/chunks les plus pertinents
   */
  static async optimizeContext(
    userMessage: string,
    projectFiles: Record<string, string>,
    options: {
      maxTokens?: number;
      useEmbeddings?: boolean;
      complexity?: 'trivial' | 'simple' | 'moderate' | 'complex';
    } = {}
  ): Promise<OptimizedContext> {
    const maxTokens = options.maxTokens || this.MAX_CONTEXT_TOKENS;
    const useEmbeddings = options.useEmbeddings !== false; // Default true
    const complexity = options.complexity || 'moderate';

    console.log('🔍 Optimizing context:', { 
      filesCount: Object.keys(projectFiles).length, 
      maxTokens, 
      useEmbeddings, 
      complexity 
    });

    // Étape 1: Scoring basique (keywords, file patterns)
    const scoredFiles = this.scoreFilesBasic(userMessage, projectFiles);

    // Étape 2: Si embeddings activés et projet suffisamment grand
    let finalScores = scoredFiles;
    if (useEmbeddings && Object.keys(projectFiles).length > 5) {
      try {
        finalScores = await this.rescoreWithEmbeddings(
          userMessage,
          scoredFiles,
          projectFiles
        );
      } catch (error) {
        console.warn('Embeddings failed, using basic scoring:', error);
      }
    }

    // Étape 3: Sélectionner selon la complexité
    const selectedFiles = this.selectFilesByComplexity(finalScores, complexity, maxTokens);

    // Étape 4: Chunking si nécessaire
    const { chunks, strategy } = this.chunkIfNeeded(selectedFiles, maxTokens);

    const totalTokens = this.estimateTokens(
      chunks.length > 0 
        ? chunks.map(c => c.content).join('\n')
        : selectedFiles.map(f => f.content).join('\n')
    );

    console.log('✅ Context optimized:', { 
      filesSelected: selectedFiles.length, 
      chunksCreated: chunks.length,
      totalTokens, 
      strategy 
    });

    return {
      relevantFiles: selectedFiles,
      chunks,
      totalTokens,
      optimizationStrategy: strategy
    };
  }

  /**
   * Scoring basique basé sur keywords et patterns
   */
  private static scoreFilesBasic(
    message: string,
    projectFiles: Record<string, string>
  ): Array<{ path: string; content: string; score: number }> {
    const messageLower = message.toLowerCase();
    const keywords = this.extractKeywords(messageLower);

    return Object.entries(projectFiles).map(([path, content]) => {
      let score = 0;
      const pathLower = path.toLowerCase();
      const contentStr = typeof content === 'string' ? content : '';
      const contentLower = contentStr.toLowerCase();

      // Mention explicite du fichier
      if (messageLower.includes(pathLower) || messageLower.includes(path.split('/').pop() || '')) {
        score += 50;
      }

      // Keywords dans le nom
      const keywordMatches = keywords.filter(kw => pathLower.includes(kw)).length;
      score += keywordMatches * 10;

      // Keywords dans le contenu
      const contentMatches = keywords.filter(kw => contentLower.includes(kw)).length;
      score += contentMatches * 2;

      // Fichiers critiques
      if (this.isCriticalFile(path)) score += 25;

      // Type de fichier
      if (this.isRelevantFileType(path)) score += 10;

      // Pénalités
      if (this.shouldIgnoreFile(path)) score = 0;
      if (this.isConfigFile(path) && score < 30) score *= 0.5;

      return { path, content: contentStr, score };
    });
  }

  /**
   * Rescoring avec embeddings pour améliorer la précision
   */
  private static async rescoreWithEmbeddings(
    message: string,
    scoredFiles: Array<{ path: string; content: string; score: number }>,
    projectFiles: Record<string, string>
  ): Promise<Array<{ path: string; content: string; score: number }>> {
    // Prendre top 20 candidats pour embeddings (coût limité)
    const topCandidates = scoredFiles
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    // Générer embeddings pour le message et les candidats
    const candidateTexts = topCandidates.map(f => {
      // Utiliser preview du fichier (premiers 500 chars) pour embedding
      const preview = f.content.slice(0, 500);
      return `${f.path}\n${preview}`;
    });

    const similarities = await EmbeddingService.findSimilar(
      message,
      candidateTexts,
      topCandidates.length
    );

    // Fusionner scores: 60% basic + 40% embedding
    return scoredFiles.map(file => {
      const embeddingResult = similarities.find(s => 
        candidateTexts[s.index].startsWith(file.path)
      );

      if (embeddingResult) {
        const embeddingScore = embeddingResult.score * 100; // 0-1 -> 0-100
        const combinedScore = file.score * 0.6 + embeddingScore * 0.4;
        return { ...file, score: combinedScore };
      }

      return file;
    });
  }

  /**
   * Sélectionne les fichiers selon la complexité de la tâche
   */
  private static selectFilesByComplexity(
    scoredFiles: Array<{ path: string; content: string; score: number }>,
    complexity: 'trivial' | 'simple' | 'moderate' | 'complex',
    maxTokens: number
  ): Array<{ path: string; content: string; score: number }> {
    const sorted = scoredFiles.sort((a, b) => b.score - a.score);

    let fileLimit: number;
    let tokenBudget: number;

    switch (complexity) {
      case 'trivial':
        fileLimit = 2;
        tokenBudget = maxTokens * 0.3;
        break;
      case 'simple':
        fileLimit = 5;
        tokenBudget = maxTokens * 0.5;
        break;
      case 'moderate':
        fileLimit = 10;
        tokenBudget = maxTokens * 0.7;
        break;
      case 'complex':
        fileLimit = 15;
        tokenBudget = maxTokens;
        break;
    }

    // Sélectionner fichiers jusqu'à atteindre limite ou budget
    const selected: typeof sorted = [];
    let currentTokens = 0;

    for (const file of sorted) {
      if (selected.length >= fileLimit) break;
      
      const fileTokens = this.estimateTokens(file.content);
      if (currentTokens + fileTokens > tokenBudget) break;

      if (file.score > 5) { // Score minimum
        selected.push(file);
        currentTokens += fileTokens;
      }
    }

    // Toujours inclure fichiers critiques
    this.ensureCriticalFiles(selected, scoredFiles, tokenBudget - currentTokens);

    return selected;
  }

  /**
   * Chunking si les fichiers sont trop gros
   */
  private static chunkIfNeeded(
    selectedFiles: Array<{ path: string; content: string; score: number }>,
    maxTokens: number
  ): { chunks: CodeChunk[]; strategy: 'full' | 'chunked' | 'filtered' } {
    const totalTokens = this.estimateTokens(
      selectedFiles.map(f => f.content).join('\n')
    );

    // Si ça tient, pas de chunking
    if (totalTokens <= maxTokens * 0.8) {
      return { chunks: [], strategy: 'full' };
    }

    // Chunking intelligent
    const allChunks: CodeChunk[] = [];
    for (const file of selectedFiles) {
      const fileChunks = CodeChunker.chunkFile(file.path, file.content);
      allChunks.push(...fileChunks);
    }

    // Sélectionner top chunks par importance
    const sortedChunks = allChunks.sort((a, b) => b.importance - a.importance);
    const selectedChunks: CodeChunk[] = [];
    let currentTokens = 0;

    for (const chunk of sortedChunks) {
      const chunkTokens = this.estimateTokens(chunk.content);
      if (currentTokens + chunkTokens > maxTokens * 0.9) break;
      
      selectedChunks.push(chunk);
      currentTokens += chunkTokens;
    }

    return { chunks: selectedChunks, strategy: 'chunked' };
  }

  /**
   * Assure que les fichiers critiques sont inclus
   */
  private static ensureCriticalFiles(
    selected: Array<{ path: string; content: string; score: number }>,
    allFiles: Array<{ path: string; content: string; score: number }>,
    remainingTokens: number
  ) {
    const criticalPatterns = ['index.html', 'App.tsx', 'main.tsx', 'styles.css', 'script.js'];
    
    for (const pattern of criticalPatterns) {
      const critical = allFiles.find(f => 
        f.path.endsWith(pattern) || f.path.includes(pattern)
      );
      
      if (critical && !selected.some(s => s.path === critical.path)) {
        const tokens = this.estimateTokens(critical.content);
        if (tokens <= remainingTokens) {
          selected.push(critical);
        }
      }
    }
  }

  /**
   * Estime le nombre de tokens
   */
  private static estimateTokens(text: string): number {
    return Math.ceil(text.length / this.CHARS_PER_TOKEN);
  }

  /**
   * Extrait keywords du message
   */
  private static extractKeywords(text: string): string[] {
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 
      'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must',
      'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they']);

    return text
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .filter((word, idx, arr) => arr.indexOf(word) === idx)
      .slice(0, 15);
  }

  private static isCriticalFile(path: string): boolean {
    const critical = ['index', 'app', 'main', 'layout', 'config', 'route'];
    return critical.some(c => path.toLowerCase().includes(c));
  }

  private static isRelevantFileType(path: string): boolean {
    const ext = path.split('.').pop()?.toLowerCase();
    return ['tsx', 'ts', 'jsx', 'js', 'html', 'css'].includes(ext || '');
  }

  private static shouldIgnoreFile(path: string): boolean {
    const ignore = ['node_modules', 'dist', 'build', '.git'];
    return ignore.some(i => path.toLowerCase().includes(i));
  }

  private static isConfigFile(path: string): boolean {
    return path.toLowerCase().includes('config') || path.endsWith('.json');
  }
}
