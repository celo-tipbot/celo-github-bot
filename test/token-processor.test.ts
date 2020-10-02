import { OkResult } from '@celo/base/lib/result'

import { TokenProcessor, Values } from '../src/token-processor'

describe('TokenProcessor', () => {
  describe('#literal()', () => {
    test('parses a literal', () => {
      const result = TokenProcessor.processString('abc')
        .literal('abc')
        .finish()

      expect(result.ok).toBeTruthy()
    })

    test(`fails when the token doesn't match`, () => {
      const result = TokenProcessor.processString('abc')
        .literal('def')
        .finish()

      expect(result.ok).toBeFalsy
    })

    test('fails when it runs out of tokens', () => {
      const result = TokenProcessor.processString('abc')
        .literal('abc')
        .literal('def')
        .finish()

      expect(result.ok).toBeFalsy()
    })
  })

  describe('#identifier()', () => {
    test('parses an identifier', () => {
      const result = TokenProcessor.processString('bob')
        .identifier('name')
        .finish()

      expect(result.ok).toBeTruthy()
      expect((result as OkResult<Values>).result).toEqual({ name: 'bob' })
    })

    test('fails when it runs out tokens', () => {
      const result = TokenProcessor.processString('bob')
        .identifier('name')
        .identifier('age')
        .finish()

      expect(result.ok).toBeFalsy()
    })
  })

  describe('#gitHubUsername()', () => {
    test('parses a GitHub username', () => {
      const result = TokenProcessor.processString('@bob')
        .gitHubUsername('user')
        .finish()

      expect(result.ok).toBeTruthy()
      expect((result as OkResult<Values>).result).toEqual({ user: 'bob' })
    })

    test('fails when not starting with @', () => {
      const result = TokenProcessor.processString('bob')
        .gitHubUsername('name')
        .finish()

      expect(result.ok).toBeFalsy()
    })

    test('fails when there are illegal characters', () => {
      const result = TokenProcessor.processString('@bob#')
        .gitHubUsername('name')
        .finish()

      expect(result.ok).toBeFalsy()
    })

    test('fails when it runs out tokens', () => {
      const result = TokenProcessor.processString('@bob')
        .gitHubUsername('name')
        .gitHubUsername('age')
        .finish()

      expect(result.ok).toBeFalsy()
    })
  })

  describe('#number()', () => {
    test('parses a number', () => {
      const result = TokenProcessor.processString('123')
        .number('value')
        .finish()

      expect(result.ok).toBeTruthy()
      expect((result as OkResult<Values>).result).toEqual({ value: '123' })
    })

    test('fails on a non-number', () => {
      const result = TokenProcessor.processString('a123')
        .number('value')
        .finish()

      expect(result.ok).toBeFalsy()
    })

    test('fails when it runs out of tokens', () => {
      const result = TokenProcessor.processString('a123')
        .number('value')
        .number('size')
        .finish()

      expect(result.ok).toBeFalsy()
    })
  })

  describe('#address()', () => {
    test('parses an address', () => {
      const result = TokenProcessor.processString('0x0000000CE100000000000000000000000000ce10')
        .address('address')
        .finish()

      expect(result.ok).toBeTruthy()
      expect((result as OkResult<Values>).result).toEqual({ address: '0x0000000CE100000000000000000000000000ce10' })
    })

    test('fails on a non-hex digit', () => {
      const result = TokenProcessor.processString('0x0000000CG100000000000000000000000000ce10')
        .address('address')
        .finish()

      expect(result.ok).toBeFalsy()
    })

    test('fails on a too short string', () => {
      const result = TokenProcessor.processString('0x0000000CE10000000000000000000000000ce10')
        .address('address')
        .finish()

      expect(result.ok).toBeFalsy()
    })

    test('fails on a too long string', () => {
      const result = TokenProcessor.processString('0x0000000CE1000000000000000000000000000ce10')
        .address('address')
        .finish()

      expect(result.ok).toBeFalsy()
    })

    test('fails when it runs out of tokens', () => {
      const result = TokenProcessor.processString('0x0000000CE100000000000000000000000000ce10')
        .address('address')
        .address('address2')
        .finish()


      expect(result.ok).toBeFalsy()
    })
  })

  describe('all together', () => {
    test('parses multiple types of tokens', () => {
      const result = TokenProcessor.processString('send bob 123')
        .literal('send')
        .identifier('name')
        .number('value')
        .finish()

      expect(result.ok).toBeTruthy()
      expect((result as OkResult<Values>).result).toEqual({
        name: 'bob',
        value: '123'
      })
    })

    test('fails when it runs out of tokens', () => {
      const result = TokenProcessor.processString('send bob 123')
        .literal('send')
        .identifier('name')
        .number('value')
        .literal('bye')
        .finish()

      expect(result.ok).toBeFalsy()
    })
  })
})
