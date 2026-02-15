# Floww Providers Reference

All providers are imported from `"floww"`. AI utilities from `"floww/ai"`.

---

## Builtin

```typescript
import { Builtin } from "floww";
const builtin = new Builtin();
```

### Triggers

**onCron** -- Run on a schedule.

```typescript
builtin.triggers.onCron({
  expression: "*/5 * * * *",   // Standard cron (5 fields) or with seconds (6 fields)
  handler: (ctx, event) => {
    console.log(event.scheduledTime);
  },
});
```

**onWebhook** -- Receive HTTP requests. Generic type for body.

```typescript
builtin.triggers.onWebhook<{ message: string }>({
  path: "/my-endpoint",         // Optional, defaults to "/"
  method: "POST",               // Optional: POST | GET | PUT | DELETE
  handler: (ctx, event) => {
    console.log(event.body.message);
    console.log(event.headers);
  },
});
```

**onManual** -- Trigger manually from the dashboard.

```typescript
builtin.triggers.onManual({
  name: "run-report",
  description: "Generate the weekly report",
  inputSchema: {
    type: "object",
    properties: {
      week: { type: "number" },
    },
  },
  handler: (ctx, event) => {
    console.log(event.input_data);
  },
});
```

### Actions

None.

---

## GitHub

```typescript
import { GitHub } from "floww";
const github = new GitHub();
// Or with a named credential: new GitHub("work-account")
```

### Triggers

All triggers require `owner` and `repository`.

**onPush**

```typescript
github.triggers.onPush({
  owner: "my-org",
  repository: "my-repo",
  branch: "main",             // Optional: filter by branch
  handler: async (ctx, event) => {
    const push = event.body;   // GitHubPushEvent
    console.log(push.ref, push.commits);
  },
});
```

**onPullRequest**

```typescript
github.triggers.onPullRequest({
  owner: "my-org",
  repository: "my-repo",
  actions: ["opened", "synchronize"],  // Optional filter
  // Available: opened, closed, reopened, synchronize, edited, assigned,
  //   unassigned, review_requested, review_request_removed, labeled,
  //   unlabeled, ready_for_review, converted_to_draft, locked, unlocked
  handler: async (ctx, event) => {
    const pr = event.body;     // GitHubPullRequestEvent
  },
});
```

**onIssue**

```typescript
github.triggers.onIssue({
  owner: "my-org",
  repository: "my-repo",
  actions: ["opened"],  // Optional
  // Available: opened, edited, deleted, pinned, unpinned, closed, reopened,
  //   assigned, unassigned, labeled, unlabeled, locked, unlocked,
  //   transferred, milestoned, demilestoned
  handler: async (ctx, event) => { /* event.body: GitHubIssueEvent */ },
});
```

**onIssueComment**

```typescript
github.triggers.onIssueComment({
  owner: "my-org",
  repository: "my-repo",
  actions: ["created"],  // Optional: created, edited, deleted
  handler: async (ctx, event) => { /* event.body: GitHubIssueCommentEvent */ },
});
```

**onRelease**

```typescript
github.triggers.onRelease({
  owner: "my-org",
  repository: "my-repo",
  actions: ["published"],  // Optional: published, unpublished, created, edited, deleted, prereleased, released
  handler: async (ctx, event) => { /* event.body: GitHubReleaseEvent */ },
});
```

### Actions

All actions are called via `github.actions.<method>(args)`.

**Repository**: `getRepository({ owner, repo })`, `listRepositories()`, `createRepository({ name, description?, private?, autoInit? })`, `updateRepository({ owner, repo, ...updates })`

**Issues**: `getIssue({ owner, repo, issueNumber })`, `listIssues({ owner, repo, state?, labels?, sort?, direction? })`, `createIssue({ owner, repo, title, body?, labels?, assignees? })`, `updateIssue({ owner, repo, issueNumber, title?, body?, state?, labels?, assignees? })`, `closeIssue({ owner, repo, issueNumber })`, `reopenIssue({ owner, repo, issueNumber })`, `addLabels({ owner, repo, issueNumber, labels })`, `removeLabel({ owner, repo, issueNumber, name })`, `addAssignees({ owner, repo, issueNumber, assignees })`, `removeAssignees({ owner, repo, issueNumber, assignees })`, `lockIssue({ owner, repo, issueNumber, lockReason? })`, `unlockIssue({ owner, repo, issueNumber })`

