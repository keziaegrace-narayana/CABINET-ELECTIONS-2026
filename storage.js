/* ============================================================
   storage.js — localStorage Layer for Cabinet Elections 2026–27
   ============================================================ */

const STORAGE_KEYS = {
  CANDIDATES: 'nts_candidates',
  VOTES: 'nts_votes',
  VOTED_STUDENTS: 'nts_voted_students',
  SETTINGS: 'nts_settings',
};

const StorageService = {
  // ── CANDIDATES ───────────────────────────────────
  getCandidates() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CANDIDATES);
      return data ? JSON.parse(data) : { positions: [], candidates: {} };
    } catch (err) {
      console.error('Failed to get candidates:', err);
      return { positions: [], candidates: {} };
    }
  },

  setCandidates(data) {
    try {
      localStorage.setItem(STORAGE_KEYS.CANDIDATES, JSON.stringify(data));
      return true;
    } catch (err) {
      console.error('Failed to save candidates:', err);
      return false;
    }
  },

  addCandidate(position, candidateData) {
    try {
      const data = this.getCandidates();
      if (!data.positions.includes(position)) {
        data.positions.push(position);
      }
      if (!data.candidates[position]) {
        data.candidates[position] = [];
      }
      data.candidates[position].push(candidateData);
      this.setCandidates(data);
      return true;
    } catch (err) {
      console.error('Failed to add candidate:', err);
      return false;
    }
  },

  updateCandidate(position, candidateId, candidateData) {
    try {
      const data = this.getCandidates();
      if (data.candidates[position]) {
        const idx = data.candidates[position].findIndex(c => c.id === candidateId);
        if (idx !== -1) {
          data.candidates[position][idx] = { ...data.candidates[position][idx], ...candidateData };
          this.setCandidates(data);
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error('Failed to update candidate:', err);
      return false;
    }
  },

  deleteCandidate(position, candidateId) {
    try {
      const data = this.getCandidates();
      if (data.candidates[position]) {
        data.candidates[position] = data.candidates[position].filter(c => c.id !== candidateId);
        this.setCandidates(data);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to delete candidate:', err);
      return false;
    }
  },

  // ── VOTES ────────────────────────────────────────
  getVotes() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.VOTES);
      return data ? JSON.parse(data) : [];
    } catch (err) {
      console.error('Failed to get votes:', err);
      return [];
    }
  },

  addVote(voteData) {
    try {
      const votes = this.getVotes();
      votes.push({
        ...voteData,
        timestamp: new Date().toISOString(),
      });
      localStorage.setItem(STORAGE_KEYS.VOTES, JSON.stringify(votes));
      return true;
    } catch (err) {
      console.error('Failed to add vote:', err);
      return false;
    }
  },

  resetVotes() {
    try {
      localStorage.setItem(STORAGE_KEYS.VOTES, JSON.stringify([]));
      return true;
    } catch (err) {
      console.error('Failed to reset votes:', err);
      return false;
    }
  },

  // ── VOTED STUDENTS ───────────────────────────────
  getVotedStudents() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.VOTED_STUDENTS);
      return data ? JSON.parse(data) : [];
    } catch (err) {
      console.error('Failed to get voted students:', err);
      return [];
    }
  },

  hasVoted(admissionNo) {
    const students = this.getVotedStudents();
    return students.includes(String(admissionNo).trim());
  },

  markAsVoted(admissionNo) {
    try {
      const students = this.getVotedStudents();
      const admNo = String(admissionNo).trim();
      if (!students.includes(admNo)) {
        students.push(admNo);
        localStorage.setItem(STORAGE_KEYS.VOTED_STUDENTS, JSON.stringify(students));
      }
      return true;
    } catch (err) {
      console.error('Failed to mark as voted:', err);
      return false;
    }
  },

  resetVotedStudents() {
    try {
      localStorage.setItem(STORAGE_KEYS.VOTED_STUDENTS, JSON.stringify([]));
      return true;
    } catch (err) {
      console.error('Failed to reset voted students:', err);
      return false;
    }
  },

  // ── SETTINGS ─────────────────────────────────────
  getSettings() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? JSON.parse(data) : { locked: false, adminPassword: 'Narayana@Admin2026' };
    } catch (err) {
      console.error('Failed to get settings:', err);
      return { locked: false, adminPassword: 'Narayana@Admin2026' };
    }
  },

  setSettings(settings) {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
      return true;
    } catch (err) {
      console.error('Failed to save settings:', err);
      return false;
    }
  },

  toggleLock(locked) {
    try {
      const settings = this.getSettings();
      settings.locked = locked;
      this.setSettings(settings);
      return true;
    } catch (err) {
      console.error('Failed to toggle lock:', err);
      return false;
    }
  },

  isLocked() {
    return this.getSettings().locked;
  },

  // ── EXPORT/IMPORT ───────────────────────────────
  exportData() {
    try {
      return {
        candidates: this.getCandidates(),
        votes: this.getVotes(),
        votedStudents: this.getVotedStudents(),
        settings: this.getSettings(),
        exportedAt: new Date().toISOString(),
      };
    } catch (err) {
      console.error('Failed to export data:', err);
      return null;
    }
  },

  importData(data) {
    try {
      if (data.candidates) this.setCandidates(data.candidates);
      if (data.votes) localStorage.setItem(STORAGE_KEYS.VOTES, JSON.stringify(data.votes));
      if (data.votedStudents) localStorage.setItem(STORAGE_KEYS.VOTED_STUDENTS, JSON.stringify(data.votedStudents));
      if (data.settings) this.setSettings(data.settings);
      return true;
    } catch (err) {
      console.error('Failed to import data:', err);
      return false;
    }
  },

  // ── COMPUTE STATS ────────────────────────────────
  computeStats() {
    try {
      const votes = this.getVotes();
      const candidates = this.getCandidates();
      
      const totalVotes = votes.length;
      const positionResults = {};

      candidates.positions.forEach(pos => {
        positionResults[pos] = {};
        votes.forEach(vote => {
          if (vote.votes && vote.votes[pos]) {
            const candidateName = vote.votes[pos];
            positionResults[pos][candidateName] = (positionResults[pos][candidateName] || 0) + 1;
          }
        });
      });

      return {
        success: true,
        totalVotes,
        positionResults,
        locked: this.isLocked(),
        lastVote: votes.length > 0 ? votes[votes.length - 1].timestamp : null,
      };
    } catch (err) {
      console.error('Failed to compute stats:', err);
      return {
        success: false,
        error: err.message,
        totalVotes: 0,
        positionResults: {},
        locked: false,
        lastVote: null,
      };
    }
  },
};
