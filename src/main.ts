import * as core from '@actions/core'
import {context, getOctokit} from '@actions/github'

interface Output {
  tag: string
}

type Octokit = ReturnType<typeof getOctokit>

async function listAllTags(octokit: Octokit, owner: string, repo: string, page = 1): Promise<Set<string>> {
  const res = await octokit.rest.repos.listTags({owner, repo, per_page: 100, page})
  core.debug(`octokit.rest.repos.listTags: ${JSON.stringify(res)}`)
  if (res.status !== 200) {
    throw new Error(`Could not get list tags. Got ${res.status} from API`)
  }

  const tags = new Set<string>(res.data.map(t => t.name))
  if (tags.size < 100) {
    return tags
  }

  const other = await listAllTags(octokit, owner, repo, page + 1)
  return new Set<string>([...tags, ...other])
}

async function createTag(octokit: Octokit, owner: string, repo: string, tag: string, commitSha: string): Promise<void> {
  const createTagRes = await octokit.rest.git.createTag({
    owner,
    repo,
    tag,
    message: tag,
    object: commitSha,
    type: 'commit'
  })
  core.debug(`octokit.rest.repos.createTag: ${JSON.stringify(createTagRes)}`)
  if (createTagRes.status !== 201) {
    throw new Error(`Could not create tag. Received ${createTagRes.status} from API`)
  }

  const createRefRes = await octokit.rest.git.createRef({
    owner,
    repo,
    ref: `refs/tags/${tag}`,
    sha: createTagRes.data.sha
  })
  core.debug(`octokit.rest.git.createRe: ${JSON.stringify(createRefRes)}`)
  if (createRefRes.status !== 201) {
    throw new Error(`Could not create ref. Received ${createRefRes.status} from API`)
  }
}

async function run(): Promise<Output> {
  // Get and validate inputs
  const githubToken = core.getInput('github_token')
  const {GITHUB_SHA} = process.env

  if (githubToken === '') {
    throw new Error('github token cannot be empty')
  }
  if (GITHUB_SHA === '') {
    throw new Error('missing GITHUB_SHA env variable')
  }

  // Get github client
  const octokit = getOctokit(githubToken)
  const existingTags = await listAllTags(octokit, context.repo.owner, context.repo.repo)
  core.debug(`existingTags: ${[...existingTags].join(', ')}`)

  const now = new Date()
  const newTagPrefix = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`
  for (let i = 0; i < 1000; i++) {
    const newTag = `${newTagPrefix}.${i}`
    if (existingTags.has(newTag)) {
      continue
    }
    await createTag(octokit, context.repo.owner, context.repo.repo, newTag, String(GITHUB_SHA))
    core.info(`💪 Creating tag ${newTag} success`)
    return {
      tag: newTag
    }
  }
  throw new Error('could not guess the correct new tag')
}

async function main(): Promise<void> {
  try {
    const output = await run()
    core.setOutput('tag', output.tag)
  } catch (error) {
    core.setFailed((error as Error).message)
  }
}

main()
