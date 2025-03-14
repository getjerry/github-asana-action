const core = require('@actions/core');
const github = require('@actions/github');
const Asana = require('asana');
const { extractTaskIds } = require("./utils");

async function findComment(client, taskId, commentId) {
  let stories;
  try {
    stories = await client.stories.getStoriesForTask(taskId);
  } catch (error) {
    throw error;
  }

  return stories.data.find(story => story.text.indexOf(commentId) !== -1);
}

async function addComment(client, taskId, commentId, text, isPinned) {
  if (commentId) {
    text += '\n' + commentId;
  }
  try {
    console.log('adding comment to task id ' + taskId, JSON.stringify({
      data: {
        html_text: text,
        is_pinned: isPinned,
      }
    }, null, 2));
    const story = await client.stories.createStoryForTask({
      data: {
        html_text: `<body>${text}</body>`,
        is_pinned: isPinned,
      }
    }, taskId);
    console.log('added comment', JSON.stringify(story, null, 2));
    return story.data;
  } catch (error) {
    console.error('rejecting promise', error);
  }
}

async function buildClient(asanaPAT) {
  let client = Asana.ApiClient.instance;
  let token = client.authentications['token'];
  token.accessToken = asanaPAT;

  return {
    tasks: new Asana.TasksApi(),
    stories: new Asana.StoriesApi(),
  };
}

async function action() {
  const
    ASANA_PAT = core.getInput('asana-pat', { required: true }),
    ACTION = core.getInput('action', { required: true }),
    TRIGGER_PHRASE = core.getInput('trigger-phrase') || '',
    PULL_REQUEST = github.context.payload.pull_request
  ;

  console.log('pull_request', PULL_REQUEST);

  const client = await buildClient(ASANA_PAT);
  if (client === null) {
    throw new Error('client authorization failed');
  }

  console.info('looking in body', PULL_REQUEST.body);
  const foundAsanaTasks = extractTaskIds(PULL_REQUEST.body, TRIGGER_PHRASE);
  console.info(`found ${foundAsanaTasks.length} taskIds:`, foundAsanaTasks.join(','));

  console.info('calling', ACTION);
  switch (ACTION) {
    case 'add-comment': {
      const commentId = core.getInput('comment-id'),
        htmlText = core.getInput('text', { required: true }),
        isPinned = core.getInput('is-pinned') === 'true';
      const comments = [];
      for (const taskId of foundAsanaTasks) {
        if (commentId) {
          const comment = await findComment(client, taskId, commentId);
          if (comment) {
            console.info('found existing comment', comment.gid);
            continue;
          }
        }
        const comment = await addComment(client, taskId, commentId, htmlText, isPinned);
        comments.push(comment);
      }
      return comments;
    }
    case 'remove-comment': {
      const commentId = core.getInput('comment-id', { required: true });
      const removedCommentIds = [];
      for (const taskId of foundAsanaTasks) {
        const comment = await findComment(client, taskId, commentId);
        if (comment) {
          console.info('removing comment', comment.gid);
          try {
            await client.stories.deleteStory(comment.gid);
          } catch (error) {
            console.error('rejecting promise', error);
          }
          removedCommentIds.push(comment.gid);
        }
      }
      return removedCommentIds;
    }
    default:
      core.setFailed('unexpected action ${ACTION}');
  }
}

module.exports = {
  action,
  default: action,
  buildClient: buildClient
};
