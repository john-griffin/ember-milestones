# ember-milestones [![Build Status](https://travis-ci.org/salsify/ember-milestones.svg?branch=master)](https://travis-ci.org/salsify/ember-milestones)

This addon provides a set of tools for navigating async code in testing and development. Milestones act as named synchronization points, and they give you the ability to change the behavior of annotated code during testing, skipping pauses or mocking out results.

- [Motivating Example](#motivating-example)
- [Usage](#usage)
  - [Setup](#setup)
  - [Actions](#actions)
  - [Shorthand](#shorthand)
  - [Skipping Other Milestones](#skipping-other-milestones)
  - [Multiple Coordinators](#multiple-coordinators)
- [Configuration](#configuration)
- [But Wait](#but-wait)

## Motivating Example

Demonstrating how ember-milestones works is likely easiest in the context of a motivating example. If you'd rather just jump right to the nuts and bolts, see the [Usage](#usage) section.

### The Situation

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

## Usage

### Activation

By default, all milestones start out inactive. When your application code reaches an inactive milestone, it behaves as though the `milestone` annotation weren't there at all, and just immediately invokes the given callback.

```js
await milestone('my-component#foo', () => doSomethingAsync());
// is equivalent to
await doSomethingAsync();
```

To do anything with a milestone, you must first activate it:

```js
let coordinator = activateMilestones(['my-component#foo']);
```

The returned `MilestoneCoordinator` object allows you to interact with activated milestones, exposing two methods:
 - `deactivateAll()` - deactivates all milestones belonging to this coordinator
 - `advanceTo(name)` - returns a promise that will settle once the given milestone has been reached, resolving to an object that allows you to control the milestone in question (see [actions](#actions) below)

TODO `setupMilestones`

### Importable Globals

TODO `advanceTo`
TODO `deactivateAllMilestones`

### Actions

#### Waiting to Reach a Milestone
```js
let milestone = await advanceTo('fetch-post');
// make assertions about the state of the world when the milestone is reached
```

This will pause until the `fetch-post` milestone is reached, resolving to an object that allows you to designate how the milestone should behave in application code.

#### Stubbing a Return
```js
await milestone.return('fake post');
// make assertions about the state of the world after the milestone resolves
```

This will resolve the `fetch-post` promise to `'fake post'` and then continue forward until the next milestone.

#### Stubbing a Throw
```js
await milestone.throw(new Error('boom'));
// make assertions about the state of the world after the milestone rejects
```

This will reject the `fetch-post` promise with the given error and continue on until the next milestone.

#### Passing Through
```js
await milestone.continue();
// make assertions about the state of the world after the milestone's callback resolves
```

This will invoke the original callback given to the milestone, as though the milestone were inactive. Note that the promise returned by `continue()` will resolve once the promise returned by the milestone's callback does, so awaiting it will allow making assertions about the state of the world when the milestone completes.

#### Canceling
```js
await milestone.cancel();
// make assertions about the state of the world after the milestone cancels
```

This will cause the milestone to behave like a canceled ember-concurrency task, canceling any other tasks it's linked with or rejecting with a `TaskCancelation` if it's treated as a regular promise as usual.

### Shorthand
Each of the available milestone actions also has a corresponding shorthand if you don't care to pause when the milestone is reached.

```js
// This:
await advanceTo('milestone').andReturn('value');
// is equivalent to this:
await advanceTo('milestone').then(milestone => milestone.return('value'));

// And similarly:
await advanceTo('milestone').andThrow(new Error('boom'));
await advanceTo('milestone').andContinue();
await advanceTo('milestone').andCancel();
```

### Skipping Other Milestones
While advancing to a particular milestone, all others belonging to the same coordinator will automatically `continue` if they're hit in the meantime.

For example, given the `save` method from the **Motivation** section at the top of this document, calling `advanceTo('application#show-saved-message')` would skip over the `application#save` milestone completely, just invoking its callback as though the milestone were inactive.

### Multiple Coordinators

Each call to `activateMilestones` returns its own milestone coordinator, and it's perfectly legal to have more than one coordinator active at a time, as long as no two are trying to control the same milestone. Because calling `advanceTo('some-milestone')` will cause the coordinator in charge of `'some-milestone'` to progress past all others on the way there, the easiest way to think about working with multiple coordinators is that you typically want one per logical thread of control.

For instance, suppose you want to test the interplay between a background polling operation and some async logic that may be triggered by user interaction.

TODO finish

## Configuration

An application can decide whether to enable ember-milestones for a build or not by passing configuration in `ember-cli-build.js`.
If ember-milestones is disabled, none of its runtime files will be included in the build, and all `milestone()` calls in your source code will be stripped out and replaced with an immediate invocation of the given callback.

The `enabled` flag defaults to `false` in production and `true` otherwise, with the goal being that ember-milestones is a zero-cost abstraction in production builds.

```js
new EmberApp(defaults, {
  milestones: {
    enabled: EmberApp.env() !== 'production'
  }
});
```

## But Wait

 - Q: Isn't this allowing test-oriented logic to leak into my application?

   A: Think of it as sort of like [ember-test-selectors](https://github.com/simplabs/ember-test-selectors) for your async code.

 - Q: Isn't this providing a tool to completely cross-cut all the normal architectural boundaries we rely on to keep our code from devolving into a mess of spaghetti?

   A: Yep! But only for testing/development purposes, and in a fairly controlled way. Use your best judgment. ¯\\\_(ツ)_/¯

