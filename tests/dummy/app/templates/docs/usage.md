# Usage

## Activation

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

## Importable Globals

TODO `advanceTo`
TODO `deactivateAllMilestones`

## Actions

### Waiting to Reach a Milestone
```js
let milestone = await advanceTo('fetch-post');
// make assertions about the state of the world when the milestone is reached
```

This will pause until the `fetch-post` milestone is reached, resolving to an object that allows you to designate how the milestone should behave in application code.

### Stubbing a Return
```js
await milestone.return('fake post');
// make assertions about the state of the world after the milestone resolves
```

This will resolve the `fetch-post` promise to `'fake post'` and then continue forward until the next milestone.

### Stubbing a Throw
```js
await milestone.throw(new Error('boom'));
// make assertions about the state of the world after the milestone rejects
```

This will reject the `fetch-post` promise with the given error and continue on until the next milestone.

### Passing Through
```js
await milestone.continue();
// make assertions about the state of the world after the milestone's callback resolves
```

This will invoke the original callback given to the milestone, as though the milestone were inactive. Note that the promise returned by `continue()` will resolve once the promise returned by the milestone's callback does, so awaiting it will allow making assertions about the state of the world when the milestone completes.

### Canceling
```js
await milestone.cancel();
// make assertions about the state of the world after the milestone cancels
```

This will cause the milestone to behave like a canceled ember-concurrency task, canceling any other tasks it's linked with or rejecting with a `TaskCancelation` if it's treated as a regular promise as usual.

## Shorthand
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

## Skipping Other Milestones
While advancing to a particular milestone, all others belonging to the same coordinator will automatically `continue` if they're hit in the meantime.

For example, given the `save` method from the **Motivation** section at the top of this document, calling `advanceTo('application#show-saved-message')` would skip over the `application#save` milestone completely, just invoking its callback as though the milestone were inactive.

## Multiple Coordinators

Each call to `activateMilestones` returns its own milestone coordinator, and it's perfectly legal to have more than one coordinator active at a time, as long as no two are trying to control the same milestone. Because calling `advanceTo('some-milestone')` will cause the coordinator in charge of `'some-milestone'` to progress past all others on the way there, the easiest way to think about working with multiple coordinators is that you typically want one per logical thread of control.

For instance, suppose you want to test the interplay between a background polling operation and some async logic that may be triggered by user interaction.


TODO finish
