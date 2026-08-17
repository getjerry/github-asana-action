const action = require('./action');
const core = require('@actions/core');
const github = require('@actions/github');

describe('asana github actions', () => {
  let inputs = {};
  let defaultBody;
  let client;
  let task;

  const asanaPAT = process.env['ASANA_PAT'];
  if(!asanaPAT) {
    throw new Error('need ASANA_PAT in the test env');
  }
  const projectId = process.env['ASANA_PROJECT_ID'];
  if(!projectId) {
    throw new Error('need ASANA_PROJECT_ID in the test env');
  }

  const commentId = Date.now().toString();

  beforeAll(async () => {
      // Mock getInput
      jest.spyOn(core, 'getInput').mockImplementation((name, options) => {
        if(inputs[name] === undefined && options && options.required){
          throw new Error(name + " was not expected to be empty");
        }
        return inputs[name]
      })

      // Mock error/warning/info/debug
      jest.spyOn(core, 'error').mockImplementation(jest.fn())
      jest.spyOn(core, 'warning').mockImplementation(jest.fn())
      jest.spyOn(core, 'info').mockImplementation(jest.fn())
      jest.spyOn(core, 'debug').mockImplementation(jest.fn())

      github.context.ref = 'refs/heads/some-ref'
      github.context.sha = '1234567890123456789012345678901234567890'

      process.env['GITHUB_REPOSITORY'] = 'a-cool-owner/a-cool-repo'

      client = await action.buildClient(asanaPAT);
      if(client === null){
        throw new Error('client authorization failed');
      }

      task = await client.tasks.createTask({
        data: {
          'name': 'my fantastic task',
          'notes': 'generated automatically by the test suite',
          'projects': [projectId]
        }
      });

      console.log('created task', JSON.stringify(task, null, 2));

      defaultBody = `Implement https://app.asana.com/0/${projectId}/${task.data.gid} in record time`;
    })

    afterAll(async () => {
      if (task) {
        await client.tasks.deleteTask(task.data.gid);
      }
    })

    beforeEach(() => {
      // Reset inputs
      inputs = {}
      github.context.payload = {};
    })

    test('creating a comment', async () => {
      inputs = {
        'asana-pat': asanaPAT,
        'action': 'add-comment',
        'comment-id': commentId,
        'text': 'rad stuff',
        'is-pinned': 'true'
      }
      // Mock github context
      github.context.payload = {
        pull_request: {
          'body': defaultBody
        }
      };

      await expect(action.action()).resolves.toHaveLength(1);

      // rerunning with the same comment-Id should not create a new comment
      await expect(action.action()).resolves.toHaveLength(0);
    });

    test('upserting an existing comment updates it in place', async () => {
      inputs = {
        'asana-pat': asanaPAT,
        'action': 'upsert-comment',
        // note: relies on the comment created in `creating a comment` test
        'comment-id': commentId,
        'text': 'rad stuff, edited',
        'is-pinned': 'true'
      }
      github.context.payload = {
        pull_request: {
          'body': defaultBody
        }
      };

      // updates the existing comment in place instead of adding a new one
      await expect(action.action()).resolves.toHaveLength(1);

      const comments = (await client.stories.getStoriesForTask(task.data.gid)).data
        .filter(story => story.type === 'comment' && story.text?.indexOf(commentId) !== -1);
      expect(comments).toHaveLength(1);
      expect(comments[0].text).toContain('rad stuff, edited');
    });

    test('upserting a comment that does not exist yet', async () => {
      const upsertCommentId = `${commentId}-upsert`;
      inputs = {
        'asana-pat': asanaPAT,
        'action': 'upsert-comment',
        'comment-id': upsertCommentId,
        'text': 'created via upsert-comment',
      }
      github.context.payload = {
        pull_request: {
          'body': defaultBody
        }
      };

      // no comment with this id exists, so it falls back to adding one
      await expect(action.action()).resolves.toHaveLength(1);

      inputs.action = 'remove-comment';
      await expect(action.action()).resolves.toHaveLength(1);
    });

    test('removing a comment', async () => {
      inputs = {
        'asana-pat': asanaPAT,
        'action': 'remove-comment',
        // note: relies on the task being created in `creating a comment` test
        'comment-id': commentId,
      }
      github.context.payload = {
        pull_request: {
          'body': defaultBody
        }
      };

      await expect(action.action()).resolves.toHaveLength(1);
    });
});
