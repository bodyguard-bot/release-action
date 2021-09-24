import * as core from '@actions/core'
import {context, getOctokit} from '@actions/github'

interface Output {
  tag: string
}

type Octokit = ReturnType<typeof getOctokit>
type Context = typeof context

async function listAllTags(octokit: Octokit, ctx: Context, page = 1): Promise<Set<string>> {
  const res = await octokit.rest.repos.listTags({
    owner: ctx.repo.owner,
    repo: ctx.repo.repo,
    per_page: 100,
    page
  })

  const tags = new Set<string>(res.data.map(t => t.name))

  if (tags.size < 100) {
    return tags
  }

  const other = await listAllTags(octokit, context, page + 1)
  return new Set<string>([...tags, ...other])
}

async function run(): Promise<Output> {
  // Get and validate inputs
  const githubToken = core.getInput('github_token')
  const {GITHUB_SHA} = process.env

  if (githubToken === '') {
    throw new Error('github token cannot be empty')
  }
  if (GITHUB_SHA === '') {
    throw new Error('missing GITHUB_SHA env variables')
  }

  // Get github client
  const octokit = getOctokit(githubToken)
  const existingTags = await listAllTags(octokit, context)

  const date = new Date()
  const newTagPrefix = `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`

  for (let i = 0; i < 1000; i++) {
    const newTag = `${newTagPrefix}.${i}`
    if (existingTags.has(newTag)) {
      continue
    }

    octokit.rest.git.createTag({
      owner: context.repo.owner,
      repo: context.repo.repo,
      tag: newTag,
      message: newTag,
      object: String(GITHUB_SHA),
      type: 'commit'
    })

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
    core.setFailed(error.message)
  }
}

main()
