import { useState, useEffect, useCallback } from "react";
import { CandidateWithHistory, Stage, SearchResponse } from "shared";
import SearchBar from "./components/SearchBar";
import Board from "./components/Board";
import CandidateDrawer from "./components/CandidateDrawer";
import AddCandidateModal from "./components/AddCandidateModal";

const API_BASE = "/api";

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStageClass(stage: Stage): string {
  return `stage-${stage.toLowerCase()}`;
}

export default function App() {
  const [candidatesByStage, setCandidatesByStage] = useState<Record<Stage, CandidateWithHistory[]>>({
    Applied: [],
    Screening: [],
    Interview: [],
    Offer: [],
    Hired: [],
    Rejected: [],
  });
  const [loading, setLoading] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateWithHistory | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [isSearchMode, setIsSearchMode] = useState(false);

  const fetchCandidates = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/candidates`);
      if (!res.ok) throw new Error("Failed to fetch candidates");
      const data = await res.json();
      setCandidatesByStage(data);
    } catch (error) {
      console.error("Failed to fetch candidates:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCandidateDetail = useCallback(async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/candidates/${id}`);
      if (!res.ok) throw new Error("Failed to fetch candidate");
      const data = await res.json();
      setSelectedCandidate(data);
    } catch (error) {
      console.error("Failed to fetch candidate detail:", error);
    }
  }, []);

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults(null);
      setIsSearchMode(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setSearchResults(data);
      setIsSearchMode(true);
    } catch (error) {
      console.error("Search failed:", error);
    }
  }, []);

  const handleTransition = async (
    candidateId: number,
    to: Stage,
    expectedStage: Stage,
    note?: string
  ) => {
    try {
      const res = await fetch(`${API_BASE}/candidates/${candidateId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, expectedStage, note }),
      });
      if (!res.ok) {
        const error = await res.json();
        alert(error.error || "Transition failed");
        return;
      }
      await fetchCandidates();
      if (selectedCandidate?.id === candidateId) {
        fetchCandidateDetail(candidateId);
      }
    } catch (error) {
      console.error("Transition failed:", error);
    }
  };

  const handleAddCandidate = async (name: string, email?: string) => {
    try {
      const res = await fetch(`${API_BASE}/candidates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      if (!res.ok) {
        const error = await res.json();
        alert(error.error || "Failed to create candidate");
        return;
      }
      setShowAddModal(false);
      await fetchCandidates();
    } catch (error) {
      console.error("Failed to add candidate:", error);
    }
  };

  const handleDrawerClose = () => {
    setSelectedCandidate(null);
  };

  const getAllCandidates = () => {
    return Object.values(candidatesByStage).flat();
  };

  const getCandidateForDrawer = (id: number) => {
    return getAllCandidates().find(c => c.id === id) || null;
  };

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  useEffect(() => {
    if (selectedCandidate) {
      fetchCandidateDetail(selectedCandidate.id);
    }
  }, [selectedCandidate, fetchCandidateDetail]);

  const displayCandidates = isSearchMode && searchResults
    ? { Search: searchResults.results.map(r => r.candidate) }
    : candidatesByStage;

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <h1>📋 Hiring Pipeline</h1>
          <SearchBar
            value={searchQuery}
            onSearch={handleSearch}
            results={searchResults}
            onClear={() => {
              setSearchQuery("");
              setSearchResults(null);
              setIsSearchMode(false);
            }}
          />
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            + Add Candidate
          </button>
        </div>
      </header>

      <main className="main-content">
        {loading ? (
          <div className="loading"><div className="spinner"></div>Loading...</div>
        ) : (
          <Board
            columns={displayCandidates}
            onCardClick={(id) => {
              const candidate = getCandidateForDrawer(id);
              if (candidate) setSelectedCandidate(candidate);
            }}
            onMove={handleTransition}
            getStageClass={getStageClass}
          />
        )}
      </main>

      {selectedCandidate && (
        <CandidateDrawer
          candidate={selectedCandidate}
          onClose={handleDrawerClose}
          onMove={handleTransition}
          getStageClass={getStageClass}
          formatDate={formatDate}
        />
      )}

      {showAddModal && (
        <AddCandidateModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddCandidate}
        />
      )}
    </div>
  );
}