**Pull Requests**: `getPullRequest({ owner, repo, pullNumber })`, `listPullRequests({ owner, repo, state?, head?, base?, sort?, direction? })`, `createPullRequest({ owner, repo, title, head, base, body?, draft? })`, `updatePullRequest({ owner, repo, pullNumber, title?, body?, state?, base? })`, `mergePullRequest({ owner, repo, pullNumber, mergeMethod? })`, `closePullRequest({ owner, repo, pullNumber })`, `requestReviewers({ owner, repo, pullNumber, reviewers?, teamReviewers? })`, `removeRequestedReviewers({ owner, repo, pullNumber, reviewers?, teamReviewers? })`, `listPullRequestFiles({ owner, repo, pullNumber })`, `listPullRequestCommits({ owner, repo, pullNumber })`

**Reviews**: `createReview({ owner, repo, pullNumber, body?, event?, comments? })`, `submitReview({ owner, repo, pullNumber, reviewId, body, event })`, `dismissReview({ owner, repo, pullNumber, reviewId, message })`

**Comments**: `listIssueComments({ owner, repo, issueNumber })`, `createComment({ owner, repo, issueNumber, body })`, `updateComment({ owner, repo, commentId, body })`, `deleteComment({ owner, repo, commentId })`, `createPullRequestReviewComment({ owner, repo, pullNumber, body, commitId, path, position? })`

**Releases**: `getRelease({ owner, repo, releaseId })`, `getLatestRelease({ owner, repo })`, `getReleaseByTag({ owner, repo, tag })`, `listReleases({ owner, repo })`, `createRelease({ owner, repo, tagName, name?, body?, draft?, prerelease?, targetCommitish? })`, `updateRelease({ owner, repo, releaseId, tagName?, name?, body?, draft?, prerelease? })`, `deleteRelease({ owner, repo, releaseId })`, `generateReleaseNotes({ owner, repo, tagName, targetCommitish?, previousTagName? })`

**Commits**: `getCommit({ owner, repo, ref })`, `listCommits({ owner, repo, sha?, path?, since?, until? })`, `compareCommits({ owner, repo, base, head })`

**Branches**: `listBranches({ owner, repo })`, `getBranch({ owner, repo, branch })`, `createBranch({ owner, repo, ref, sha })`, `deleteBranch({ owner, repo, branch })`, `getBranchProtection({ owner, repo, branch })`, `updateBranchProtection({ owner, repo, branch, ...rules })`, `deleteBranchProtection({ owner, repo, branch })`

**Tags**: `listTags({ owner, repo })`, `createTag({ owner, repo, tag, message, object, type? })`, `deleteTag({ owner, repo, tag })`

**Files**: `getFileContent({ owner, repo, path, ref? })`, `createOrUpdateFile({ owner, repo, path, message, content, sha?, branch? })`, `deleteFile({ owner, repo, path, message, sha, branch? })`, `getRepositoryContent({ owner, repo, path, ref? })`

**Workflows**: `listWorkflows({ owner, repo })`, `getWorkflow({ owner, repo, workflowId })`, `triggerWorkflow({ owner, repo, workflowId, ref, inputs? })`, `listWorkflowRuns({ owner, repo, workflowId? })`, `getWorkflowRun({ owner, repo, runId })`, `rerunWorkflow({ owner, repo, runId })`, `cancelWorkflowRun({ owner, repo, runId })`, `deleteWorkflowRun({ owner, repo, runId })`

**Collaborators**: `listCollaborators({ owner, repo })`, `addCollaborator({ owner, repo, username, permission? })`, `removeCollaborator({ owner, repo, username })`, `checkCollaborator({ owner, repo, username })`

**Labels**: `listLabels({ owner, repo })`, `getLabel({ owner, repo, name })`, `createLabel({ owner, repo, name, color?, description? })`, `updateLabel({ owner, repo, name, newName?, color?, description? })`, `deleteLabel({ owner, repo, name })`

