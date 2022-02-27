import { expect } from 'chai'
import 'isomorphic-fetch'

import { getApiRoot } from '../../src/utils/client.js'

describe('commercetools client', () => {
  it('should return the same apiRoot for different calls', async () => {
    expect(getApiRoot()).to.equal(getApiRoot())
  })
})
