const core = require('@actions/core');
const github = require('@actions/github');
const Asana = require('asana');
const { extractTaskIds } = require("./utils");

async function moveSection(client, taskId, targets) {
  const task = (await client.tasks.getTask(taskId)).data;

  for (const target of targets) {
    const targetProject = task.projects.find(project => project.name === target.project);
    if (!targetProject) {
      core.info(`[Skip] This task does not exist in "${target.project}" project`);
      continue;
    }
    const targetSections = (await client.sections.getSectionsForProject(targetProject.gid)).data

    const targetSection = targetSections.find(section => section.name === target.section);
    if (targetSection) {
      core.info(`Moving task ${taskId} to ${target.section}`, targetSection)
      await client.sections.addTaskForSection(targetSection.gid, {
        body:{
          data:{
            task: taskId
          }
        }
      });
      core.info(`Moved to: ${target.project}/${target.section}`);
    } else {
      core.error(`Asana section ${target.section} not found.`);
    }
  }
}

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

function buildClient(asanaPAT) {
  let client = Asana.ApiClient.instance;
  let token = client.authentications['token'];
  token.accessToken = asanaPAT;

  return {
    tasks: new Asana.TasksApi(client),
    stories: new Asana.StoriesApi(client),
    sections: new Asana.SectionsApi(client),
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

  const client = buildClient(ASANA_PAT);

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
    case 'complete-task': {
      const isComplete = core.getInput('is-complete') === 'true';
      const taskIds = [];
      for(const taskId of foundAsanaTasks) {
        console.info('marking task', taskId, isComplete ? 'complete' : 'incomplete');
        try {
          await client.tasks.updateTask({ data: { completed: isComplete } }, taskId);
        } catch (error) {
          console.error('rejecting promise', error);
        }
        taskIds.push(taskId);
      }
      return taskIds;
    }
    case 'move-section': {
      const targetJSON = core.getInput('targets', {required: true});
      const targets = JSON.parse(targetJSON);
      const movedTasks = [];
      for(const taskId of foundAsanaTasks) {
        await moveSection(client, taskId, targets);
        movedTasks.push(taskId);
      }
      return movedTasks;
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
