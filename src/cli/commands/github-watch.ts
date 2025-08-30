import { Command } from 'commander'
import { createServer, Server } from 'http'
import { promises as fs } from 'fs'
import { resolve, join, basename } from 'path'
import { existsSync } from 'fs'
import * as crypto from 'crypto'
import { spawn } from 'child_process'
import { logger } from '../display'
import { ConfigManager, DocumentorConfig } from './config'
import { DocumentEngine } from './generate'

interface GitHubWebhookEvent {
  action: string;
  repository: {
    name: string;
    full_name: string;
    clone_url: string;
    default_branch: string;
  };
  ref?: string;
  commits?: Array<{
    id: string;
    message: string;
    modified: string[];
    added: string[];
    removed: string[];
  }>;
}

class GitHubWatcher {
  private config: DocumentorConfig
  private webhookServer?: Server
  private pollingInterval?: NodeJS.Timeout
  private watchedRepos: Map<string, { path: string; lastCommit: string }> = new Map()

  constructor(config: DocumentorConfig) {
    this.config = config
  }

  // Start webhook server
  async startWebhookServer(port: number = 8088): Promise<void> {
    logger.showHeader('GitHub Webhook Server', `Starting server on port ${port}`)

    this.webhookServer = createServer(async (req, res) => {
      if (req.method === 'POST' && req.url === '/webhook') {
        await this.handleWebhookRequest(req, res)
      } else {
        res.statusCode = 404
        res.end('Not Found')
      }
    })

    this.webhookServer.listen(port, () => {
      logger.success(`Webhook server listening on port ${port}`)
      logger.info('Configure your GitHub webhook to point to:')
      logger.info(`  http://your-server:${port}/webhook`)
      logger.info('')
      logger.info('Webhook events to enable:')
      logger.info('  - Push events')
      logger.info('  - Pull request events')
      logger.info('  - Release events')
    })

    // Handle server errors
    this.webhookServer.on('error', (error) => {
      logger.error('Webhook server error:', error)
    })

    // Graceful shutdown
    process.on('SIGINT', () => {
      logger.info('Shutting down webhook server...')
      this.shutdown()
    })
  }

  private async handleWebhookRequest(req: any, res: any): Promise<void> {
    try {
      let body = ''
      req.on('data', (chunk: Buffer) => {
        body += chunk.toString()
      })

      req.on('end', async () => {
        try {
          // Verify webhook signature if secret is configured
          if (this.config.github?.webhookSecret) {
            const signature = req.headers['x-hub-signature-256']
            if (!this.verifyWebhookSignature(body, signature)) {
              logger.warn('Invalid webhook signature')
              res.statusCode = 401
              res.end('Unauthorized')
              return
            }
          }

          const event = req.headers['x-github-event']
          const payload: GitHubWebhookEvent = JSON.parse(body)

          logger.info(`Received GitHub ${event} event for ${payload.repository?.full_name}`)

          // Process the event
          await this.processGitHubEvent(event, payload)

          res.statusCode = 200
          res.end('OK')

        } catch (error) {
          logger.error('Error processing webhook:', error)
          res.statusCode = 500
          res.end('Internal Server Error')
        }
      })

    } catch (error) {
      logger.error('Error handling webhook request:', error)
      res.statusCode = 500
      res.end('Internal Server Error')
    }
  }

  private verifyWebhookSignature(body: string, signature: string): boolean {
    const secret = this.config.github?.webhookSecret
    if (!secret || !signature) return false

    const expectedSignature = 'sha256=' + crypto
      .createHmac('sha256', secret)
      .update(body, 'utf8')
      .digest('hex')

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  }

  // Start polling mode
  async startPolling(repos: string[], interval: number = 300000): Promise<void> {
    logger.showHeader('GitHub Polling Mode', `Checking ${repos.length} repositories every ${interval/1000}s`)

    // Initialize watched repositories
    for (const repo of repos) {
      await this.initializeRepository(repo)
    }

    this.pollingInterval = setInterval(async () => {
      for (const repo of repos) {
        await this.checkRepositoryChanges(repo)
      }
    }, interval)

    logger.success(`Started polling ${repos.length} repositories`)

    // Graceful shutdown
    process.on('SIGINT', () => {
      logger.info('Shutting down polling...')
      this.shutdown()
    })

    // Keep the process alive
    await new Promise(() => {}) // Run indefinitely
  }

