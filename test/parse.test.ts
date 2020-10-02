import { parseGitHubComment } from '../src/parse'

describe('Command parser', () => {
  test('parses a correct TIP command', () => {
    const comment = {
      user: {
        login: 'Alice123'
      },
      body: '@celo-tipbot TIP @Bob456 10'
    }

    // @ts-ignore
    const command = parseGitHubComment(comment)
    expect(command).toEqual({
      ok: true,
      result: {
        type: 'tip',
        sender: 'Alice123',
        receiver: 'Bob456',
        value: '10'
      }
    })
  })

  test('Fails on a TIP without username', () => {
    const comment = {
      user: {
        login: 'Alice123'
      },
      body: '@celo-tipbot TIP 10'
    }

    // @ts-ignore
    const command = parseGitHubComment(comment)
    expect(command.ok).toBeFalsy()
  })

  test('Fails on a TIP without value', () => {
    const comment = {
      user: {
        login: 'Alice123'
      },
      body: '@celo-tipbot TIP @Bob456'
    }

    // @ts-ignore
    const command = parseGitHubComment(comment)
    expect(command.ok).toBeFalsy()
  })

  test('parses a correct REGISTER command', () => {
    const comment = {
      user: {
        login: 'Alice123'
      },
      body: '@celo-tipbot REGISTER 0x5234ae9f990acc920b9209867189eaaee78baf78'
    }

    // @ts-ignore
    const command = parseGitHubComment(comment)
    expect(command).toEqual({
      ok: true,
      result: {
        type: 'register',
        sender: 'Alice123',
        address: '0x5234ae9f990acc920b9209867189eaaee78baf78'
      }
    })
  })

  test('fails on a REGISTER with malformed address', () => {
    const comment = {
      user: {
        login: 'Alice123'
      },
      body: '@celo-tipbot REGISTER 0x5234ae9f990cc920b9209867189eaaee78baf78'
    }

    // @ts-ignore
    const command = parseGitHubComment(comment)
    expect(command.ok).toBeFalsy()
  })

  test('Fails on an unknown command', () => {
    const comment = {
      user: {
        login: 'Alice123'
      },
      body: '@celo-tipbot DOTHINGS 123'
    }

    // @ts-ignore
    const command = parseGitHubComment(comment)
    expect(command.ok).toBeFalsy()
  })
})
