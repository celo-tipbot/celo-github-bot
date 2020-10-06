import { Application } from "probot"; // eslint-disable-line no-unused-vars
import { Address, ContractKit, IdentityMetadataWrapper, newKit } from "@celo/contractkit";
import { verifyGithubClaim } from "@celo/contractkit/lib/identity/claims/github";

import { Command, CommandTip, CommandRegister } from "./command";
import { parseGitHubComment } from "./parse";
import { AccountUtils } from "@celo/utils";
import { privateKeyToAddress } from "@celo/utils/lib/address";
import * as firebase from "firebase";
import { Err, Ok, Result } from "@celo/base/lib/result";
import { isOfType } from "@celo/contractkit/lib/identity/claims/claim";
import { ClaimTypes } from "@celo/contractkit/lib/identity";

interface OrgConfig {
  host: string;
}

interface Context {
  kit: ContractKit;
  database: firebase.firestore.Firestore;
  reply: (text: string) => Promise<any>;
  commentId: string;
  getClaimedAccounts: (username: string) => Promise<Address[]>;
}

async function getCeloAccountForGithubUsername(
  context: Context,
  username: string
): Promise<Result<Address, Error>> {
  const accounts = await context.getClaimedAccounts(username);
  const accountsContract = await context.kit.contracts.getAccounts()
  const verifiedAccounts = await Promise.all(accounts.map(async account => {
    const metadataURL = await accountsContract.getMetadataURL(account)
    if (!metadataURL) return null
    const metadata = await IdentityMetadataWrapper.fetchFromURL(context.kit, metadataURL)
    const githubClaims = metadata.claims.filter(isOfType(ClaimTypes.GITHUB))
    const validGithubClaims = await Promise.all(githubClaims.map(async claim => {
      const validationError = await verifyGithubClaim(context.kit, claim.username, account)
      if (validationError){
        console.error('Error validating claim: ', validationError)
      }
      if (!validationError && claim.username === username) {
        return account
      }
      return null
    }))

    if (validGithubClaims.filter(x => x).length > 0) {
      return validGithubClaims.filter(x => x)[0]
    }
    return null
  }))

  const filteredVerifiedAccounts = verifiedAccounts.filter(x => x)
  if (filteredVerifiedAccounts.length == 0) {
    return Err(new Error("No accounts found for identifier " + username));
  }
  // @ts-ignore we filtered for nulls
  return Ok(filteredVerifiedAccounts[0]);
}

async function handleCommand(context: Context, command: Command) {
  switch (command.type) {
    case "tip":
      handleTip(context, command);
      break;
    case "register":
      handleRegister(context, command);
      break;
    case 'redeem':
      handleRedeem(context, command.sender)
      break
  }
}

async function transfer(
  context: Context,
  sender: Address,
  receiver: Address,
  value: string
) {
  const stableToken = await context.kit.contracts.getStableToken();
  const approval = await stableToken.allowance(
    sender,
    context.kit.defaultAccount!
  );
  const transferValue = context.kit.web3.utils.toWei(value, "ether");
  if (approval.gte(transferValue)) {
    const receipt = await stableToken
      .transferFrom(sender, receiver, transferValue)
      .sendAndWaitForReceipt();

    await context.reply(
      `Transaction succeeded: https://alfajores-blockscout.celo-testnet.org/tx/${receipt.transactionHash}`
    );
    return;
  }

  await context.reply(
    `Approval for the bot was only ${context.kit.web3.utils.fromWei(
      approval.toString()
    )}, but wanted to transfer ${value}`
  );
}

async function escrow(
  context: Context,
  command: CommandTip,
  senderAddress: Address
) {
  const stableToken = await context.kit.contracts.getStableToken();
  const approval = await stableToken.allowance(
    senderAddress,
    context.kit.defaultAccount!
  );
  const transferValue = context.kit.web3.utils.toWei(command.value, "ether");

  if (approval.gte(transferValue)) {
    const receipt = await stableToken
      .transferFrom(senderAddress, context.kit.defaultAccount!, transferValue)
      .sendAndWaitForReceipt();

    const escrows = context.database.collection("escrows");
    await (await escrows.doc(context.commentId)).set({
      commentId: context.commentId,
      sender: command.sender,
      receiver: command.receiver,
      value: command.value,
    });
    await context.reply(
      `@${
        command.receiver
      } has not registered a Celo account. Funds are being hold in escrow: ${getBlockscoutURL(
        receipt.transactionHash
      )}. Respond with "@celo-tipbot REDEEM" after claiming your github in metadata.`
    );
    return;
  }

  await context.reply(
    `Approval for the bot was only ${context.kit.web3.utils.fromWei(
      approval.toString()
    )}, but wanted to transfer ${command.value}`
  );
}