  private async initializeRepository(repoUrl: string): Promise<void> {
    try {
      const repoName = this.extractRepoName(repoUrl)
      const localPath = join(process.cwd(), 'repos', repoName)

      // Clone or pull repository
      if (!existsSync(localPath)) {
        logger.info(`Cloning repository: ${repoUrl}`)
        await this.executeGitCommand(['clone', repoUrl, localPath])
      } else {
        logger.info(`Updating repository: ${repoName}`)
        await this.executeGitCommand(['pull'], localPath)
      }

      // Get latest commit hash
      const lastCommit = await this.getLatestCommit(localPath)
      this.watchedRepos.set(repoUrl, { path: localPath, lastCommit })

      logger.debug(`Initialized repository ${repoName} at commit ${lastCommit}`)

    } catch (error) {
      logger.error(`Failed to initialize repository ${repoUrl}:`, error)
    }
  }

  private async checkRepositoryChanges(repoUrl: string): Promise<void> {
    try {
      const repoData = this.watchedRepos.get(repoUrl)
      if (!repoData) return

      const { path: localPath, lastCommit } = repoData

      // Fetch latest changes
      await this.executeGitCommand(['fetch'], localPath)
      const currentCommit = await this.getLatestCommit(localPath)

      if (currentCommit !== lastCommit) {
        logger.info(`Changes detected in ${this.extractRepoName(repoUrl)}`)
        logger.info(`  Previous: ${lastCommit}`)
        logger.info(`  Current:  ${currentCommit}`)

        // Update local repository
        await this.executeGitCommand(['pull'], localPath)

        // Trigger documentation generation
        await this.triggerDocumentationGeneration(localPath, {
          repository: {
            name: this.extractRepoName(repoUrl),
            full_name: repoUrl,
            clone_url: repoUrl,
            default_branch: 'main'
          },
          ref: 'refs/heads/main',
          action: 'synchronize'
        })

        // Update stored commit hash
        this.watchedRepos.set(repoUrl, { path: localPath, lastCommit: currentCommit })
      }

    } catch (error) {
      logger.error(`Error checking repository changes for ${repoUrl}:`, error)
    }
  }

  private async processGitHubEvent(eventType: string, payload: GitHubWebhookEvent): Promise<void> {
    const { repository } = payload

    switch (eventType) {
    case 'push':
      if (payload.ref === `refs/heads/${repository.default_branch}`) {
        logger.info(`Push to main branch detected: ${repository.full_name}`)
        await this.handlePushEvent(payload)
      }
      break

    case 'pull_request':
      if (payload.action === 'opened' || payload.action === 'synchronize') {
        logger.info(`Pull request ${payload.action}: ${repository.full_name}`)
        await this.handlePullRequestEvent(payload)
      }
      break

    case 'release':
      if (payload.action === 'published') {
        logger.info(`Release published: ${repository.full_name}`)
        await this.handleReleaseEvent(payload)
      }
      break

    default:
      logger.debug(`Unhandled event type: ${eventType}`)
    }
  }

  private async handlePushEvent(payload: GitHubWebhookEvent): Promise<void> {
    const repoPath = await this.ensureRepositoryLocal(payload.repository)
    await this.triggerDocumentationGeneration(repoPath, payload)
  }

  private async handlePullRequestEvent(payload: GitHubWebhookEvent): Promise<void> {
    logger.info('Processing pull request event...')
    // For PR events, we might want to generate documentation on a branch
    // For now, we'll skip to avoid overwhelming the system
    logger.info('Pull request documentation generation skipped')
  }

  private async handleReleaseEvent(payload: GitHubWebhookEvent): Promise<void> {
    const repoPath = await this.ensureRepositoryLocal(payload.repository)
    logger.info(`Generating documentation for release: ${payload.repository.name}`)
    await this.triggerDocumentationGeneration(repoPath, payload)
  }

