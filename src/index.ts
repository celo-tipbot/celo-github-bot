import { Application } from 'probot' // eslint-disable-line no-unused-vars

export const app = (app: Application) => {
  app.on('issues.opened', async (context) => {
    const issueComment = context.issue({ body: 'Thanks for opening this issue!' })
    await context.github.issues.createComment(issueComment)
  })

  app.on('issue_comment', async (context) => {
    console.log(context.payload.comment)

  })
  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
}
