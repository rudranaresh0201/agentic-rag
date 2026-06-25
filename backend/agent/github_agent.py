from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

from github import Github, GithubException

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
GITHUB_USERNAME = os.getenv("GITHUB_USERNAME", "")


def _client(token: str | None = None) -> Github:
    t = token or GITHUB_TOKEN
    if not t:
        raise RuntimeError("GitHub token not configured")
    return Github(t)


def _get_user_token(user_id: str) -> str | None:
    """Look up the user's personal GitHub token from the DB."""
    if not user_id:
        return None
    try:
        import uuid as _uuid
        from backend.db.postgres import get_db
        from backend.db.models import User
        db = next(get_db())
        try:
            user = db.query(User).filter(User.id == _uuid.UUID(user_id)).first()
            return user.github_token if user else None
        finally:
            db.close()
    except Exception:
        return None


def get_recent_commits(username: str, days: int = 7) -> list[dict]:
    g = _client()
    user = g.get_user(username)
    since = datetime.now(timezone.utc) - timedelta(days=days)
    results: list[dict] = []
    for repo in user.get_repos(type="owner", sort="pushed"):
        if repo.pushed_at and repo.pushed_at.replace(tzinfo=timezone.utc) < since:
            break
        try:
            for commit in repo.get_commits(author=username, since=since):
                results.append({
                    "repo": repo.full_name,
                    "sha": commit.sha[:7],
                    "message": commit.commit.message.split("\n")[0],
                    "date": commit.commit.author.date.isoformat(),
                    "url": commit.html_url,
                })
                if len(results) >= 20:
                    return results
        except GithubException:
            continue
    return results


def get_repo_commits(repo: str, days: int = 7) -> list[dict]:
    g = _client()
    repository = g.get_repo(repo)
    since = datetime.now(timezone.utc) - timedelta(days=days)
    results: list[dict] = []
    for commit in repository.get_commits(since=since):
        results.append({
            "repo": repo,
            "sha": commit.sha[:7],
            "message": commit.commit.message.split("\n")[0],
            "date": commit.commit.author.date.isoformat(),
            "url": commit.html_url,
        })
        if len(results) >= 20:
            break
    return results


def get_open_prs(repo: str) -> list[dict]:
    g = _client()
    repository = g.get_repo(repo)
    return [
        {
            "number": pr.number,
            "title": pr.title,
            "author": pr.user.login,
            "created_at": pr.created_at.isoformat(),
            "url": pr.html_url,
            "labels": [label.name for label in pr.labels],
        }
        for pr in repository.get_pulls(state="open", sort="updated", direction="desc")[:20]
    ]


def get_issues(repo: str) -> list[dict]:
    g = _client()
    repository = g.get_repo(repo)
    return [
        {
            "number": issue.number,
            "title": issue.title,
            "author": issue.user.login,
            "created_at": issue.created_at.isoformat(),
            "url": issue.html_url,
            "labels": [label.name for label in issue.labels],
        }
        for issue in repository.get_issues(state="open", sort="updated", direction="desc")[:20]
        if issue.pull_request is None
    ]


def create_pull_request(repo: str, title: str, body: str, head: str, base: str = "main", user_id: str = "") -> dict:
    g = _client(_get_user_token(user_id))
    repository = g.get_repo(repo)
    pr = repository.create_pull(title=title, body=body, head=head, base=base)
    return {"success": True, "pr_url": pr.html_url, "pr_number": pr.number}


def commit_files_to_branch(
    repo: str,
    branch: str,
    base: str,
    files: list[dict],
    commit_message: str,
    user_id: str = "",
) -> dict:
    """Create branch from base and commit each file. Called only after HITL confirmation."""
    g = _client(_get_user_token(user_id))
    repository = g.get_repo(repo)
    try:
        base_sha = repository.get_branch(base).commit.sha
    except GithubException:
        base = repository.default_branch
        base_sha = repository.get_branch(base).commit.sha
    repository.create_git_ref(ref=f"refs/heads/{branch}", sha=base_sha)
    committed: list[str] = []
    for f in files:
        path: str = f["path"]
        content: str = f["content"]
        try:
            existing = repository.get_contents(path, ref=branch)
            repository.update_file(path, commit_message, content, existing.sha, branch=branch)
        except Exception:
            repository.create_file(path, commit_message, content, branch=branch)
        committed.append(path)
    branch_url = f"https://github.com/{repo}/tree/{branch}"
    return {"success": True, "branch": branch, "files_committed": committed, "branch_url": branch_url}


def get_user_activity(username: str) -> list[dict]:
    g = _client()
    results: list[dict] = []
    for event in g.get_user(username).get_public_events():
        payload = event.payload
        if event.type == "PushEvent":
            commits = payload.get("commits", [])
            detail = f"{len(commits)} commit(s): {commits[0]['message'].split(chr(10))[0] if commits else ''}"
        elif event.type == "PullRequestEvent":
            pr = payload.get("pull_request", {})
            detail = f"{payload.get('action', '')} PR: {pr.get('title', '')}"
        elif event.type == "IssuesEvent":
            detail = f"{payload.get('action', '')} issue: {payload.get('issue', {}).get('title', '')}"
        elif event.type == "CreateEvent":
            detail = f"Created {payload.get('ref_type', '')} {payload.get('ref', '')}"
        else:
            detail = event.type
        results.append({
            "type": event.type,
            "repo": event.repo.name,
            "created_at": event.created_at.isoformat(),
            "detail": detail,
        })
        if len(results) >= 15:
            break
    return results