  private async ensureRepositoryLocal(repository: any): Promise<string> {
    const repoName = repository.name
    const localPath = join(process.cwd(), 'repos', repoName)

    if (!existsSync(localPath)) {
      logger.info(`Cloning repository: ${repository.clone_url}`)
      await this.executeGitCommand(['clone', repository.clone_url, localPath])
    } else {
      logger.info(`Updating repository: ${repoName}`)
      await this.executeGitCommand(['pull'], localPath)
    }

    return localPath
  }

  private async triggerDocumentationGeneration(projectPath: string, context: GitHubWebhookEvent): Promise<void> {
    try {
      logger.info(`Generating documentation for: ${basename(projectPath)}`)

      // Create GitHub-specific configuration
      const githubConfig: DocumentorConfig = {
        ...this.config,
        output: {
          ...this.config.output,
          path: join(this.config.output.path, 'github-repos', basename(projectPath))
        }
      }

      // Execute documentation generation
      const engine = new DocumentEngine(githubConfig, projectPath)
      await engine.execute({
        format: githubConfig.output.format,
        noPermission: true // Auto-approve for GitHub integrations
      })

      logger.success(`Documentation generated for ${basename(projectPath)}`)

    } catch (error) {
      logger.error(`Failed to generate documentation for ${basename(projectPath)}:`, error)
    }
  }

  private async executeGitCommand(args: string[], cwd?: string): Promise<string> {
    // spawn already imported at top

    return new Promise((resolve, reject) => {
      const child = spawn('git', args, {
        cwd: cwd || process.cwd(),
        stdio: 'pipe'
      })

      let output = ''
      let error = ''

      child.stdout.on('data', (data: Buffer) => {
        output += data.toString()
      })

      child.stderr.on('data', (data: Buffer) => {
        error += data.toString()
      })

      child.on('close', (code: number) => {
        if (code === 0) {
          resolve(output.trim())
        } else {
          reject(new Error(`Git command failed: ${error}`))
        }
      })
    })
  }

  private async getLatestCommit(repoPath: string): Promise<string> {
    return await this.executeGitCommand(['rev-parse', 'HEAD'], repoPath)
  }

  private extractRepoName(repoUrl: string): string {
    return repoUrl.split('/').pop()?.replace('.git', '') || 'unknown'
  }

  shutdown(): void {
    if (this.webhookServer) {
      this.webhookServer.close()
      logger.info('Webhook server stopped')
    }

    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
      logger.info('Polling stopped')
    }

    process.exit(0)
  }
}

const githubWatchCommand = new Command('github-watch')
  .description('Monitor GitHub repositories for changes and auto-generate documentation')
  .option('--webhook', 'Run in webhook mode')
  .option('--poll', 'Run in polling mode')
  .option('--port <port>', 'Webhook server port', '8088')
  .option('--interval <seconds>', 'Polling interval in seconds', '300')
  .option('--repos <urls...>', 'Repository URLs to watch (polling mode)')
  .action(async (options) => {
    try {
      // Load configuration
      const configManager = new ConfigManager()
      const config = await configManager.loadConfig()

      // Validate GitHub configuration
      if (!config.github) {
        logger.error('GitHub configuration not found')
        logger.info('Run: documentor config init')
        process.exit(1)
      }

      const watcher = new GitHubWatcher(config)

      if (options.webhook) {
        const port = parseInt(options.port)
        if (isNaN(port) || port < 1 || port > 65535) {
          logger.error('Invalid port number')
          process.exit(1)
        }
        await watcher.startWebhookServer(port)

      } else if (options.poll) {
        const repos = options.repos
        if (!repos || repos.length === 0) {
          logger.error('No repositories specified for polling mode')
          logger.info('Usage: documentor github-watch --poll --repos <url1> <url2>')
          process.exit(1)
        }

        const interval = parseInt(options.interval) * 1000
        if (isNaN(interval) || interval < 10000) {
          logger.error('Invalid interval (minimum 10 seconds)')
          process.exit(1)
        }

        await watcher.startPolling(repos, interval)

      } else {
        logger.error('Must specify either --webhook or --poll mode')
        logger.info('Examples:')
        logger.info('  documentor github-watch --webhook --port 8088')
        logger.info('  documentor github-watch --poll --repos https://github.com/user/repo')
        process.exit(1)
      }

    } catch (error) {
      logger.error('GitHub watch command failed:', error)
      process.exit(1)
    }
  })

export { githubWatchCommand, GitHubWatcher }