**Milestones**: `listMilestones({ owner, repo })`, `getMilestone({ owner, repo, milestoneNumber })`, `createMilestone({ owner, repo, title, state?, description?, dueOn? })`, `updateMilestone({ owner, repo, milestoneNumber, title?, state?, description?, dueOn? })`, `deleteMilestone({ owner, repo, milestoneNumber })`

**Search**: `searchIssues({ q })`, `searchRepositories({ q })`, `searchCode({ q })`, `searchCommits({ q })`, `searchUsers({ q })`

**Users**: `getCurrentUser()`, `getUser({ username })`

---

## Slack

```typescript
import { Slack } from "floww";
const slack = new Slack();
```

### Triggers

**onMessage**

```typescript
slack.triggers.onMessage({
  channelId: "C09PT6F7NMR",  // Optional: filter by channel
  userId: "U12345",           // Optional: filter by user
  handler: async (ctx, event) => {
    const msg = event.body.event;
    console.log(msg.text, msg.user, msg.channel, msg.ts);
  },
});
```

**onReaction**

```typescript
slack.triggers.onReaction({
  channelId: "C09PT6F7NMR",  // Optional
  userId: "U12345",           // Optional
  reaction: "thumbsup",       // Optional: filter by emoji name
  handler: async (ctx, event) => {
    const reaction = event.body.event;
  },
});
```

### Actions

**Messages**:
- `sendMessage({ channel, text?, blocks?, attachments?, thread_ts?, reply_broadcast?, mrkdwn? })` -- Send a message. Use `thread_ts` for threaded replies.
- `updateMessage({ channel, ts, text?, blocks?, attachments? })` -- Update an existing message.
- `deleteMessage({ channel, ts })` -- Delete a message.

**Reactions**:
- `addReaction({ channel, timestamp, name })` -- Add emoji reaction.
- `removeReaction({ channel, timestamp, name })` -- Remove emoji reaction.

**Files**:
- `uploadFile({ channels, file, filename?, title?, initialComment? })` -- Upload a file.

**Channels**:
- `listChannels()` -- List all channels.
- `getChannel({ channelId })` -- Get channel info.
- `createChannel({ name, isPrivate? })` -- Create a channel.

**Users**:
- `listUsers()` -- List all users.
- `getUser({ userId })` -- Get user info.

**History**:
- `conversationHistory({ channelId, cursor?, inclusive?, latest?, limit?, oldest?, include_all_metadata? })` -- Fetch message history.

---

## Discord

```typescript
import { Discord } from "floww";
const discord = new Discord();
```

### Triggers

**onMessage**

```typescript
discord.triggers.onMessage({
  guildId: "123456",       // Optional
  channelId: "789012",     // Optional
  userId: "345678",        // Optional
  includeBots: false,      // Optional: include bot messages
  includeEdits: false,     // Optional: include message edits
  handler: async (ctx, event) => {
    const msg = event.body;
  },
});
```

**onReaction**

```typescript
discord.triggers.onReaction({
  guildId: "123456",
  channelId: "789012",
  emoji: "thumbsup",      // Optional
  userId: "345678",        // Optional
  handler: async (ctx, event) => { /* ... */ },
});
```

**onMemberJoin**

```typescript
discord.triggers.onMemberJoin({
  guildId: "123456",       // Optional
  handler: async (ctx, event) => { /* ... */ },
});
```

**onMemberLeave**

```typescript
discord.triggers.onMemberLeave({
  guildId: "123456",
  handler: async (ctx, event) => { /* ... */ },
});
```

**onMemberUpdate**

```typescript
discord.triggers.onMemberUpdate({
  guildId: "123456",
  trackRoles: true,        // Optional: trigger on role changes
  trackNickname: true,     // Optional: trigger on nickname changes
  handler: async (ctx, event) => { /* ... */ },
});
```

### Actions

**Messages**: `sendMessage({ channelId, content, embeds?, components? })`, `sendDirectMessage({ userId, content, embeds? })`, `editMessage({ channelId, messageId, content?, embeds? })`, `deleteMessage({ channelId, messageId })`, `getMessage({ channelId, messageId })`, `getMessages({ channelId, limit?, before?, after?, around? })`

