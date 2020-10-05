import { EventPayloads } from "@octokit/webhooks/dist-types/generated/event-payloads";
import { Result, Err, Ok } from '@celo/base/lib/result'

import { Command } from './command'
import { TokenProcessor } from './token-processor'

function parseTip(sender: string, processor: TokenProcessor): Result<Command, Error> {
  const result = processor
    .gitHubUsername('receiver')
    .number('value')
    .finish()

  if (result.ok) {
    return Ok({
      type: 'tip',
      sender,
      receiver: result.result.receiver,
      value: result.result.value
    })
  } else {
    return result
  }
}

function parseRegister(sender: string, processor: TokenProcessor): Result<Command, Error> {
  const result = processor
    .address('address')
    .finish()

  if (result.ok) {
    return Ok({
      type: 'register',
      sender,
      address: result.result.address
    })
  } else {
    return result
  }
}

function parseRedeem(sender: string, processor: TokenProcessor): Result<Command, Error> {
  const result = processor.finish()
  if (result.ok) {
    return Ok({
      type: 'redeem',
      sender
    })
  } else {
    return result
  }
}

export function parseGitHubComment(comment: EventPayloads.WebhookPayloadIssueCommentComment): Result<Command, Error> {
  const sender = comment.user.login

  const processor = TokenProcessor.processString(comment.body)
    .literal('@celo-tipbot')
    .identifier('command')

  switch (processor.values.command) {
    case 'TIP':
      return parseTip(sender, processor)
      break;
    case 'REGISTER':
      return parseRegister(sender, processor)
      break;
    case 'REDEEM':
      return parseRedeem(sender, processor)
    default:
      return Err(new Error ('Unknown tipbot command'))
  }
}
