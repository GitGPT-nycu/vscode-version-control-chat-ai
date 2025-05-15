/**
 * Git Log Parser Module
 * Parses git log output in the format: %h (%an) (%ar) (%s) %d [%p]
 */
export class GitLogParser {
  /**
   * Parse the git log output and return structured data
   * @param {string} logText - The raw git log text
   * @returns {Array} - Array of commit objects
   */
  static parse(logText) {
    if (!logText || logText.trim() === '') {
      throw new Error('Empty git log input');
    }

    const lines = logText.trim().split('\n');
    const commits = [];

    // Regular expression to match the git log format
    // %h (%an) (%ar) (%s) %d [%p]
    const regex =
      /^([0-9a-f]+) \(([^)]+)\) \(([^)]+)\) \(([^)]+)\)(?:\s+\(([^)]*)\))?\s+\[([^\]]*)\]$/;

    for (const line of lines) {
      const match = line.match(regex);
      if (!match) {
        console.warn(`Unable to parse line: ${line}`);
        continue;
      }

      const [, hash, author, date, message, refs, parents] = match;

      // Parse references (branches, tags)
      const refsArray = refs
        ? refs.split(', ').filter((ref) => ref.trim() !== '')
        : [];

      // Parse parent hashes
      const parentsArray = parents
        ? parents.split(' ').filter((parent) => parent.trim() !== '')
        : [];

      // Create commit object
      const commit = {
        hash,
        author,
        date,
        message,
        refs: refsArray,
        parents: parentsArray,
      };

      commits.push(commit);
    }

    if (commits.length === 0) {
      throw new Error('No valid commits found in the input');
    }

    return commits;
  }

  /**
   * Build a graph representation of the commits
   * @param {Array} commits - Array of commit objects
   * @returns {Object} - Graph representation with nodes and links
   */
  static buildGraph(commits) {
    const nodes = [];
    const links = [];
    const hashToIndex = new Map();

    // First pass: create nodes
    commits.forEach((commit, index) => {
      hashToIndex.set(commit.hash, index);
      nodes.push({
        id: commit.hash,
        author: commit.author,
        date: commit.date,
        message: commit.message,
        refs: commit.refs,
        parents: commit.parents,
      });
    });

    // Second pass: create links
    commits.forEach((commit) => {
      const sourceIndex = hashToIndex.get(commit.hash);

      commit.parents.forEach((parentHash) => {
        const targetIndex = hashToIndex.get(parentHash);

        if (targetIndex !== undefined) {
          links.push({
            source: sourceIndex,
            target: targetIndex,
            sourceHash: commit.hash,
            targetHash: parentHash,
          });
        }
      });
    });

    return { nodes, links };
  }

  /**
   * Get a sample git log for testing purposes
   * @returns {string} - Sample git log text
   */
  static getSampleLog() {
    return `f3a2b1c (Alice) (2 hours ago) (Merge branch 'feature' into 'main')  (HEAD -> main) [a1b2c3d 9e8f7a2]
a1b2c3d (Alice) (3 hours ago) (Add final documentation)  [7c9d4e5]
9e8f7a2 (Bob) (4 hours ago) (Implement feature X)  (feature) [6f5a3b1]
7c9d4e5 (Alice) (1 day ago) (Update README)  [2d8e9f0]
6f5a3b1 (Bob) (2 days ago) (Add initial feature code)  [2d8e9f0]
2d8e9f0 (Alice) (3 days ago) (Initial commit)  []`;
  }
}
