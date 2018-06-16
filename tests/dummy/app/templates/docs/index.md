{{docs-hero
  logo='ember'
  slimHeading='Milestones'
  byline='Tame asynchrony in testing and development'
}}

This addon provides a set of tools for navigating async code in testing and development. Milestones act as named synchronization points, and they give you the ability to change the behavior of annotated code during testing, skipping pauses or mocking out results.

## Introduction

Demonstrating how ember-milestones works is likely easiest in the context of a motivating example. If you'd rather just jump right to the nuts and bolts, see the {{link-to 'Usage section' 'docs.usage'}}.

### A Situation

Suppose you have a `save` method that keeps the user apprised of how things are going by setting a `message` property, and you want to write a test for this behavior:

```js
async save() {
  try {
    this.set('message', 'Saving...');
    await this.persistChanges();
    this.set('message', 'Saved!');
    await timeout(1000);
    this.set('message', null);
  } catch (error) {
    this.set('message', `Something went wrong: ${error.message}`);
  }
}
```

To try and test this, you might try to write something like:

```js
await click('button.save');
assert.dom('.message').hasText('Saving...');
```

However, because the promise returned by `click` and other test helpers waits for all pending async actions to resolve, your assertion won't actually run until the full save process has completed, so it will fail. You could instead use `waitUntil` as a way to implicitly step through the states of your save:

```js
click('button.save');
await waitUntil(() => find('.message', { text: 'Saving...' }));
await waitUntil(() => find('.message', { text: 'Saved!' }));
await waitUntil(() => find('.message', { text: '' }));
```

However, this means your tests will fail with a timeout rather than a meaningful assertion if this behavior ever breaks, and it's more fragile in the face of subtle changes to the timing of your application code. Since `waitUntil` relies on interval polling, a very quick change in state (and in general you want things to be as fast as possible in tests) might take place entirely in between two executions of your `waitUntil` callback.

Also troublingly, your test will pause for 1000ms while waiting for the `timeout` to execute. Adding one second to one test may not seem like the end of the world, but over a full test suite, pauses like this add up quickly.

### Using Milestones

By annotating key chunks of asynchronous code with `milestone`s, your test gains the ability to precisely manage the flow of control, ensuring you always know the exact state of things when making assertions:

```js
import { milestone } from 'ember-milestones';

// ...

async save() {
  try {
    this.set('message', 'Saving...');
    await milestone('my-component#save', () => this.persistChanges());
    this.set('message', 'Saved!');
    await milestone('my-component#show-saved-message', () => timeout(1000));
    this.set('message', null);
  } catch (error) {
    this.set('message', `Something went wrong: ${error.message}`);
  }
}
```

Then starting and stopping the flow of control during testing becomes much simpler.

```js
import { setupMilestones, advanceTo } from 'ember-milestones';

// ...

setupMilestones(hooks, ['my-component#save', 'my-component#show-saved-message']);

// ...

click('button.save');
await advanceTo('my-component#save');
assert.dom('.message').hasText('Saving...');

let messageMilestone = await advanceTo('my-component#show-saved-message');
assert.dom('.message').hasText('Saved!');

await messageMilestone.return();
assert.dom('.message').hasText('');
```
