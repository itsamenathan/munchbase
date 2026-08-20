const REPO_URL = "https://github.com/itsamenathan/munchbase";
const SHORT_COMMIT_LENGTH = 7;

export type VersionInfo = {
  /** Commit date as a version label, e.g. "v2026-03-01". */
  label: string | null;
  /** Abbreviated commit hash, e.g. "05017a9". */
  shortCommit: string | null;
  /** Link to the commit on GitHub, or null when the commit is unknown. */
  commitUrl: string | null;
};

function versionLabel(commitDate: string | undefined) {
  const date = commitDate?.trim() ?? "";
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? `v${date}` : null;
}

function fullCommit(commit: string | undefined) {
  const sha = commit?.trim().toLowerCase() ?? "";
  return /^[0-9a-f]{7,40}$/.test(sha) ? sha : null;
}

/**
 * Builds the version stamp shown in the user menu. Both parts are optional:
 * a build without git metadata renders nothing rather than a broken label.
 */
export function buildVersionInfo(commitDate?: string, commit?: string): VersionInfo | null {
  const label = versionLabel(commitDate);
  const sha = fullCommit(commit);
  if (!label && !sha) return null;
  return {
    label,
    shortCommit: sha ? sha.slice(0, SHORT_COMMIT_LENGTH) : null,
    commitUrl: sha ? `${REPO_URL}/commit/${sha}` : null,
  };
}

/** Stamped at build time by `next.config.ts`. */
export const APP_VERSION = buildVersionInfo(
  process.env.NEXT_PUBLIC_APP_VERSION,
  process.env.NEXT_PUBLIC_APP_COMMIT,
);