**Reactions**: `addReaction({ channelId, messageId, emoji })`, `removeReaction({ channelId, messageId, emoji })`

**Channels**: `createChannel({ guildId, name, type?, topic?, parent? })`, `updateChannel({ channelId, name?, topic? })`, `deleteChannel({ channelId })`, `getChannel({ channelId })`, `listChannels({ guildId })`

**Members & Roles**: `addRole({ guildId, userId, roleId })`, `removeRole({ guildId, userId, roleId })`, `getMember({ guildId, userId })`, `listMembers({ guildId, limit? })`, `kickMember({ guildId, userId, reason? })`, `banMember({ guildId, userId, reason?, deleteMessageDays? })`, `unbanMember({ guildId, userId })`

**Utilities**: `createEmbed({ title?, description?, color?, fields?, footer?, thumbnail?, image?, author?, url?, timestamp? })` -- Returns an embed object for use in messages.

---

## GitLab

```typescript
import { Gitlab } from "floww";
const gitlab = new Gitlab();
```

### Triggers

**onMergeRequest**

```typescript
gitlab.triggers.onMergeRequest({
  projectId: "12345",      // Either projectId or groupId required
  // groupId: "67890",
  handler: async (ctx, event) => {
    const mr = event.body;  // GitLabMergeRequestEvent
  },
});
```

### Actions

None.

---

## Jira

```typescript
import { Jira } from "floww";
const jira = new Jira();
```

### Triggers

**onIssueCreated**

```typescript
jira.triggers.onIssueCreated({
  projectKey: "PROJ",      // Optional
  issueType: "Bug",        // Optional
  handler: async (ctx, event) => {
    const issue = event.body;  // JiraIssueEvent
  },
});
```

**onIssueUpdated**

```typescript
jira.triggers.onIssueUpdated({
  projectKey: "PROJ",
  handler: async (ctx, event) => { /* ... */ },
});
```

**onCommentAdded**

```typescript
jira.triggers.onCommentAdded({
  projectKey: "PROJ",
  handler: async (ctx, event) => { /* event.body: JiraCommentEvent */ },
});
```

### Actions

**Issues**: `getIssue({ issueIdOrKey, fields? })`, `createIssue({ projectKey, issueType, summary, description?, priority?, assignee?, labels?, components? })`, `updateIssue({ issueIdOrKey, updates })`, `deleteIssue({ issueIdOrKey })`, `searchIssues({ jql, fields?, maxResults?, startAt? })`

**Comments**: `getComments({ issueIdOrKey })`, `addComment({ issueIdOrKey, commentText })`, `updateComment({ issueIdOrKey, commentId, commentText })`, `deleteComment({ issueIdOrKey, commentId })`

**Transitions**: `getTransitions({ issueIdOrKey })`, `transitionIssue({ issueIdOrKey, transitionIdOrName })`

**Projects**: `getProject({ projectIdOrKey })`, `listProjects()`

**Utilities**: `testConnection()` -- Returns `{ success, user? }`.

---

## Todoist

```typescript
import { Todoist } from "floww";
const todoist = new Todoist();
```

### Triggers

None.

### Actions

- `getTask({ taskId })` -- Get a single task.
- `getTasks({ filters? })` -- List tasks with optional filters.
- `createTask({ content, description?, projectId?, sectionId?, parentId?, order?, labels?, priority?, dueString?, dueDate?, dueDatetime?, assigneeId? })` -- Create a task.
- `updateTask({ taskId, updates })` -- Update a task.
- `deleteTask({ taskId })` -- Delete a task.
- `closeTask({ taskId })` -- Mark complete.
- `reopenTask({ taskId })` -- Reopen a completed task.
- `moveTask({ taskId, destination })` -- Move to a different project/section.
- `quickAddTask({ text, autoReminder?, ... })` -- Quick-add with natural language.

---

## KVStore

```typescript
import { KVStore } from "floww";
const kv = new KVStore();
// Or with a named credential: new KVStore("default")
```

### Triggers

None.

### Actions (direct)

