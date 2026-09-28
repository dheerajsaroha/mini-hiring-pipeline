import { CandidateWithHistory } from "shared";
import { search, SearchResult } from "./ranker.js";
import { listCandidatesGroupedByStage } from "../db/repository.js";

let candidatesCache: CandidateWithHistory[] = [];
let cacheTime: Date | null = null;
const CACHE_TTL = 5000; // 5 seconds

export async function getAllCandidates(now: Date = new Date()): Promise<CandidateWithHistory[]> {
  if (candidatesCache.length > 0 && cacheTime && now.getTime() - cacheTime.getTime() < CACHE_TTL) {
    return candidatesCache;
  }

  const grouped = listCandidatesGroupedByStage(now);
  candidatesCache = Object.values(grouped).flat();
  cacheTime = now;
  return candidatesCache;
}

export async function executeSearch(query: string, now: Date = new Date()): Promise<SearchResult> {
  const candidates = await getAllCandidates(now);
  return search(candidates, query, now);
}

export function clearCache(): void {
  candidatesCache = [];
  cacheTime = null;
}