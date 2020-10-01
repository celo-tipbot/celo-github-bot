import { Application } from 'probot' // eslint-disable-line no-unused-vars
import { Address, ContractKit, newKit } from "@celo/contractkit";
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

async function getCeloAccountForGithubUsername(username: string): Address | null {
  return null
}

async function handleCommand(kit: ContractKit, command: Command) {
  const senderAddress = await getCeloAccountForGithubUsername(command.sender)
  const recipientAddress = await getCeloAccountForGithubUsername(command.receiver)

  if (senderAddress && recipientAddress) {
    console.log('I can do the transfer')
  } else {
    console.log("I can't do the transfer")
  }
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
    if (command) {
      await handleCommand(kit, command)
    } else {
      console.info("Can't parse the command")
    }

  })
  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
}
