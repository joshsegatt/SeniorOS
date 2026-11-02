import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// The guard's bypass corpus: commands that do the same damage as a guarded one by another route. Each one either asks
// for confirmation or is listed below as out of scope, with the reason, so a gap is a decision and not an accident.
// The rules live in one file shared by every host (Claude Code, Codex, Cursor, OpenCode, Antigravity).
const guardUrl = pathToFileURL(path.join(process.cwd(), 'adapters', 'antigravity', 'hooks', 'guard.mjs')).href;
const { classify } = (await import(guardUrl)) as { classify: (command: string) => string | null };

/** [command, the reason the guard must give] */
const asks: Array<[string, RegExp]> = [
  // git global options before the subcommand used to hide it from every git rule.
  ['git -C ../app push --force origin main', /force push/],
  ['git -C "my app" reset --hard', /reset --hard/],
  ['git -c core.hooksPath=/dev/null push -f', /force push/],
  ['git --git-dir=.git --work-tree=. clean -fd', /git clean/],
  ['git --no-pager branch -D feat', /deleting a branch/],
  // Remote history
  ['git push --mirror origin', /mirror push/],
  ['git push --prune origin', /remote branch/],
  // Uncommitted work beyond one file
  ['git checkout -- src', /discarding/],
  ['git checkout HEAD -- .', /discarding/],
  ['git checkout HEAD~1 -- src/', /discarding/],
  ['git checkout -- "*.ts"', /discarding/],
  ['git checkout -f main', /discarding/],
  ['git switch -f main', /discarding/],
  ['git switch --discard-changes main', /discarding/],
  ['git restore src', /discarding/],
  ['git restore --worktree --staged .', /discarding/],
  ['git restore --source HEAD~2 -- lib', /discarding/],
  // Branches, refs and the recovery points of lost commits
  ['git branch --delete --force feat', /deleting a branch/],
  ['git branch -d -f feat', /deleting a branch/],
  ['git branch -df feat', /deleting a branch/],
  ['git update-ref -d refs/heads/main', /git ref/],
  ['git reflog expire --expire=now --all', /recovery points/],
  ['git gc --prune=now', /recovery points/],
  ['git prune', /recovery points/],
  ['git worktree remove --force ../w', /worktree/],
  // Deletion by other tools
  ['find . -name "*.ts" -delete', /find matches/],
  ['find src -type f -exec rm {} +', /find matches/],
  ['rimraf src', /recursive file deletion/],
  ['npx rimraf src', /recursive file deletion/],
  ['ri -r src', /recursive file deletion/],
  ['Remove-Item src -Rec -Force', /recursive file deletion/],
  ['del -Recurse src', /recursive file deletion/],
  ['rsync -a --delete empty/ src/', /rsync/],
  ['python -c "import shutil; shutil.rmtree(\'src\')"', /recursive file deletion/],
  ['python3 -c "import shutil;shutil.rmtree(\'data\')"', /recursive file deletion/],
  ['node -e "require(\'fs\').rmSync(\'src\', { recursive: true })"', /recursive file deletion/],
  ['node -e "fs.rmSync(\'src\',{recursive:true,force:true})"', /recursive file deletion/],
  ['ruby -e "FileUtils.rm_rf(\'src\')"', /recursive file deletion/],
  // Publishing and irreversible remote actions
  ['npm unpublish senioros@1.0.0', /publishing a package/],
  ['npm deprecate senioros "x"', /publishing a package/],
  ['cargo publish', /publishing a package/],
  ['twine upload dist/*', /publishing a package/],
  ['poetry publish --build', /publishing a package/],
  ['gem push x.gem', /publishing a package/],
  ['docker push org/app:latest', /container image/],
  ['gh release delete v1.0.0', /GitHub/],
  ['gh repo archive org/app', /GitHub/],
  ['gh api -X DELETE repos/o/r/git/refs/heads/x', /GitHub/],
  ['gh api --method=DELETE repos/o/r', /GitHub/],
  // Data and infrastructure
  ['redis-cli -h db FLUSHALL', /database data/],
  ['redis-cli flushdb', /database data/],
  ['mongosh app --eval "db.dropDatabase()"', /database data/],
  ['mongosh --eval "db.users.deleteMany({})"', /database data/],
  ['aws s3 rm s3://bucket --recursive', /cloud resources/],
  ['aws s3 rb s3://bucket --force', /cloud resources/],
  ['aws s3 sync ./empty s3://bucket --delete', /cloud resources/],
  ['aws ec2 terminate-instances --instance-ids i-1', /cloud resources/],
  ['aws rds delete-db-instance --db-instance-identifier x', /cloud resources/],
  ['helm uninstall app', /infrastructure/],
  ['heroku apps:destroy --app x', /infrastructure/],
  ['pulumi destroy --yes', /infrastructure/],
  ['pulumi up', /infrastructure/],
  ['az group delete --name rg', /infrastructure/],
  ['dd if=/dev/zero of=/dev/sda bs=1M', /system change/],
  ['mkfs.ext4 /dev/sdb1', /system change/],
  // Secrets into the transcript
  ['printenv', /environment variables/],
  ['env', /environment variables/],
  ['Get-ChildItem env:', /environment variables/],
  ['echo $AWS_SECRET_ACCESS_KEY', /secret/],
  ['echo "${GITHUB_TOKEN}"', /secret/],
  ['Write-Output $env:OPENAI_API_KEY', /secret/],
  // A message is text, but double quotes still run a command substitution.
  ['git commit -m "$(rm -rf src)"', /recursive file deletion/],
  ['git commit -m "`git push --force`"', /force push/],
  ['git commit -m "wip" && rimraf src', /recursive file deletion/],
  // Review findings: dropping git's global options must not hide their values, which can run commands or name the
  // agent's own configuration, and the message rule must not hide a command another tool runs.
  ['git -c alias.x=\'!rm -rf src\' x', /recursive file deletion/],
  ['git -c "alias.x=!git push --force" x', /force push/],
  ['git -C "$(rm -rf src)" status', /recursive file deletion/],
  ['git -C ~/.claude/plugins/seniorOS rm hooks/guard.mjs', /agent's own settings/],
  ['git -C .codex/plugins/x mv a b', /agent's own settings/],
  ['ssh deploy@prod -t "git push --force origin main"', /force push/],
  ['ssh user@host -t "sudo rm -rf /var/www"', /recursive file deletion/],
  ['watch -t "rm -rf src"', /recursive file deletion/],
  ['sudo -u root -b \'rm -rf /srv\'', /recursive file deletion/],
  ['foo -m \'Set-Content .claude/settings.json x\'', /agent's own settings/],
  ['git checkout -- .github', /discarding/],
  ['git restore .husky', /discarding/],
  ['git checkout -qf main', /discarding/],
  ['rm src -rf', /recursive file deletion/],
  ['rm src -Recurse -Force', /recursive file deletion/],
  ['pwsh -Command "Remove-Item src -Recurse"', /recursive file deletion/],
  ['python -c "from shutil import rmtree; rmtree(\'src\')"', /recursive file deletion/],
  ['node -p "require(\'fs\').rmSync(\'src\',{recursive:true})"', /recursive file deletion/],
  ['aws --profile prod s3 rm s3://b --recursive', /cloud resources/],
  ['aws --region us-east-1 ec2 terminate-instances --instance-ids i-1', /cloud resources/],
  ['kubectl -n prod delete pod x', /Kubernetes/],
  ['env | grep TOKEN', /environment variables/],
  ['printenv | sort', /environment variables/],
  ['printenv GITHUB_TOKEN', /secret/],
  // SeniorOS's own commands that write a host's hooks or plugin list.
  ['senior setup --apply', /agent's own settings/],
  ['npx senioros install --target antigravity', /agent's own settings/],
  ['npx senioros uninstall --target antigravity', /agent's own settings/],
  ['npx senioros@0.8.0 install --target antigravity', /agent's own settings/],
  ['npx senioros@latest setup --apply', /agent's own settings/],
  ['node dist/src/index.js setup --apply', /agent's own settings/],
  // Built at run time but still readable in the text: caught, though not guaranteed (see out of scope).
  ['$(echo rm) -rf src', /recursive file deletion/],
];

/** Routine work that must keep running without a prompt, next to the new rules. */
const passes = [
  'git -C ../app status', 'git -C ../app push origin main', 'git --no-pager log --oneline -5',
  'git checkout -b feat', 'git checkout main', 'git checkout -- src/a.ts', 'git checkout HEAD -- .env.example',
  'git restore src/a.ts', 'git restore --staged .', 'git restore --staged src', 'git switch main', 'git switch -c feat',
  'git branch -d feat', 'git branch --delete feat', 'git branch -vv', 'git branch --format="%(refname)"',
  'git remote prune origin', 'git gc', 'git worktree remove ../w', 'git push origin main', 'git push -u origin feat',
  'find src -name "*.ts"', 'find . -type f -newer x -print', 'rimraf dist', 'npx rimraf dist coverage', 'ri -Force dist',
  'Remove-Item dist -Recurse -Force', 'rsync -a src/ backup/',
  'python -c "print(1)"', 'node -e "console.log(require(\'fs\').existsSync(\'src\'))"', 'grep -rn "shutil.rmtree" src',
  'npm publish --dry-run', 'cargo publish --dry-run', 'docker build -t app .', 'docker pull node:22',
  'gh api repos/o/r', 'gh api -X GET repos/o/r/pulls', 'gh release view v1', 'gh pr view 35',
  'redis-cli GET key', 'mongosh --eval "db.users.find()"', 'aws s3 ls s3://bucket', 'aws s3 cp a.txt s3://bucket/',
  'helm list', 'pulumi preview', 'az group list', 'dd if=disk.img of=copy.img', 'echo $HOME', 'echo $PATH',
  'env NODE_ENV=test npm test', 'printenv HOME', 'echo $TOKEN_COUNT', 'echo "$PASSWORD_HINT_TEXT"', 'Get-ChildItem env:PATH',
  // Dangerous words inside a commit message, title or search pattern are text.
  'git commit -m "remove rimraf dependency"', 'git commit -m "docs: explain git push --mirror"', "git commit -m 'drop rm -rf from the script'",
  'git log --grep="find -delete"', 'gh issue create --title "fix: aws s3 rb cleanup" --body "uses pulumi destroy"',
  // Next to the review fixes.
  'git prune-packed', 'grep "del" -r src', 'grep del -r src', 'git checkout -- .gitignore', 'git restore .env.example',
  'git restore .nvmrc', 'aws s3 cp delete-me.txt s3://bucket/', 'kubectl -n prod get pods', 'ssh -t host uptime',
  'docker build -t app .', 'git -c color.ui=always status', 'git -C ../app log -5',
  'senior setup', 'senior doctor --json', 'senior install --target claude --scope project',
];

/**
 * Out of scope, by decision. The guard is a seatbelt against an agent's mistakes in ordinary work, not a sandbox
 * against a determined adversary: hidden commands need an OS-level sandbox, and the everyday file operations below
 * would make it ask so often that people turn it off. Each stays out for the reason given.
 */
const outOfScope: Array<[string, string]> = [
  ['r=rm; $r -rf src', 'a command built at run time: only a sandbox sees what runs'],
  ['echo cm0gLXJmIHNyYw== | base64 -d | sh', 'an encoded command: only a sandbox sees what runs'],
  ['rm src/a.ts', 'one file, tracked by git and recoverable'],
  ['rm src/*.ts', 'files in one folder without -r: everyday cleanup, tracked files are recoverable'],
  ['xargs rm < files.txt', 'non-recursive deletion of listed files, like rm with several names'],
  ['mv src /tmp/x', 'a move keeps the data'],
  ['chmod -R 000 .', 'reversible, and no data is lost'],
  ['> src/index.ts', 'writing a file is how agents edit; git keeps the old content'],
  ['truncate -s 0 data.db', 'writing a file; git or a backup keeps the old content'],
  ['git reset --keep HEAD~3', 'git refuses when it would lose uncommitted changes'],
  ['git reset --merge HEAD~1', 'git refuses when it would lose uncommitted changes'],
  ['git commit --amend --no-edit', 'local, and the old commit stays in the reflog'],
  ['git checkout src', 'without --, git reads it as a branch first; a path form is too ambiguous to judge'],
  ['Remove-Item src -Force', 'without -Recurse, PowerShell refuses a non-empty folder when it cannot ask'],
];

test('the guard asks before each equivalent of a guarded command', () => {
  const missed = asks.filter(([command, reason]) => !reason.test(classify(command) ?? '')).map(([c, r]) => `${c}  (want ${r}, got ${classify(c)})`);
  assert.deepEqual(missed, [], `not caught:\n${missed.join('\n')}`);
});

test('routine commands next to the new rules still run without a prompt', () => {
  const flagged = passes.filter((c) => classify(c)).map((c) => `${c}  (${classify(c)})`);
  assert.deepEqual(flagged, [], `flagged:\n${flagged.join('\n')}`);
});

test('commands out of scope are documented and still pass, so the list stays true', () => {
  for (const [command, why] of outOfScope) {
    assert.ok(why.length > 10, command);
    assert.equal(classify(command), null, `${command} is now guarded: move it to the asks table`);
  }
});
