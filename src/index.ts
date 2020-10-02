import { Application } from 'probot' // eslint-disable-line no-unused-vars
import { Address, ContractKit, newKit } from "@celo/contractkit";

import { Command, CommandTip, CommandRegister } from './command'
import { parseGitHubComment } from './parse'
import { AccountUtils } from "@celo/utils";
import { privateKeyToAddress } from '@celo/utils/lib/address'
import * as firebase from "firebase";
import { Err, Ok, Result } from '@celo/base/lib/result';

interface OrgConfig {
  host: string
}

interface Context {
  kit: ContractKit
  database: firebase.firestore.Firestore
}

async function getCeloAccountForGithubUsername(context: Context, username: string): Promise<Result<Address, Error>> {
  const accounts = await context.database.collection('identifierAccounts').where("identifier", "==", `github://${username}`).get()

  if (accounts.empty) {
    return Err(new Error('No accounts found for identifier ' + username))
  }

  return Ok(accounts.docs[0].data().account)
}

async function handleCommand(context: Context, command: Command) {
  switch (command.type) {
    case 'tip':
      handleTip(context, command)
      break;
    case 'register':
      handleRegister(context, command)
      break;
  }
}

async function handleTip(context: Context, command: CommandTip) {
  console.log('Trying to perform tip:', command)
  const senderAddress = await getCeloAccountForGithubUsername(context, command.sender)
  const recipientAddress = await getCeloAccountForGithubUsername(context, command.receiver)

  if (senderAddress.ok && recipientAddress.ok) {
    const stableToken = await context.kit.contracts.getStableToken()
    const approval = await stableToken.allowance(senderAddress.result, context.kit.defaultAccount!)
    const transferValue = context.kit.web3.utils.toWei(command.value, 'ether')
    console.log('Approval is ', approval)
    if (approval.gte(transferValue)) {
      await stableToken.transferFrom(senderAddress.result, recipientAddress.result, transferValue).sendAndWaitForReceipt()
      console.log('transfered')
    }
  } else {
    console.log("I can't do the transfer")
  }
}

export async function getIdentifiersForAccount(_account: Address): Promise<string[]> {
  return []
}

async function handleRegister(context: Context, command: CommandRegister) {
  console.log('Trying to perform register:', command)

  // TODO: Only add claims as registered in metadata
  await context.database.collection('identifierAccounts').doc(`${command.address}:github-${command.sender}`).set({ account: command.address, identifier: `github://${command.sender}`})

}

export const app = (app: Application) => {

  const firebaseConfig = {
    apiKey: process.env.FIREBASE_APIKEY,
    authDomain: process.env.FIREBASE_AUTHDOMAIN,
    databaseURL: process.env.FIREBASE_DATABASEURL,
    projectId: process.env.FIREBASE_PROJECTID,
    storageBucket: process.env.FIREBASE_STORAGEBUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGINGSENDERID,
    appId: process.env.FIREBASE_APPID,
    measurementId: process.env.FIREBASE_MEASUREMENTID
  };
  // Initialize Firebase
  firebase.initializeApp(firebaseConfig);

  const database = firebase.firestore()
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
    kit.defaultAccount = address
    app.log.info({
      address,
      balance: await kit.web3.eth.getBalance(address)
    })
    const result = parseGitHubComment(context.payload.comment)
    if (result.ok) {
      await handleCommand({ kit, database }, result.result)
    } else {
      console.info("Can't parse the command", result.error)
    }
  })
  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
}
