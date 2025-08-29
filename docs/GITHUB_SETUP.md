# GitHub Integration Setup Guide

## 🔐 Authentication Setup

DocuMentor requires a GitHub Personal Access Token to monitor repositories and analyze commits.

### Step 1: Generate GitHub Personal Access Token

1. Go to GitHub Settings: https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Give your token a descriptive name: `DocuMentor Access`
4. Set expiration (recommend 90 days for security)
5. Select the following scopes:
   - ✅ **repo** (Full control of private repositories)
     - This includes: repo:status, repo_deployment, public_repo, repo:invite
   - ✅ **read:user** (Read user profile data)
   - ✅ **read:project** (Read project boards)

6. Click **"Generate token"**
7. **IMPORTANT**: Copy the token immediately! You won't be able to see it again.
   - Token format: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### Step 2: Configure DocuMentor

1. Open your config file:
```bash
documentor config --edit
# Or manually edit:
nano ~/.documentor/config.json
```

2. Update the GitHub section:
```json
{
  "github": {
    "enabled": true,
    "accessToken": "ghp_YOUR_ACTUAL_TOKEN_HERE",
    "username": "your-github-username",
    "repositories": [
      "owner/repo",
      "myusername/myproject"
    ],
    "pollInterval": 5,
    "documentOnCommit": true,
    "documentOnPR": true,
    "scopes": ["repo", "read:user", "read:project"]
  }
}
```

3. Validate your configuration:
```bash
documentor config --validate
```

### Step 3: Add Repositories to Monitor

```bash
# Add a repository
documentor monitor --add facebook/react

# Add your own repository
documentor monitor --add yourusername/yourrepo

# List monitored repositories
documentor monitor --list
```

### Step 4: Start Monitoring

```bash
# Start monitoring with default interval (5 minutes)
documentor monitor --start

# Start with custom interval (10 minutes)
documentor monitor --start --interval 10
```

## 🔒 Security Best Practices

### Token Security

1. **Never commit your token** to version control
2. **Use environment variables** for extra security:
   ```bash
   export GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxx"
   ```
   Then reference in scripts, not in config

3. **Rotate tokens regularly** (every 90 days)
4. **Use fine-grained tokens** for specific repositories if possible

### Fine-Grained Personal Access Tokens (Beta)

For enhanced security, use fine-grained tokens:

1. Go to https://github.com/settings/tokens?type=beta
2. Click **"Generate new token"**
3. Set expiration and repository access
4. Select permissions:
   - **Contents**: Read
   - **Metadata**: Read  
   - **Pull requests**: Read
   - **Actions**: Read (optional)
   - **Issues**: Read (optional)

## 📊 GitHub API Rate Limits

- **Authenticated requests**: 5,000 per hour
- **Unauthenticated requests**: 60 per hour
- DocuMentor's default polling (5 min) = ~12 requests/hour per repo

### Monitoring Rate Limits

Check your current rate limit:
```bash
curl -H "Authorization: token YOUR_TOKEN" \
  https://api.github.com/rate_limit
```

## 🚀 Advanced Configuration

### Monitor Multiple Organizations

```json
{
  "github": {
    "repositories": [
      "facebook/react",
      "vercel/next.js",
      "microsoft/vscode",
      "myorg/*"  // Monitor all repos in an org (requires additional permissions)
    ]
  }
}
```

### Webhook Integration (Optional)

For real-time updates instead of polling:

```json
{
  "github": {
    "webhookUrl": "https://your-server.com/webhook",
    "webhookSecret": "your-webhook-secret"
  }
}
```

## 🔧 Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| "Bad credentials" | Token is invalid or expired. Generate a new one. |
| "Not Found" | Repository doesn't exist or token lacks access |
| "API rate limit exceeded" | Increase poll interval or wait for reset |
| "Requires authentication" | Token not properly configured in config.json |

### Test Your Token

```bash
# Test token validity
curl -H "Authorization: token ghp_YOUR_TOKEN" \
  https://api.github.com/user

# Test repository access
curl -H "Authorization: token ghp_YOUR_TOKEN" \
  https://api.github.com/repos/owner/repo
```

### Debug Mode

Enable verbose logging to troubleshoot:
```json
{
  "monitoring": {
    "verboseLogging": true,
    "logFile": "~/.documentor/github-monitor.log"
  }
}
```

## 📝 Output Structure

GitHub monitoring creates documentation in:
```
~/github/obsidian_vault/docs/
├── commits/
│   ├── owner_repo/
│   │   ├── 2024-01-01_abc1234_fix-bug.md
│   │   └── 2024-01-02_def5678_add-feature.md
│   └── daily/
│       ├── 2024-01-01.md
│       └── 2024-01-02.md
```

## 🔗 Useful Links

- [GitHub Personal Access Tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)
- [GitHub API Documentation](https://docs.github.com/en/rest)
- [API Rate Limiting](https://docs.github.com/en/rest/rate-limit)
- [Webhook Events](https://docs.github.com/en/webhooks-and-events/webhooks/webhook-events-and-payloads)

---

*For more help, run `documentor monitor --help`*