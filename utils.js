const core = require("@actions/core");

/**
 *
 * @param {string} body
 * @param {string} [triggerPhase]
 * @returns {string[]}
 */
function extractTaskIds(body, triggerPhase) {
  triggerPhase = triggerPhase || ''
  const regexes = [
    // https://app.asana.com/0/1234567890123456/1234567890123456
    new RegExp(`${triggerPhase}(?:\s*)https:\\/\\/app.asana.com\\/0\\/\\d+\\/(?<task>\\d+)`, 'g'),
    // https://app.asana.com/1/1234567890123456/project/1234567890123456/task/1234567890123456?focus=true
    new RegExp(`${triggerPhase}(?:\s*)https:\\/\\/app.asana.com\\/1\\/.+\\/task\\/(?<task>\\d+)`, 'g'),
    // https://app.asana.com/1/1234567890123456/inbox/1234567890123456/item/1234567890123456/story/1234567890123456
    new RegExp(`${triggerPhase}(?:\s*)https:\\/\\/app.asana.com\\/1\\/.+\\/item\\/(?<task>\\d+)`, 'g'),
  ]

  let parseAsanaURL;
  const foundAsanaTasks = [];
  for (const regex of regexes) {
    while ((parseAsanaURL = regex.exec(body)) !== null) {
      const taskId = parseAsanaURL.groups.task;
      if (!taskId) {
        core.error(`Invalid Asana task URL after the trigger phrase ${triggerPhase}`);
        continue;
      }
      foundAsanaTasks.push(taskId);
    }
  }

  return foundAsanaTasks;
}

module.exports = {
  extractTaskIds,
}