/**
 * Service de génération et comparaison d'embeddings
 * Utilise une approche hybride : TF-IDF local + embeddings Claude via edge function
 */

import { supabase } from '@/integrations/supabase/client';

export interface EmbeddingResult {
  text: string;
  embedding: number[];
  score?: number;
}

export class EmbeddingService {
  private static cache = new Map<string, number[]>();
  private static readonly CACHE_SIZE = 100;

  /**
   * Génère des embeddings pour un texte via Claude (edge function)
   */
  static async generateEmbedding(text: string): Promise<number[]> {
    // Vérifier le cache
    const cacheKey = this.getCacheKey(text);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      const { data, error } = await supabase.functions.invoke('generate-embeddings', {
        body: { texts: [text] }
      });

      if (error) throw error;
      
      const embedding = data.embeddings[0];
      this.addToCache(cacheKey, embedding);
      return embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      // Fallback to local TF-IDF if Claude fails
      return this.generateLocalEmbedding(text);
    }
  }

  /**
   * Génère des embeddings pour plusieurs textes en batch
   */
  static async generateEmbeddings(texts: string[]): Promise<number[][]> {
    // Séparer cachés vs non-cachés
    const cached: (number[] | null)[] = texts.map(t => {
      const key = this.getCacheKey(t);
      return this.cache.has(key) ? this.cache.get(key)! : null;
    });

    const uncachedIndices = cached
      .map((emb, idx) => emb === null ? idx : -1)
      .filter(idx => idx !== -1);

    if (uncachedIndices.length === 0) {
      return cached as number[][];
    }

    try {
      const uncachedTexts = uncachedIndices.map(idx => texts[idx]);
      const { data, error } = await supabase.functions.invoke('generate-embeddings', {
        body: { texts: uncachedTexts }
      });

      if (error) throw error;

      // Remplir les embeddings manquants
      uncachedIndices.forEach((originalIdx, i) => {
        const embedding = data.embeddings[i];
        cached[originalIdx] = embedding;
        this.addToCache(this.getCacheKey(texts[originalIdx]), embedding);
      });

      return cached as number[][];
    } catch (error) {
      console.error('Error generating embeddings:', error);
      // Fallback to local embeddings
      return texts.map(t => cached[texts.indexOf(t)] || this.generateLocalEmbedding(t));
    }
  }

  /**
   * Calcule la similarité cosinus entre deux embeddings
   */
  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (normA * normB);
  }

  /**
   * Trouve les textes les plus similaires à une query
   */
  static async findSimilar(
    query: string,
    candidates: string[],
    topK: number = 5
  ): Promise<Array<{ text: string; score: number; index: number }>> {
    // Générer embeddings
    const queryEmbedding = await this.generateEmbedding(query);
    const candidateEmbeddings = await this.generateEmbeddings(candidates);

    // Calculer scores
    const scores = candidateEmbeddings.map((emb, idx) => ({
      text: candidates[idx],
      score: this.cosineSimilarity(queryEmbedding, emb),
      index: idx
    }));

    // Trier et retourner top K
    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * Génère un embedding local simple basé sur TF-IDF
   * Utilisé comme fallback si Claude n'est pas disponible
   */
  private static generateLocalEmbedding(text: string): number[] {
    // Tokenization simple
    const tokens = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2);

    // Créer un vecteur sparse basé sur TF
    const termFreq = new Map<string, number>();
    tokens.forEach(token => {
      termFreq.set(token, (termFreq.get(token) || 0) + 1);
    });

    // Convertir en vecteur dense de dimension fixe (128)
    const dimension = 128;
    const embedding = new Array(dimension).fill(0);
    
    termFreq.forEach((freq, term) => {
      // Hash simple pour mapper terme -> index
      const hash = this.hashString(term);
      const idx = Math.abs(hash) % dimension;
      embedding[idx] += freq / tokens.length; // TF normalisé
    });

    // Normalisation L2
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return norm > 0 ? embedding.map(v => v / norm) : embedding;
  }

  /**
   * Hash simple pour strings
   */
  private static hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }

  /**
   * Génère une clé de cache pour un texte (hash court)
   */
  private static getCacheKey(text: string): string {
    // Hash simple des 200 premiers caractères
    const sample = text.slice(0, 200);
    return `emb_${this.hashString(sample)}`;
  }

  /**
   * Ajoute un embedding au cache (LRU simple)
   */
  private static addToCache(key: string, embedding: number[]) {
    if (this.cache.size >= this.CACHE_SIZE) {
      // Retirer le plus ancien (premier élément du Map)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, embedding);
  }

  /**
   * Clear cache (utile pour les tests)
   */
  static clearCache() {
    this.cache.clear();
  }
}
