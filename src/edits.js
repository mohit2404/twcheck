const fs = require('fs');

function applyChanges(file, issues) {
  const source = fs.readFileSync(file, 'utf8');
  let fixed = source;
  for (const issue of [...issues].sort((a, b) => b.start - a.start)) fixed = fixed.slice(0, issue.start) + issue.canonical + fixed.slice(issue.end);
  return { source, fixed };
}

function applyConflictChanges(file, issues) {
  const source = fs.readFileSync(file, 'utf8');
  let fixed = source;
  const unique = [...new Map(issues.map(issue => [`${issue.conflictStart}:${issue.conflictEnd}`, issue])).values()];
  for (const issue of unique.sort((a, b) => b.conflictStart - a.conflictStart)) {
    const start = issue.conflictStart;
    const end = issue.conflictEnd;
    if (fixed[end] === ' ') fixed = fixed.slice(0, start) + fixed.slice(end + 1);
    else if (fixed[start - 1] === ' ') fixed = fixed.slice(0, start - 1) + fixed.slice(end);
    else fixed = fixed.slice(0, start) + fixed.slice(end);
  }
  return { source, fixed };
}

module.exports = { applyChanges, applyConflictChanges };
