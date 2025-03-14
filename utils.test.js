const { extractTaskIds } = require('./utils');

describe('extractTaskIds', () => {
  const taskIdFixture = '1234567890123456';
  /** @type {[string, string][]} */
  const linkFixtures = [
    ['v0', `https://app.asana.com/0/1234567890123456/${taskIdFixture}`],
    ['v1', `https://app.asana.com/1/1234567890123456/project/1234567890123456/task/${taskIdFixture}?focus=true`],
    ['v1 inbox', `https://app.asana.com/1/1234567890123456/inbox/1234567890123456/item/${taskIdFixture}/story/1234567890123456`]
  ]
  it.each(linkFixtures)('should extract task IDs from link type %s', (_, link) => {
    const body = `Implement abc
     [foo](${link})`;
    const result = extractTaskIds(body);
    expect(result).toEqual([taskIdFixture]);
  });

  it('should extract task IDs if there are multiple links', () => {
    const body = `Implement abc
    [foo](https://app.asana.com/0/1234567890123456/123)
    
    Implement xyz
    [bar]https://app.asana.com/1/1234567890123456/project/1234567890123456/task/456?focus=true)`
    const result = extractTaskIds(body);
    expect(result).toEqual(['123', '456']);
  });
});
