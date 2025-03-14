const { extractTaskIds } = require('./utils');

describe('extractTaskIds', () => {
  const taskIdFixture = '1234567890123456';
  /** @type {[string, string][]} */
  const linkFixtures = [
    ['v0', `https://app.asana.com/0/12356/${taskIdFixture}`],
    ['v1', `https://app.asana.com/1/123423456/project/9012356/task/${taskIdFixture}?focus=true`],
    ['v1 inbox', `https://app.asana.com/1/1237456/inbox/1246893456/item/${taskIdFixture}/story/1246835`]
  ]
  it.each(linkFixtures)('should extract task IDs from link type %s', (_, link) => {
    const body = `Implement abc
     [foo](${link})`;
    const result = extractTaskIds(body);
    expect(result).toEqual([taskIdFixture]);
  });

  it('should extract task IDs if there are multiple links', () => {
    const body = `Implement abc
    [foo](https://app.asana.com/0/4567890123456/123)
    
    Implement xyz
    [bar]https://app.asana.com/1/1237890123456/project/123690123456/task/456?focus=true)`
    const result = extractTaskIds(body);
    expect(result).toEqual(['123', '456']);
  });
});