- `listTables()` -- List all table names.
- `listKeys(table)` -- List keys in a table.
- `listItems<T>(table)` -- List all key-value pairs. Returns `KVItem<T>[]` with `{ key, value }`.
- `get<T>(table, key)` -- Get a value. Returns `T | undefined`.
- `set<T>(table, key, value)` -- Set a value.
- `delete(table, key)` -- Delete a key.
- `listPermissions(table)` -- List table permissions.
- `grantPermission(table, workflowId, { read?, write? })` -- Grant access to another workflow.
- `revokePermission(table, workflowId)` -- Revoke access.

### Table handle

```typescript
const table = kv.getTable<MyType>("my-table");
await table.get("key");
await table.set("key", value);
await table.delete("key");
await table.listKeys();
await table.listItems();
```

---

## AI Providers

### OpenAI

```typescript
import { OpenAI } from "floww";
const openai = new OpenAI();
```

Models via `openai.models.*`:
- `gpt4o` -> `gpt-4o`
- `gpt4oMini` -> `gpt-4o-mini`
- `gpt4Turbo` -> `gpt-4-turbo`
- `gpt4` -> `gpt-4`
- `gpt35Turbo` -> `gpt-3.5-turbo`
- `o1` -> `o1`
- `o1Mini` -> `o1-mini`
- `o1Preview` -> `o1-preview`

Or by string: `openai.models["gpt-4o"]`

### Anthropic

```typescript
import { Anthropic } from "floww";
const anthropic = new Anthropic();
```

Models via `anthropic.models.*`:
- `claude35Sonnet` -> `claude-3-5-sonnet-20241022`
- `claude35SonnetLatest` -> `claude-3-5-sonnet-latest`
- `claude35Haiku` -> `claude-3-5-haiku-20241022`
- `claude35HaikuLatest` -> `claude-3-5-haiku-latest`
- `claude3Opus` -> `claude-3-opus-20240229`
- `claude3OpusLatest` -> `claude-3-opus-latest`
- `claude3Sonnet` -> `claude-3-sonnet-20240229`
- `claude3Haiku` -> `claude-3-haiku-20240307`

### Google AI

```typescript
import { GoogleAI } from "floww";
const google = new GoogleAI();
```

Models via `google.models.*`:
- `gemini2Flash` -> `gemini-2.0-flash-exp`
- `gemini15Pro` -> `gemini-1.5-pro`
- `gemini15ProLatest` -> `gemini-1.5-pro-latest`
- `gemini15Flash` -> `gemini-1.5-flash`
- `gemini15FlashLatest` -> `gemini-1.5-flash-latest`
- `gemini10Pro` -> `gemini-1.0-pro`

### AI Utilities

Imported from `"floww/ai"`. These follow the Vercel AI SDK pattern.

```typescript
import { generateText, streamText, generateObject, streamObject, stepCountIs } from "floww/ai";
import { z } from "zod";
```

**generateText** -- Generate a text response.

```typescript
const result = await generateText({
  model: openai.models.gpt4o,
  system: "System prompt",
  prompt: "User prompt",
  tools: { /* tool definitions */ },
  stopWhen: stepCountIs(5),
});
console.log(result.text);
```

**streamText** -- Stream a text response.

```typescript
const stream = await streamText({
  model: openai.models.gpt4o,
  prompt: "...",
});
for await (const chunk of stream.textStream) {
  process.stdout.write(chunk);
}
```

**generateObject** -- Generate a structured object.

```typescript
const result = await generateObject({
  model: openai.models.gpt4o,
  schema: z.object({
    summary: z.string(),
    sentiment: z.enum(["positive", "negative", "neutral"]),
  }),
  prompt: "Analyze this text...",
});
console.log(result.object);
```

**streamObject** -- Stream a structured object.

```typescript
const stream = await streamObject({
  model: openai.models.gpt4o,
  schema: z.object({ items: z.array(z.string()) }),
  prompt: "...",
});
for await (const partial of stream.partialObjectStream) {
  console.log(partial);
}
```

---

## Secret

```typescript
import { Secret } from "floww";
import { z } from "zod";

const apiConfig = new Secret("my-api", z.object({
  apiKey: z.string(),
  baseUrl: z.string().optional(),
}));

// In handler:
const { apiKey, baseUrl } = apiConfig.value();
```

The Secret provider gives type-safe access to secrets stored in the Floww dashboard. The Zod schema validates the shape at runtime.