async function handleTip(context: Context, command: CommandTip) {
  console.log("Trying to perform tip:", command);
  const senderAddress = await getCeloAccountForGithubUsername(
    context,
    command.sender
  );
  const recipientAddress = await getCeloAccountForGithubUsername(
    context,
    command.receiver
  );

  if (senderAddress.ok && recipientAddress.ok) {
    await transfer(
      context,
      senderAddress.result,
      recipientAddress.result,
      command.value
    );
  } else if (senderAddress.ok) {
    await escrow(context, command, senderAddress.result);
  } else {
    console.log("I can't do the transfer");
  }
}

function getBlockscoutURL(txHash: string) {
  return `https://alfajores-blockscout.celo-testnet.org/tx/${txHash}`;
}

export async function getIdentifiersForAccount(
  _account: Address
): Promise<string[]> {
  return [];
}

async function handleRegister(context: Context, command: CommandRegister) {
  console.log("Trying to perform register:", command);

  // TODO: Only add claims as registered in metadata
  await context.database
    .collection("identifierAccounts")
    .doc(`${command.address}:github-${command.sender}`)
    .set({
      account: command.address,
      identifier: `github://${command.sender}`,
    });
}

async function handleRedeem(context: Context, username: string) {
  // ToDO: Actually authenticate the user here
  const address = await getCeloAccountForGithubUsername(context, username);

  if (!address.ok) {
    await context.reply(`Could not authenticate Celo account for @${username}`)
    return;
  }

  const stableToken = await context.kit.contracts.getStableToken();
  const escrows = context.database.collection("escrows");
  const escrowsForUser = await escrows.where("receiver", "==", username).get();

  if (escrowsForUser.empty) {
    await context.reply(`Error: No escrows to redeem for ${username}`)
    return
  }

  // TODO: Make this atomic
  await Promise.all(
    escrowsForUser.docs.map(async (escrow) => {
      const receipt = await stableToken
        .transfer(
          address.result,
          context.kit.web3.utils.toWei(escrow.data().value).toString()
        )
        .sendAndWaitForReceipt();

      context.reply(
        `Redeemed escrow from comment (${escrow.data().commentId}) for $${
          escrow.data().value
        } from @${escrow.data().sender}: ${getBlockscoutURL(
          receipt.transactionHash
        )}`
      );

      await escrow.ref.delete();
    })
  );
}

export const app = (app: Application) => {
  const firebaseConfig = {
    apiKey: process.env.FIREBASE_APIKEY,
    authDomain: process.env.FIREBASE_AUTHDOMAIN,
    databaseURL: process.env.FIREBASE_DATABASEURL,
    projectId: "celo-github-bot",
    storageBucket: process.env.FIREBASE_STORAGEBUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGINGSENDERID,
    appId: process.env.FIREBASE_APPID,
    measurementId: process.env.FIREBASE_MEASUREMENTID,
  };
  // Initialize Firebase
  firebase.initializeApp(firebaseConfig);

  const database = firebase.firestore();
  app.on("issues.opened", async (context) => {
    const issueComment = context.issue({
      body: "Thanks for opening this issue!",
    });
    await context.github.issues.createComment(issueComment);
  });

  app.on("issue_comment", async (context) => {
    // @ts-ignore
    const config: OrgConfig = await context.config("celo-tipbot.yml");
    const kit = newKit(config.host);
    const key = await AccountUtils.generateKeys(process.env.MNEMONIC!);
    const address = privateKeyToAddress(key.privateKey);
    kit.addAccount(key.privateKey);
    kit.defaultAccount = address;

    const result = parseGitHubComment(context.payload.comment);
    if (result.ok) {
      await handleCommand(
        {
          kit,
          database,
          reply: (body) =>
            context.github.issues.createComment(context.issue({ body })),
          commentId: context.id,
          getClaimedAccounts: async (username) => {
            try {
              const query = `
              query($username: String!) {
                repository(owner: $username, name: "celo-metadata") {
                  object(expression: "main:") {
                    ... on Tree {
                      entries {
                        name
                      }
                    }
                  }
                }
              }
            `;
            const resp: any = await context.github.graphql(query, { username });

            return resp.repository.object.entries
              .map((entry: any) =>
                entry.name.match(/verify-(0x[0-9A-Za-z]{40})\.json/)
              )
              .filter((x: any) => x)
              .map((x: any) => x[1]);
            } catch {
              return []
            }

          },
        },
        result.result
      );
    } else {
      console.info("Can't parse the command", result.error);
    }
  });
  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
};
