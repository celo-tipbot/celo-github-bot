import { Application } from 'probot' // eslint-disable-line no-unused-vars
import { Address, ContractKit, newKit } from "@celo/contractkit";

import { Command, CommandTip, CommandRegister } from './command'
import { parseGitHubComment } from './parse'
import { AccountUtils } from "@celo/utils";
import { privateKeyToAddress } from '@celo/utils/lib/address'

interface OrgConfig {
  host: string
}

async function getCeloAccountForGithubUsername(_username: string): Promise<Address | null> {
  return Promise.resolve(null)
}

async function handleCommand(_kit: ContractKit, command: Command) {
  switch (command.type) {
    case 'tip':
      handleTip(_kit, command)
      break;
    case 'register':
      handleRegister(_kit, command)
      break;
  }
}

async function handleTip(_kit: ContractKit, command: CommandTip) {
  console.log('Trying to perform tip:', command)
  const senderAddress = await getCeloAccountForGithubUsername(command.sender)
  const recipientAddress = await getCeloAccountForGithubUsername(command.receiver)

  if (senderAddress && recipientAddress) {
    console.log('I can do the transfer')
  } else {
    console.log("I can't do the transfer")
  }
}

async function handleRegister(_kit: ContractKit, command: CommandRegister) {
  console.log('Trying to perform register:', command)
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
    const key = await AccountUtils.generateKeys(process.env.MNEMONIC!)
    const address = privateKeyToAddress(key.privateKey)
    kit.addAccount(key.privateKey)
    app.log.info({
      address,
      balance: await kit.web3.eth.getBalance(address)
    })
    const result = parseGitHubComment(context.payload.comment)
    if (result.ok) {
      await handleCommand(kit, result.result)
    } else {
      console.info("Can't parse the command")
    }
  })
  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
}
