import { Application } from 'probot' // eslint-disable-line no-unused-vars
import { newKit } from "@celo/contractkit";
import { WebhookEvent } from "@octokit/webhooks/dist-types/types";
import { EventPayloads } from "@octokit/webhooks/dist-types/generated/event-payloads";
interface OrgConfig {
  host: string
}

interface Command {
  sender: string
  receiver: string
  value: number
}

function parseCommand(_context: WebhookEvent<EventPayloads.WebhookPayloadIssueComment>): Command | null  {
  return null
}

export const app = (app: Application) => {
  app.on('issues.opened', async (context) => {
    const issueComment = context.issue({ body: 'Thanks for opening this issue!' })
    await context.github.issues.createComment(issueComment)
  })

  app.on('issue_comment', async (context) => {
    // @ts-ignore
    const config: OrgConfig = await context.config("celo-tipbot.yml")
    const kit = newKit(config.host)
    const command = parseCommand(context)
    console.log((await kit.web3.eth.getBlock('latest')).number)
    console.log('Parsed Command', command)

  })
  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
}
